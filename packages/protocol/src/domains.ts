export const SCHEMA_VERSION = 1;

export const DOMAINS = {
  MESSAGE_V1: "agent-notifier/message/v1",
  MESSAGE_CONTENT_AAD_V1: "agent-notifier/message-content-aad/v1",
  RESPONSE_V1: "agent-notifier/response/v1",
  PAIRING_V1: "agent-notifier/pairing/v1",
  REQUEST_V1: "agent-notifier/request/v1",
  KEY_WRAP_V1: "agent-notifier/key-wrap/v1",
} as const;

export type ProtocolDomain = (typeof DOMAINS)[keyof typeof DOMAINS];
