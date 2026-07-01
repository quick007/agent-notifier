export type Route =
  | "/"
  | "/setup"
  | "/setup/pair"
  | `/setup/pair/${string}`
  | "/inbox"
  | "/saved"
  | "/senders"
  | `/senders/${string}`
  | "/settings"
  | "/settings/notifications"
  | "/privacy"
  | "/terms"
  | "/security"
  | `/message/${string}`;

export type MessageMode = "notify" | "request_reply" | "request_approval";
export type DeliveryState = "delivered" | "responded" | "expired";
export type PreviewPolicy = "agent_choice" | "hide_sensitive" | "always_hide";
export type SenderKind = "codex" | "claude" | "ci" | "generic";
export type PushState =
  | "unsupported"
  | "default"
  | "granted"
  | "granted_missing_subscription"
  | "denied"
  | "ios_not_installed"
  | "paired_no_push"
  | "service_worker_error";

export type PairingStatus =
  | "idle"
  | "starting"
  | "code_ready"
  | "email_link"
  | "pending"
  | "claimed"
  | "approving"
  | "paired"
  | "expired"
  | "error";

export type DeviceIdentity = {
  localId: string;
  recipientId?: string;
  deviceId?: string;
  displayName: string;
  encryptionPublicKey: string;
  signingPublicKey: string;
  encryptionPrivateKey: JsonWebKey;
  signingPrivateKey: JsonWebKey;
  createdAt: string;
};

export type PairingState = {
  status: PairingStatus;
  kind?: "code" | "email";
  sessionId?: string;
  secret?: string;
  code?: string;
  expiresAt?: string;
  senderDisplayName?: string;
  error?: string;
};

export type Sender = {
  id: string;
  displayName: string;
  kind: SenderKind;
  machineLabel: string;
  lastUsedAt: string;
  previewPolicy: PreviewPolicy;
  revokedAt?: string;
  capabilities: {
    notify: boolean;
    requestReply: boolean;
    requestApproval: boolean;
  };
};

export type Message = {
  id: string;
  senderId: string;
  mode: MessageMode;
  title: string;
  body: string;
  sensitive: boolean;
  createdAt: string;
  expiresAt?: string;
  deliveryState: DeliveryState;
  saved: boolean;
  deleted: boolean;
  request?: {
    actionLabel?: string;
    riskText?: string;
    prompt?: string;
  };
  response?: {
    kind: "reply" | "approval";
    decision?: "approved" | "rejected";
    text?: string;
    respondedAt: string;
  };
};

export type Settings = {
  deviceReady: boolean;
  deviceName: string;
  email?: string;
  globalPreviewPolicy: PreviewPolicy;
  localRetentionDays: 7 | 30 | 90;
  pushState: PushState;
  pairing: PairingState;
  vapidPublicKey?: string;
};

export type AppState = {
  settings: Settings;
  device?: DeviceIdentity;
  senders: Sender[];
  messages: Message[];
};
