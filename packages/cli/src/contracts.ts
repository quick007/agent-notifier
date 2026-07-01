import type { DeliveryState, MessageMode, SenderKind } from "@agent-notifier/protocol";

export type { DeliveryState, MessageMode, SenderKind } from "@agent-notifier/protocol";
export {
  DELIVERY_STATES,
  SENDER_KINDS,
  isDeliveryState,
  isSenderKind,
} from "@agent-notifier/protocol";

export interface SenderRecord {
  id: string;
  displayName: string;
  kind: SenderKind;
  createdAt: string;
  revokedAt?: string;
  recipientId?: string;
  pairingSessionId?: string;
  pairingSecret?: string;
  encryptionPublicKey?: string;
  signingPublicKey?: string;
  encryptionPrivateKeyPkcs8?: string;
  signingPrivateKeyPkcs8?: string;
  keyStorageWarning?: string;
}

export interface LocalMessageRecord {
  id: string;
  senderId: string;
  mode: MessageMode;
  state: DeliveryState;
  createdAt: string;
  expiresAt: string;
  dedupeKey: string;
  idempotencyKey?: string;
  responseRef?: string;
  targetDevices?: MessageTargetDevice[];
}

export interface MessageTargetDevice {
  deviceId: string;
  signingPublicKey: string;
}

export interface SetupInput {
  email?: string;
  code?: string;
  secret?: string;
  senderName?: string;
  senderKind?: SenderKind;
  apiUrl?: string;
  localOnly?: boolean;
}

export interface SendInput {
  mode: MessageMode;
  title: string;
  body: string;
  sensitive: boolean;
  senderName?: string;
  expiresInMs?: number;
  idempotencyKey?: string;
  actionLabel?: string;
  prompt?: string;
  risk?: string;
}

export interface WaitInput {
  messageId: string;
  state: DeliveryState;
  timeoutMs: number;
  intervalMs: number;
}

export type AgentNotifierResponse =
  | {
    responseId: string;
    messageId: string;
    deviceId: string;
    kind: "reply";
    body: string;
    respondedAt: string;
  }
  | {
    responseId: string;
    messageId: string;
    deviceId: string;
    kind: "approval";
    decision: "approved" | "rejected";
    note?: string;
    respondedAt: string;
  };

export interface AgentNotifierResult {
  ok: boolean;
  kind: string;
  at: string;
  transport: "local_config" | "http_api";
  state?: string;
  messageId?: string;
  senderId?: string;
  recipientId?: string;
  sessionId?: string;
  expiresAt?: string;
  serverAccepted?: boolean;
  apiUrl?: string;
  responseRef?: string;
  response?: AgentNotifierResponse;
  senders?: SenderRecord[];
  warning?: string;
  error?: {
    code: string;
    message: string;
  };
  next?: string;
}

export interface StoredState {
  version: 1;
  apiBaseUrl?: string;
  senders: SenderRecord[];
  messages: LocalMessageRecord[];
}
