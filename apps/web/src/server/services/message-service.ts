import { importSigningPublicKey, sha256Base64Url, verifyP256Sha256 } from "@agent-notifier/crypto";
import {
  messageContentAadBytes,
  messageEnvelopeSigningBytes,
  responseEnvelopeSigningBytes,
  type ServerVisibleMessageMetadata,
} from "@agent-notifier/protocol";
import { and, eq, isNull } from "drizzle-orm";

import { requireDatabase } from "../../db/client";
import {
  deliveryEvents,
  devices,
  messageEnvelopes,
  messageKeyWraps,
  responseEnvelopes,
  senders,
} from "../../db/schema";
import { AppError } from "../http";
import { newId, nowIso } from "../ids";
import type { MessageSubmission, ResponseSubmission } from "../schemas";
import { sendPushWakeups } from "./push-service";

type WaitUntilContext = {
  waitUntil(promise: Promise<unknown>): void;
};

export async function createMessage(env: Env, ctx: WaitUntilContext, input: MessageSubmission) {
  const db = requireDatabase(env);
  const [sender] = await db.select().from(senders).where(eq(senders.id, input.senderId)).limit(1).all();
  if (!sender || sender.revokedAt) throw new AppError(403, "sender_revoked", "Sender is not active.");
  if (sender.recipientId !== input.recipientId) throw new AppError(403, "scope_mismatch", "Sender cannot message this recipient.");

  const targets = await db.select({
    deviceId: devices.id,
    pushSubscriptionJson: devices.pushSubscriptionJson,
  }).from(devices).where(and(eq(devices.recipientId, input.recipientId), isNull(devices.revokedAt))).all();
  assertKeyWrapScope(input.keyWraps, targets.map((target) => target.deviceId));
  const metadata = messageMetadata(input);
  await assertContentAadHash(metadata, input.contentAadHash);
  await assertMessageEnvelopeSignature(sender.signingPublicKey, input, metadata);

  await db.insert(messageEnvelopes).values({
    id: input.messageId,
    recipientId: input.recipientId,
    senderId: input.senderId,
    mode: input.mode,
    state: "accepted",
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    ciphertext: input.ciphertext,
    contentNonce: input.contentNonce,
    contentAadHash: input.contentAadHash,
    senderSignature: input.senderSignature,
    schemaVersion: input.schemaVersion,
    ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
  }).run();
  await db.insert(messageKeyWraps).values(input.keyWraps.map((wrap) => ({
    id: newId("wrap"),
    messageId: input.messageId,
    deviceId: wrap.deviceId,
    ephemeralPublicKey: wrap.ephemeralPublicKey,
    wrappedKey: wrap.wrappedKey,
    wrapNonce: wrap.wrapNonce,
  }))).run();
  await addEvent(env, input.messageId, input.senderId, input.recipientId, "accepted");

  ctx.waitUntil(recordPushAttempts(env, input.messageId, input.senderId, input.recipientId, targets));
  return { messageId: input.messageId, state: "accepted" as const };
}

export async function senderTargets(env: Env, senderId: string, recipientId: string) {
  const db = requireDatabase(env);
  const [sender] = await db.select().from(senders).where(and(
    eq(senders.id, senderId),
    eq(senders.recipientId, recipientId),
    isNull(senders.revokedAt),
  )).limit(1).all();
  if (!sender) throw new AppError(404, "sender_not_found", "Sender was not found.");

  const rows = await db.select({
    deviceId: devices.id,
    encryptionPublicKey: devices.encryptionPublicKey,
    signingPublicKey: devices.signingPublicKey,
  }).from(devices).where(and(eq(devices.recipientId, recipientId), isNull(devices.revokedAt))).all();

  return { senderId, recipientId, devices: rows };
}

export async function messageStatus(env: Env, senderId: string, messageId: string) {
  const db = requireDatabase(env);
  const [message] = await db.select().from(messageEnvelopes).where(eq(messageEnvelopes.id, messageId)).limit(1).all();
  if (!message || message.senderId !== senderId) throw new AppError(404, "message_not_found", "Message was not found.");
  return {
    messageId,
    state: message.state,
    firstDeliveredAt: message.firstDeliveredAt,
    respondedAt: message.respondedAt,
    expiresAt: message.expiresAt,
  };
}

export async function messageEvents(env: Env, senderId: string, messageId: string) {
  const db = requireDatabase(env);
  const events = await db.select().from(deliveryEvents).where(and(
    eq(deliveryEvents.messageId, messageId),
    eq(deliveryEvents.senderId, senderId),
  )).all();
  return { messageId, events };
}

export async function submitResponse(
  env: Env,
  deviceId: string,
  recipientId: string,
  messageId: string,
  input: ResponseSubmission,
) {
  const db = requireDatabase(env);
  const [message] = await db.select().from(messageEnvelopes).where(eq(messageEnvelopes.id, messageId)).limit(1).all();
  if (!message || message.recipientId !== recipientId) throw new AppError(404, "message_not_found", "Message was not found.");
  const [wrap] = await db.select().from(messageKeyWraps).where(and(
    eq(messageKeyWraps.messageId, messageId),
    eq(messageKeyWraps.deviceId, deviceId),
  )).limit(1).all();
  const [device] = await db.select().from(devices).where(and(
    eq(devices.id, deviceId),
    eq(devices.recipientId, recipientId),
    isNull(devices.revokedAt),
  )).limit(1).all();
  if (!wrap) throw new AppError(403, "scope_mismatch", "Device is not a target for this message.");
  if (!device) throw new AppError(401, "device_not_active", "Device is not active.");
  if (message.state === "responded") throw new AppError(409, "already_responded", "Message already has a response.");
  if (message.state === "expired" || message.expiresAt < nowIso()) throw new AppError(409, "message_expired", "Message is expired.");
  if (message.mode === "notify") throw new AppError(400, "response_not_allowed", "Notifications do not accept responses.");
  if (message.mode === "request_reply" && input.kind !== "reply") {
    throw new AppError(400, "response_kind_mismatch", "Reply requests require reply responses.");
  }
  if (message.mode === "request_approval" && input.kind !== "approval") {
    throw new AppError(400, "response_kind_mismatch", "Approval requests require approval responses.");
  }
  await assertResponseEnvelopeSignature(device.signingPublicKey, messageId, input);

  const now = nowIso();
  await db.insert(responseEnvelopes).values({
    id: input.responseId,
    messageId,
    recipientId: message.recipientId,
    senderId: message.senderId,
    deviceId,
    kind: input.kind,
    createdAt: now,
    expiresAt: input.expiresAt,
    ciphertext: input.ciphertext,
    contentNonce: input.contentNonce,
    deviceSignature: input.deviceSignature,
    schemaVersion: input.schemaVersion,
  }).run();
  await db.update(messageEnvelopes).set({ state: "responded", respondedAt: now }).where(eq(messageEnvelopes.id, messageId)).run();
  await addEvent(env, messageId, message.senderId, message.recipientId, "responded", deviceId);
  return { messageId, responseId: input.responseId, state: "responded" as const };
}

export async function messageResponse(env: Env, senderId: string, messageId: string) {
  const db = requireDatabase(env);
  const [response] = await db.select().from(responseEnvelopes).where(and(
    eq(responseEnvelopes.messageId, messageId),
    eq(responseEnvelopes.senderId, senderId),
  )).limit(1).all();
  if (!response) throw new AppError(404, "response_not_found", "Response was not found.");
  return response;
}

async function recordPushAttempts(env: Env, messageId: string, senderId: string, recipientId: string, targets: Array<{
  deviceId: string;
  pushSubscriptionJson: string | null;
}>) {
  const attempts = await sendPushWakeups(env, targets, messageId);
  await Promise.all(attempts.map((attempt) => addEvent(
    env,
    messageId,
    senderId,
    recipientId,
    attempt.ok ? "push_attempted" : "push_failed",
    attempt.deviceId,
    JSON.stringify({ status: attempt.status, error: attempt.error }),
  )));
}

function assertKeyWrapScope(
  keyWraps: MessageSubmission["keyWraps"],
  activeDeviceIds: string[],
): void {
  if (activeDeviceIds.length === 0) {
    throw new AppError(409, "no_active_devices", "Recipient has no active devices.");
  }

  const active = new Set(activeDeviceIds);
  const wrapped = new Set<string>();
  for (const wrap of keyWraps) {
    if (wrapped.has(wrap.deviceId)) {
      throw new AppError(400, "duplicate_key_wrap", "Each device can have only one key wrap.");
    }
    if (!active.has(wrap.deviceId)) {
      throw new AppError(403, "scope_mismatch", "Key wraps must target active recipient devices.");
    }
    wrapped.add(wrap.deviceId);
  }

  for (const deviceId of active) {
    if (!wrapped.has(deviceId)) {
      throw new AppError(400, "missing_key_wrap", "Every active recipient device needs a key wrap.");
    }
  }
}

async function addEvent(
  env: Env,
  messageId: string,
  senderId: string,
  recipientId: string,
  event: string,
  deviceId?: string,
  detailsJson?: string,
) {
  await requireDatabase(env).insert(deliveryEvents).values({
    id: newId("evt"),
    messageId,
    senderId,
    recipientId,
    event,
    createdAt: nowIso(),
    ...(deviceId === undefined ? {} : { deviceId }),
    ...(detailsJson === undefined ? {} : { detailsJson }),
  }).run();
}

function messageMetadata(input: MessageSubmission): ServerVisibleMessageMetadata {
  return {
    schemaVersion: input.schemaVersion,
    messageId: input.messageId,
    recipientId: input.recipientId,
    senderId: input.senderId,
    mode: input.mode,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
  };
}

async function assertContentAadHash(metadata: ServerVisibleMessageMetadata, contentAadHash: string): Promise<void> {
  const expected = await sha256Base64Url(owned(messageContentAadBytes(metadata)));
  if (contentAadHash !== expected) {
    throw new AppError(400, "invalid_content_aad_hash", "contentAadHash must match message metadata.");
  }
}

async function assertMessageEnvelopeSignature(signingPublicKey: string, input: MessageSubmission, metadata: ServerVisibleMessageMetadata): Promise<void> {
  const ok = await verifyEnvelopeSignature(
    signingPublicKey,
    messageEnvelopeSigningBytes({
      schemaVersion: input.schemaVersion,
      metadata,
      ciphertext: input.ciphertext,
      contentNonce: input.contentNonce,
      contentAadHash: input.contentAadHash,
      keyWraps: input.keyWraps,
    }),
    input.senderSignature,
  );
  if (!ok) throw new AppError(400, "invalid_sender_signature", "Message envelope sender signature is invalid.");
}

async function assertResponseEnvelopeSignature(signingPublicKey: string, messageId: string, input: ResponseSubmission): Promise<void> {
  const ok = await verifyEnvelopeSignature(
    signingPublicKey,
    responseEnvelopeSigningBytes({ ...input, messageId }),
    input.deviceSignature,
  );
  if (!ok) throw new AppError(400, "invalid_device_signature", "Response envelope device signature is invalid.");
}

async function verifyEnvelopeSignature(signingPublicKey: string, bytes: Uint8Array, signature: string): Promise<boolean> {
  try {
    return await verifyP256Sha256(await importSigningPublicKey(signingPublicKey), owned(bytes), signature);
  } catch {
    return false;
  }
}

function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}
