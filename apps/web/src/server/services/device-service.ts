import { canonicalJson, type DeviceKeyWrap } from "@agent-notifier/protocol";
import { and, eq, gte, inArray, isNull, ne } from "drizzle-orm";

import { requireDatabase } from "../../db/client";
import { devices, messageEnvelopes, messageKeyWraps, pairingSessions, recipients, senders } from "../../db/schema";
import { AppError } from "../http";
import { sha256Base64Url, timingSafeEqual } from "../hash";
import { newId, nowIso } from "../ids";
import type { DeviceRegistration } from "../schemas";

export async function registerDevice(env: Env, input: DeviceRegistration) {
  const db = requireDatabase(env);
  const now = nowIso();
  const recipientId = input.recipientId ?? newId("rcp");
  const deviceId = newId("dev");
  const pushJson = input.pushSubscription ? JSON.stringify(input.pushSubscription) : null;

  if (input.recipientId) {
    await assertRegistrationPairingProof(env, input);
  } else {
    await db.insert(recipients).values({
      id: recipientId,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  await db.insert(devices).values({
    id: deviceId,
    recipientId,
    displayName: input.displayName,
    encryptionPublicKey: input.encryptionPublicKey,
    signingPublicKey: input.signingPublicKey,
    pushSubscriptionJson: pushJson,
    pushSubscriptionHash: pushJson ? await sha256Base64Url(pushJson) : null,
    pushEnabledAt: pushJson ? now : null,
    createdAt: now,
    updatedAt: now,
  }).run();

  return { recipientId, deviceId };
}

async function assertRegistrationPairingProof(env: Env, input: DeviceRegistration): Promise<void> {
  if (!input.recipientId || !input.pairingSessionId || !input.pairingSecret) {
    throw new AppError(400, "invalid_body", "recipientId requires pairing session proof.");
  }

  const [session] = await requireDatabase(env)
    .select()
    .from(pairingSessions)
    .where(eq(pairingSessions.id, input.pairingSessionId))
    .limit(1)
    .all();

  if (!session || session.expiresAt < nowIso()) {
    throw new AppError(404, "pairing_not_found", "Pairing session is invalid or expired.");
  }
  if (session.approvedAt || session.rejectedAt) {
    throw new AppError(409, "pairing_already_used", "Pairing session is already used.");
  }
  if (session.recipientId !== input.recipientId || !session.magicLinkSecretHash) {
    throw new AppError(403, "scope_mismatch", "Pairing session is not scoped to this recipient.");
  }
  if (!timingSafeEqual(await sha256Base64Url(input.pairingSecret), session.magicLinkSecretHash)) {
    throw new AppError(401, "invalid_pairing_secret", "Pairing secret is invalid.");
  }
}

export async function updatePushSubscription(env: Env, deviceId: string, pushSubscription: Record<string, unknown> | null) {
  const db = requireDatabase(env);
  const now = nowIso();
  const pushJson = pushSubscription ? JSON.stringify(pushSubscription) : null;

  await db.update(devices).set({
    pushSubscriptionJson: pushJson,
    pushSubscriptionHash: pushJson ? await sha256Base64Url(pushJson) : null,
    pushEnabledAt: pushJson ? now : null,
    pushDisabledAt: pushJson ? null : now,
    updatedAt: now,
  }).where(eq(devices.id, deviceId)).run();

  return { deviceId, pushEnabled: Boolean(pushJson) };
}

export async function pendingMessages(env: Env, deviceId: string) {
  const db = requireDatabase(env);
  const now = nowIso();
  const deliveries = await db
    .select({ wrap: messageKeyWraps, message: messageEnvelopes, sender: senders })
    .from(messageKeyWraps)
    .innerJoin(messageEnvelopes, eq(messageKeyWraps.messageId, messageEnvelopes.id))
    .innerJoin(senders, eq(messageEnvelopes.senderId, senders.id))
    .where(and(
      eq(messageKeyWraps.deviceId, deviceId),
      isNull(messageKeyWraps.deliveredAt),
      ne(messageEnvelopes.state, "expired"),
      gte(messageEnvelopes.expiresAt, now),
    ))
    .all();

  const messageIds = [...new Set(deliveries.map(({ message }) => message.id))];
  const allWraps = messageIds.length === 0
    ? []
    : await db.select().from(messageKeyWraps).where(inArray(messageKeyWraps.messageId, messageIds)).all();
  const wrapsByMessage = new Map<string, DeviceKeyWrap[]>();
  for (const wrap of allWraps) {
    const keyWraps = wrapsByMessage.get(wrap.messageId) ?? [];
    keyWraps.push(toDeviceKeyWrap(wrap));
    wrapsByMessage.set(wrap.messageId, keyWraps);
  }
  for (const keyWraps of wrapsByMessage.values()) {
    keyWraps.sort(compareKeyWraps);
  }

  return deliveries.map(({ wrap, message, sender }) => ({
    messageId: message.id,
    metadata: {
      schemaVersion: 1 as const,
      messageId: message.id,
      recipientId: message.recipientId,
      senderId: message.senderId,
      mode: message.mode,
      createdAt: message.createdAt,
      expiresAt: message.expiresAt,
      ...(message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : {}),
    },
    ciphertext: message.ciphertext,
    contentNonce: message.contentNonce,
    contentAadHash: message.contentAadHash,
    senderSignature: message.senderSignature,
    sender: {
      senderId: sender.id,
      displayName: sender.displayName,
      kind: sender.kind,
      encryptionPublicKey: sender.encryptionPublicKey,
      signingPublicKey: sender.signingPublicKey,
    },
    keyWraps: wrapsByMessage.get(message.id) ?? [toDeviceKeyWrap(wrap)],
    keyWrap: toDeviceKeyWrap(wrap),
  }));
}

export async function markDelivered(env: Env, deviceId: string, messageId: string) {
  const db = requireDatabase(env);
  const now = nowIso();
  const [delivery] = await db
    .select({ device: devices, message: messageEnvelopes })
    .from(messageKeyWraps)
    .innerJoin(devices, eq(messageKeyWraps.deviceId, devices.id))
    .innerJoin(messageEnvelopes, eq(messageKeyWraps.messageId, messageEnvelopes.id))
    .where(and(eq(messageKeyWraps.deviceId, deviceId), eq(messageKeyWraps.messageId, messageId)))
    .limit(1)
    .all();

  if (!delivery) throw new AppError(404, "message_not_found", "Message was not found for this device.");
  if (delivery.device.recipientId !== delivery.message.recipientId) {
    throw new AppError(403, "scope_mismatch", "Device is not scoped to this message.");
  }
  if (delivery.message.state === "expired" || delivery.message.expiresAt < now) {
    throw new AppError(409, "message_expired", "Message is expired.");
  }

  await db.update(messageKeyWraps).set({ deliveredAt: now }).where(and(
    eq(messageKeyWraps.deviceId, deviceId),
    eq(messageKeyWraps.messageId, messageId),
  )).run();
  await db.update(messageEnvelopes).set({ state: "delivered", firstDeliveredAt: now }).where(and(
    eq(messageEnvelopes.id, messageId),
    eq(messageEnvelopes.recipientId, delivery.message.recipientId),
    eq(messageEnvelopes.state, "accepted"),
  )).run();
  await db.update(devices).set({ lastDeliveredAt: now, lastSeenAt: now, updatedAt: now }).where(eq(devices.id, deviceId)).run();

  return { messageId, state: "delivered" as const };
}

export async function revokeSender(env: Env, senderId: string, recipientId: string) {
  const db = requireDatabase(env);
  const [sender] = await db.select().from(senders).where(eq(senders.id, senderId)).limit(1).all();
  if (!sender || sender.recipientId !== recipientId) {
    throw new AppError(404, "sender_not_found", "Sender was not found.");
  }
  const now = nowIso();
  await db.update(senders).set({ revokedAt: now, updatedAt: now }).where(and(
    eq(senders.id, senderId),
    eq(senders.recipientId, recipientId),
  )).run();
  return { senderId, revoked: true };
}

export async function listSendersForDevice(env: Env, deviceId: string) {
  const db = requireDatabase(env);
  const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1).all();
  if (!device) throw new AppError(404, "device_not_found", "Device was not found.");

  const rows = await db.select().from(senders).where(eq(senders.recipientId, device.recipientId)).all();

  return {
    senders: rows.map((sender) => ({
      id: sender.id,
      displayName: sender.displayName,
      kind: sender.kind,
      appName: sender.appName,
      machineLabel: sender.machineLabel,
      workspaceLabel: sender.workspaceLabel,
      encryptionPublicKey: sender.encryptionPublicKey,
      previewPolicy: toPreviewPolicy(sender.previewPolicy),
      createdAt: sender.createdAt,
      revokedAt: sender.revokedAt,
      lastUsedAt: sender.lastUsedAt,
    })),
  };
}

function toDeviceKeyWrap(wrap: {
  readonly deviceId: string;
  readonly ephemeralPublicKey: string;
  readonly wrappedKey: string;
  readonly wrapNonce: string;
}): DeviceKeyWrap {
  return {
    schemaVersion: 1,
    deviceId: wrap.deviceId,
    ephemeralPublicKey: wrap.ephemeralPublicKey,
    wrappedKey: wrap.wrappedKey,
    wrapNonce: wrap.wrapNonce,
  };
}

function compareKeyWraps(left: DeviceKeyWrap, right: DeviceKeyWrap): number {
  return compareCodeUnits(canonicalJson(left), canonicalJson(right));
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

type PreviewPolicyValue = "allow_agent_choice" | "always_hide" | "always_show_non_sensitive";

function toPreviewPolicy(value: string): PreviewPolicyValue {
  if (value === "always_hide" || value === "always_show_non_sensitive") return value;
  return "allow_agent_choice";
}
