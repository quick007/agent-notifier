import { canonicalJson, type CanonicalJsonValue } from "./canonical-json.js";
import { DOMAINS, SCHEMA_VERSION } from "./domains.js";
import { canonicalSigningBytes, canonicalSigningText } from "./signing.js";
import type {
  DeviceKeyWrap,
  ResponseKind,
  ResponseSubmissionEnvelope,
  ServerVisibleMessageMetadata,
  StoredMessageEnvelope,
  StoredResponseEnvelope,
} from "./types.js";

export interface MessageEnvelopeSigningInput {
  readonly schemaVersion: 1;
  readonly metadata: ServerVisibleMessageMetadata;
  readonly ciphertext: string;
  readonly contentNonce: string;
  readonly contentAadHash: string;
  readonly keyWraps: readonly DeviceKeyWrap[];
}

export interface ResponseEnvelopeSigningInput {
  readonly schemaVersion: 1;
  readonly responseId: string;
  readonly messageId: string;
  readonly kind: ResponseKind;
  readonly expiresAt: string;
  readonly ciphertext: string;
  readonly contentNonce: string;
}

export type MessageEnvelopeSigningPayload = Readonly<{
  schemaVersion: 1;
  metadata: CanonicalJsonValue;
  ciphertext: string;
  contentNonce: string;
  contentAadHash: string;
  keyWraps: readonly CanonicalJsonValue[];
}>;

export type ResponseEnvelopeSigningPayload = Readonly<{
  schemaVersion: 1;
  responseId: string;
  messageId: string;
  kind: ResponseKind;
  expiresAt: string;
  ciphertext: string;
  contentNonce: string;
}>;

export function messageContentAadPayload(
  metadata: ServerVisibleMessageMetadata,
): Readonly<{ schemaVersion: 1; metadata: CanonicalJsonValue }> {
  assertSchemaVersion(metadata.schemaVersion, "metadata.schemaVersion");

  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: normalizeMessageMetadata(metadata),
  };
}

export function messageContentAadBytes(metadata: ServerVisibleMessageMetadata): Uint8Array {
  return canonicalSigningBytes({
    domain: DOMAINS.MESSAGE_CONTENT_AAD_V1,
    payload: messageContentAadPayload(metadata),
  });
}

export function buildMessageEnvelopeSigningPayload(
  envelope: MessageEnvelopeSigningInput | StoredMessageEnvelope,
): MessageEnvelopeSigningPayload {
  assertSchemaVersion(envelope.schemaVersion, "envelope.schemaVersion");

  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: normalizeMessageMetadata(envelope.metadata),
    ciphertext: envelope.ciphertext,
    contentNonce: envelope.contentNonce,
    contentAadHash: envelope.contentAadHash,
    keyWraps: normalizeKeyWraps(envelope.keyWraps),
  };
}

export function messageEnvelopeSigningText(
  envelope: MessageEnvelopeSigningInput | StoredMessageEnvelope,
): string {
  return canonicalSigningText({
    domain: DOMAINS.MESSAGE_V1,
    payload: buildMessageEnvelopeSigningPayload(envelope),
  });
}

export function messageEnvelopeSigningBytes(
  envelope: MessageEnvelopeSigningInput | StoredMessageEnvelope,
): Uint8Array {
  return canonicalSigningBytes({
    domain: DOMAINS.MESSAGE_V1,
    payload: buildMessageEnvelopeSigningPayload(envelope),
  });
}

export function buildResponseEnvelopeSigningPayload(
  envelope: ResponseEnvelopeSigningInput | ResponseSubmissionEnvelope | StoredResponseEnvelope,
): ResponseEnvelopeSigningPayload {
  assertSchemaVersion(envelope.schemaVersion, "response.schemaVersion");

  return {
    schemaVersion: SCHEMA_VERSION,
    responseId: envelope.responseId,
    messageId: envelope.messageId,
    kind: envelope.kind,
    expiresAt: envelope.expiresAt,
    ciphertext: envelope.ciphertext,
    contentNonce: envelope.contentNonce,
  };
}

export function responseEnvelopeSigningText(
  envelope: ResponseEnvelopeSigningInput | ResponseSubmissionEnvelope | StoredResponseEnvelope,
): string {
  return canonicalSigningText({
    domain: DOMAINS.RESPONSE_V1,
    payload: buildResponseEnvelopeSigningPayload(envelope),
  });
}

export function responseEnvelopeSigningBytes(
  envelope: ResponseEnvelopeSigningInput | ResponseSubmissionEnvelope | StoredResponseEnvelope,
): Uint8Array {
  return canonicalSigningBytes({
    domain: DOMAINS.RESPONSE_V1,
    payload: buildResponseEnvelopeSigningPayload(envelope),
  });
}

function normalizeMessageMetadata(metadata: ServerVisibleMessageMetadata): CanonicalJsonValue {
  assertSchemaVersion(metadata.schemaVersion, "metadata.schemaVersion");

  return {
    schemaVersion: SCHEMA_VERSION,
    messageId: metadata.messageId,
    recipientId: metadata.recipientId,
    senderId: metadata.senderId,
    mode: metadata.mode,
    createdAt: metadata.createdAt,
    expiresAt: metadata.expiresAt,
    ...(metadata.idempotencyKey === undefined ? {} : { idempotencyKey: metadata.idempotencyKey }),
  };
}

function normalizeKeyWrap(wrap: DeviceKeyWrap): CanonicalJsonValue {
  assertSchemaVersion(wrap.schemaVersion, "keyWrap.schemaVersion");

  return {
    schemaVersion: SCHEMA_VERSION,
    deviceId: wrap.deviceId,
    ephemeralPublicKey: wrap.ephemeralPublicKey,
    wrappedKey: wrap.wrappedKey,
    wrapNonce: wrap.wrapNonce,
  };
}

function normalizeKeyWraps(wraps: readonly DeviceKeyWrap[]): readonly CanonicalJsonValue[] {
  return wraps
    .map(normalizeKeyWrap)
    .sort((left, right) => compareCodeUnits(canonicalJson(left), canonicalJson(right)));
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertSchemaVersion(value: number, label: string): void {
  if (value !== SCHEMA_VERSION) {
    throw new TypeError(`${label} must be ${SCHEMA_VERSION}`);
  }
}
