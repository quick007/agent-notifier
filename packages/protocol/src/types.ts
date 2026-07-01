import type { CanonicalJsonValue } from "./canonical-json.js";

export const MESSAGE_MODES = ["notify", "request_reply", "request_approval"] as const;
export const DELIVERY_STATES = ["accepted", "delivered", "responded", "expired"] as const;
export const SENDER_KINDS = ["codex", "claude", "ci", "generic"] as const;
export const RESPONSE_KINDS = ["reply", "approval"] as const;

export type MessageMode = (typeof MESSAGE_MODES)[number];

export type DeliveryState = (typeof DELIVERY_STATES)[number];

export type SenderKind = (typeof SENDER_KINDS)[number];

export type ResponseKind = (typeof RESPONSE_KINDS)[number];

export interface ServerVisibleMessageMetadata {
  readonly schemaVersion: 1;
  readonly messageId: string;
  readonly recipientId: string;
  readonly senderId: string;
  readonly mode: MessageMode;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly idempotencyKey?: string;
}

export interface ReplyRequestPlaintext {
  readonly kind: "reply";
  readonly prompt?: string;
}

export interface ApprovalRequestPlaintext {
  readonly kind: "approval";
  readonly actionLabel: string;
  readonly riskText?: string;
}

export type MessageRequestPlaintext =
  | ReplyRequestPlaintext
  | ApprovalRequestPlaintext
  | null;

export interface MessagePlaintext {
  readonly schemaVersion: 1;
  readonly title: string;
  readonly body: string;
  readonly sensitive: boolean;
  readonly mode: MessageMode;
  readonly createdAt: string;
  readonly request: MessageRequestPlaintext;
}

export interface DeviceKeyWrap {
  readonly schemaVersion: 1;
  readonly deviceId: string;
  readonly ephemeralPublicKey: string;
  readonly wrappedKey: string;
  readonly wrapNonce: string;
}

export interface StoredMessageEnvelope {
  readonly schemaVersion: 1;
  readonly messageId: string;
  readonly metadata: ServerVisibleMessageMetadata;
  readonly ciphertext: string;
  readonly contentNonce: string;
  readonly contentAadHash: string;
  readonly keyWraps: readonly DeviceKeyWrap[];
  readonly senderSignature: string;
}

export interface MessageSubmissionEnvelope {
  readonly schemaVersion: 1;
  readonly metadata: ServerVisibleMessageMetadata;
  readonly ciphertext: string;
  readonly contentNonce: string;
  readonly contentAadHash: string;
  readonly keyWraps: readonly DeviceKeyWrap[];
  readonly senderSignature: string;
}

export interface PendingMessageEnvelope {
  readonly messageId: string;
  readonly metadata: ServerVisibleMessageMetadata;
  readonly ciphertext: string;
  readonly contentNonce: string;
  readonly contentAadHash: string;
  readonly senderSignature: string;
  readonly keyWrap: DeviceKeyWrap;
}

export interface ReplyResponsePlaintext {
  readonly schemaVersion: 1;
  readonly messageId: string;
  readonly kind: "reply";
  readonly body: string;
  readonly respondedAt: string;
}

export interface ApprovalResponsePlaintext {
  readonly schemaVersion: 1;
  readonly messageId: string;
  readonly kind: "approval";
  readonly decision: "approved" | "rejected";
  readonly note?: string;
  readonly respondedAt: string;
}

export type ResponsePlaintext = ReplyResponsePlaintext | ApprovalResponsePlaintext;

export interface StoredResponseEnvelope {
  readonly schemaVersion: 1;
  readonly responseId: string;
  readonly messageId: string;
  readonly recipientId: string;
  readonly senderId: string;
  readonly deviceId: string;
  readonly kind: ResponseKind;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ciphertext: string;
  readonly contentNonce: string;
  readonly deviceSignature: string;
}

export interface ResponseSubmissionEnvelope {
  readonly schemaVersion: 1;
  readonly responseId: string;
  readonly messageId: string;
  readonly kind: ResponseKind;
  readonly expiresAt: string;
  readonly ciphertext: string;
  readonly contentNonce: string;
  readonly deviceSignature: string;
}

export interface SignedWirePayload {
  readonly schemaVersion: 1;
  readonly domain: string;
  readonly payload: CanonicalJsonValue;
  readonly signature: string;
}

export function isMessageMode(value: string): value is MessageMode {
  return includesString(MESSAGE_MODES, value);
}

export function isDeliveryState(value: string): value is DeliveryState {
  return includesString(DELIVERY_STATES, value);
}

export function isSenderKind(value: string): value is SenderKind {
  return includesString(SENDER_KINDS, value);
}

export function isResponseKind(value: string): value is ResponseKind {
  return includesString(RESPONSE_KINDS, value);
}

function includesString(values: readonly string[], value: string): boolean {
  return values.includes(value);
}
