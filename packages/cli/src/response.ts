import { DOMAINS, canonicalSigningBytes, responseEnvelopeSigningBytes, type DeviceKeyWrap, type ResponseKind } from "@agent-notifier/protocol";
import {
  bytesToUtf8,
  fromBase64Url,
  importEncryptionPrivateKey,
  importSigningPublicKey,
  openContentFromDeviceWrap,
  verifyP256Sha256,
} from "@agent-notifier/crypto";
import type { AgentNotifierResponse, MessageTargetDevice, SenderRecord } from "./contracts.js";

const RESPONSE_SEALED_FORMAT = "agent-notifier/response-sealed/v1";

interface ResponseEnvelopeJson {
  schemaVersion: 1;
  responseId: string;
  messageId: string;
  recipientId: string;
  senderId: string;
  deviceId: string;
  kind: ResponseKind;
  createdAt: string;
  expiresAt: string;
  ciphertext: string;
  contentNonce: string;
  deviceSignature: string;
}

interface PackedResponseCiphertext {
  schemaVersion: 1;
  format: typeof RESPONSE_SEALED_FORMAT;
  ciphertext: string;
  contentNonce: string;
  contentAadHash: string;
  senderKeyWrap: DeviceKeyWrap;
}

type ResponsePlaintextResult =
  | {
    messageId: string;
    kind: "reply";
    body: string;
    respondedAt: string;
  }
  | {
    messageId: string;
    kind: "approval";
    decision: "approved" | "rejected";
    note?: string;
    respondedAt: string;
  };

export function parseResponseEnvelope(value: unknown): ResponseEnvelopeJson {
  const record = objectRecord(value, "response envelope");
  return {
    schemaVersion: literalOne(record.schemaVersion, "response.schemaVersion"),
    responseId: stringField(record.responseId ?? record.id, "response.responseId"),
    messageId: stringField(record.messageId, "response.messageId"),
    recipientId: stringField(record.recipientId, "response.recipientId"),
    senderId: stringField(record.senderId, "response.senderId"),
    deviceId: stringField(record.deviceId, "response.deviceId"),
    kind: responseKind(record.kind),
    createdAt: stringField(record.createdAt, "response.createdAt"),
    expiresAt: stringField(record.expiresAt, "response.expiresAt"),
    ciphertext: stringField(record.ciphertext, "response.ciphertext"),
    contentNonce: stringField(record.contentNonce, "response.contentNonce"),
    deviceSignature: stringField(record.deviceSignature, "response.deviceSignature"),
  };
}

export async function decryptSenderResponse(input: {
  sender: SenderRecord;
  envelope: ResponseEnvelopeJson;
  devices: readonly MessageTargetDevice[];
}): Promise<AgentNotifierResponse> {
  if (!input.sender.encryptionPrivateKeyPkcs8) {
    throw new Error("Sender encryption key is not available locally.");
  }
  if (input.envelope.senderId !== input.sender.id) {
    throw new Error("Response sender ID does not match this sender.");
  }
  if (input.sender.recipientId && input.envelope.recipientId !== input.sender.recipientId) {
    throw new Error("Response recipient ID does not match this sender.");
  }

  const device = input.devices.find((candidate) => candidate.deviceId === input.envelope.deviceId);
  if (!device) {
    throw new Error(`No signing key is available for response device ${input.envelope.deviceId}.`);
  }

  const signingEnvelope = {
    schemaVersion: input.envelope.schemaVersion,
    responseId: input.envelope.responseId,
    messageId: input.envelope.messageId,
    kind: input.envelope.kind,
    expiresAt: input.envelope.expiresAt,
    ciphertext: input.envelope.ciphertext,
    contentNonce: input.envelope.contentNonce,
  };
  const ok = await verifyP256Sha256(
    await importSigningPublicKey(device.signingPublicKey),
    owned(responseEnvelopeSigningBytes(signingEnvelope)),
    input.envelope.deviceSignature,
  );
  if (!ok) {
    throw new Error("Response device signature is invalid.");
  }

  const packed = unpackResponseCiphertext(input.envelope.ciphertext);
  if (packed.contentNonce !== input.envelope.contentNonce) {
    throw new Error("Response content nonce does not match its sealed payload.");
  }
  if (packed.senderKeyWrap.deviceId !== input.sender.id) {
    throw new Error("Response sender key wrap does not target this sender.");
  }

  const aad = responseContentAadBytes(input.envelope);
  const plaintext = parseResponsePlaintext(JSON.parse(bytesToUtf8(await openContentFromDeviceWrap(
    {
      ciphertext: packed.ciphertext,
      contentNonce: packed.contentNonce,
      contentAadHash: packed.contentAadHash,
    },
    packed.senderKeyWrap,
    await importEncryptionPrivateKey(input.sender.encryptionPrivateKeyPkcs8),
    aad,
  ))));
  if (plaintext.messageId !== input.envelope.messageId || plaintext.kind !== input.envelope.kind) {
    throw new Error("Response plaintext does not match its envelope.");
  }

  if (plaintext.kind === "reply") {
    return { responseId: input.envelope.responseId, deviceId: input.envelope.deviceId, ...plaintext };
  }
  return { responseId: input.envelope.responseId, deviceId: input.envelope.deviceId, ...plaintext };
}

function responseContentAadBytes(input: Pick<ResponseEnvelopeJson, "responseId" | "messageId" | "kind" | "expiresAt">): Uint8Array<ArrayBuffer> {
  return owned(canonicalSigningBytes({
    domain: DOMAINS.RESPONSE_V1,
    payload: {
      schemaVersion: 1,
      responseId: input.responseId,
      messageId: input.messageId,
      kind: input.kind,
      expiresAt: input.expiresAt,
    },
  }));
}

function unpackResponseCiphertext(value: string): PackedResponseCiphertext {
  const record = objectRecord(JSON.parse(bytesToUtf8(fromBase64Url(value))), "sealed response");
  const senderKeyWrap = keyWrap(record.senderKeyWrap);
  return {
    schemaVersion: literalOne(record.schemaVersion, "sealed.schemaVersion"),
    format: sealedFormat(record.format),
    ciphertext: stringField(record.ciphertext, "sealed.ciphertext"),
    contentNonce: stringField(record.contentNonce, "sealed.contentNonce"),
    contentAadHash: stringField(record.contentAadHash, "sealed.contentAadHash"),
    senderKeyWrap,
  };
}

function parseResponsePlaintext(value: unknown): ResponsePlaintextResult {
  const record = objectRecord(value, "response plaintext");
  literalOne(record.schemaVersion, "plaintext.schemaVersion");
  const messageId = stringField(record.messageId, "plaintext.messageId");
  const kind = responseKind(record.kind);
  const respondedAt = stringField(record.respondedAt, "plaintext.respondedAt");
  if (kind === "reply") {
    return { messageId, kind, body: stringField(record.body, "plaintext.body"), respondedAt };
  }
  const decision = record.decision;
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("plaintext.decision must be approved or rejected.");
  }
  const note = record.note === undefined ? undefined : stringField(record.note, "plaintext.note");
  return { messageId, kind, decision, ...(note === undefined ? {} : { note }), respondedAt };
}

function keyWrap(value: unknown): DeviceKeyWrap {
  const record = objectRecord(value, "sender key wrap");
  return {
    schemaVersion: literalOne(record.schemaVersion, "senderKeyWrap.schemaVersion"),
    deviceId: stringField(record.deviceId, "senderKeyWrap.deviceId"),
    ephemeralPublicKey: stringField(record.ephemeralPublicKey, "senderKeyWrap.ephemeralPublicKey"),
    wrappedKey: stringField(record.wrappedKey, "senderKeyWrap.wrappedKey"),
    wrapNonce: stringField(record.wrapNonce, "senderKeyWrap.wrapNonce"),
  };
}

function responseKind(value: unknown): ResponseKind {
  if (value === "reply" || value === "approval") return value;
  throw new Error("response.kind must be reply or approval.");
}

function sealedFormat(value: unknown): typeof RESPONSE_SEALED_FORMAT {
  if (value === RESPONSE_SEALED_FORMAT) return value;
  throw new Error("sealed.format is not supported.");
}

function literalOne(value: unknown, label: string): 1 {
  if (value === 1) return 1;
  throw new Error(`${label} must be 1.`);
}

function stringField(value: unknown, label: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`${label} must be a non-empty string.`);
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${label} must be an object.`);
}

function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}
