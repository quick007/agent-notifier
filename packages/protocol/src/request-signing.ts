import { DOMAINS } from "./domains.js";
import { canonicalSigningBytes, canonicalSigningText } from "./signing.js";

export const REQUEST_SUBJECT_TYPES = ["sender", "device"] as const;

export type RequestSubjectType = (typeof REQUEST_SUBJECT_TYPES)[number];

export const SIGNED_REQUEST_HEADERS = {
  senderId: "x-agent-notifier-sender-id",
  deviceId: "x-agent-notifier-device-id",
  signature: "x-agent-notifier-signature",
  timestamp: "x-agent-notifier-timestamp",
  nonce: "x-agent-notifier-nonce",
} as const;

export type SignedRequestHeaderName = (typeof SIGNED_REQUEST_HEADERS)[keyof typeof SIGNED_REQUEST_HEADERS];

export interface RequestSigningInput {
  readonly method: string;
  readonly path: string;
  readonly bodySha256: string;
  readonly timestamp: string;
  readonly nonce: string;
  readonly subjectType: RequestSubjectType;
  readonly subjectId: string;
}

export function canonicalRequestText(input: RequestSigningInput): string {
  return canonicalSigningText({
    domain: DOMAINS.REQUEST_V1,
    payload: {
      schemaVersion: 1,
      method: input.method.toUpperCase(),
      path: input.path,
      bodySha256: input.bodySha256,
      timestamp: input.timestamp,
      nonce: input.nonce,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
  });
}

export function canonicalRequestBytes(input: RequestSigningInput): Uint8Array {
  return canonicalSigningBytes({
    domain: DOMAINS.REQUEST_V1,
    payload: {
      schemaVersion: 1,
      method: input.method.toUpperCase(),
      path: input.path,
      bodySha256: input.bodySha256,
      timestamp: input.timestamp,
      nonce: input.nonce,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
  });
}
