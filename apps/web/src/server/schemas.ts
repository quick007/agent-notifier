import { z } from "@hono/zod-openapi";
import {
  DELIVERY_STATES,
  MESSAGE_MODES,
  RESPONSE_KINDS,
  SCHEMA_VERSION,
  SENDER_KINDS,
  type ServerVisibleMessageMetadata,
} from "@agent-notifier/protocol";

import { rejectPlaintextContent } from "./validation";

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_-]+$`));

export const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  retryAfterSeconds: z.number().int().positive().optional(),
}).openapi("Error");

export const IsoTimestamp = z.string().datetime().openapi("IsoTimestamp");
export const Base64Url = z.string().min(1).openapi("Base64Url");
export const RecipientId = id("rcp").openapi("RecipientId");
export const DeviceId = id("dev").openapi("DeviceId");
export const SenderId = id("snd").openapi("SenderId");
export const MessageId = id("msg").openapi("MessageId");
export const ResponseId = id("rsp").openapi("ResponseId");
export const PairingSessionId = id("pair").openapi("PairingSessionId");

export const SenderKind = z.enum(SENDER_KINDS).openapi("SenderKind");
export const MessageMode = z.enum(MESSAGE_MODES).openapi("MessageMode");
export const DeliveryState = z.enum(DELIVERY_STATES).openapi("DeliveryState");
export const ResponseKind = z.enum(RESPONSE_KINDS).openapi("ResponseKind");
export const PreviewPolicy = z.enum(["allow_agent_choice", "always_hide", "always_show_non_sensitive"]).openapi("PreviewPolicy");

export const JsonObject = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  try {
    rejectPlaintextContent(value);
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Plaintext content is not allowed.",
    });
  }
});

export const SenderDraftSchema = z.object({
  displayName: z.string().min(1),
  kind: SenderKind,
  appName: z.string().optional(),
  machineLabel: z.string().optional(),
  workspaceLabel: z.string().optional(),
  encryptionPublicKey: Base64Url,
  signingPublicKey: Base64Url,
  capabilities: JsonObject.default({}),
}).openapi("SenderDraft");

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().int().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }).catchall(z.unknown()),
}).catchall(z.unknown()).openapi("PushSubscription");

export const DeviceRegistrationRequestSchema = z.object({
  recipientId: RecipientId.optional(),
  pairingSessionId: PairingSessionId.optional(),
  pairingSecret: Base64Url.optional(),
  device: z.object({
    displayName: z.string().min(1),
    encryptionPublicKey: Base64Url,
    signingPublicKey: Base64Url,
    pushSubscription: PushSubscriptionSchema.optional(),
  }).strict(),
}).superRefine((value, ctx) => {
  if (value.recipientId && (!value.pairingSessionId || !value.pairingSecret)) {
    ctx.addIssue({
      code: "custom",
      message: "recipientId requires pairingSessionId and pairingSecret.",
    });
  }
}).strict().openapi("DeviceRegistrationRequest");

export const PairingEmailStartRequestSchema = z.object({
  email: z.string().email(),
  sender: SenderDraftSchema,
  requestedExpirySeconds: z.number().int().min(60).max(86400).optional(),
}).openapi("PairingEmailStartRequest");

export const CodePairingClaimRequestSchema = z.object({
  code: z.string().min(1),
  secret: Base64Url,
  sender: SenderDraftSchema,
}).openapi("CodePairingClaimRequest");

export const PairingApproveRequestSchema = z.object({
  secret: Base64Url.optional(),
}).openapi("PairingApproveRequest");

export const MessageMetadataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  messageId: MessageId,
  recipientId: RecipientId,
  senderId: SenderId,
  mode: MessageMode,
  createdAt: IsoTimestamp,
  expiresAt: IsoTimestamp,
  idempotencyKey: z.string().optional(),
}).openapi("MessageMetadata");

export const DeviceKeyWrapSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  deviceId: DeviceId,
  ephemeralPublicKey: Base64Url,
  wrappedKey: Base64Url,
  wrapNonce: Base64Url,
}).openapi("DeviceKeyWrap");

export const MessageSubmissionRequestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  metadata: MessageMetadataSchema,
  ciphertext: Base64Url,
  contentNonce: Base64Url,
  contentAadHash: Base64Url,
  keyWraps: z.array(DeviceKeyWrapSchema).min(1),
  senderSignature: Base64Url,
}).superRefine((value, ctx) => {
  if (value.metadata.schemaVersion !== undefined && value.metadata.schemaVersion !== value.schemaVersion) {
    ctx.addIssue({ code: "custom", message: "metadata.schemaVersion must match schemaVersion." });
  }
}).openapi("MessageSubmissionRequest");

export const ResponseSubmissionRequestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  responseId: ResponseId,
  kind: ResponseKind,
  expiresAt: IsoTimestamp,
  ciphertext: Base64Url,
  contentNonce: Base64Url,
  deviceSignature: Base64Url,
}).openapi("ResponseSubmissionRequest");

export const PushSubscriptionUpdateRequestSchema = z.object({
  pushSubscription: PushSubscriptionSchema.nullable(),
}).openapi("PushSubscriptionUpdateRequest");

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("agent-notifier-web"),
}).openapi("HealthResponse");

export const PairingSessionResponseSchema = z.object({
  sessionId: PairingSessionId,
  expiresAt: IsoTimestamp,
  status: z.enum(["pending", "claimed"]),
}).openapi("PairingSessionResponse");

export const PairingStatusResponseSchema = z.object({
  status: z.enum(["not_found", "expired", "paired", "claimed", "pending"]),
  expiresAt: IsoTimestamp.optional(),
  senderId: SenderId.optional(),
  recipientId: RecipientId.optional(),
  sender: SenderDraftSchema.optional(),
  devices: z.array(z.object({
    deviceId: DeviceId,
    encryptionPublicKey: Base64Url,
    signingPublicKey: Base64Url,
  })).optional(),
}).openapi("PairingStatusResponse");

export const CodePairingStartResponseSchema = z.object({
  sessionId: PairingSessionId,
  code: z.string(),
  secret: Base64Url,
  expiresAt: IsoTimestamp,
}).openapi("CodePairingStartResponse");

export const PairingApproveResponseSchema = z.object({
  senderId: SenderId,
  recipientId: RecipientId,
  status: z.literal("paired"),
}).openapi("PairingApproveResponse");

export const IdResponseSchema = z.object({
  recipientId: RecipientId,
  deviceId: DeviceId,
}).openapi("IdResponse");

export const MessageStateResponseSchema = z.object({
  messageId: MessageId,
  state: DeliveryState,
}).openapi("MessageStateResponse");

export const PushConfigResponseSchema = z.object({
  publicKey: z.string().nullable(),
  configured: z.boolean(),
}).openapi("PushConfigResponse");

export const PushSubscriptionUpdateResponseSchema = z.object({
  deviceId: DeviceId,
  pushEnabled: z.boolean(),
}).openapi("PushSubscriptionUpdateResponse");

export const SenderTargetResponseSchema = z.object({
  senderId: SenderId,
  recipientId: RecipientId,
  devices: z.array(z.object({
    deviceId: DeviceId,
    encryptionPublicKey: Base64Url,
    signingPublicKey: Base64Url,
  })),
}).openapi("SenderTargetResponse");

export const PendingMessageSchema = z.object({
  messageId: MessageId,
  metadata: MessageMetadataSchema,
  ciphertext: Base64Url,
  contentNonce: Base64Url,
  contentAadHash: Base64Url,
  senderSignature: Base64Url,
  sender: z.object({
    senderId: SenderId,
    displayName: z.string(),
    kind: SenderKind,
    encryptionPublicKey: Base64Url,
    signingPublicKey: Base64Url,
  }),
  keyWraps: z.array(DeviceKeyWrapSchema).min(1),
  keyWrap: DeviceKeyWrapSchema,
}).openapi("PendingMessage");

export const PendingMessagesResponseSchema = z.object({ messages: z.array(PendingMessageSchema) }).openapi("PendingMessagesResponse");

export const DeviceSenderSchema = z.object({
  id: SenderId,
  displayName: z.string(),
  kind: SenderKind,
  appName: z.string().nullable(),
  machineLabel: z.string().nullable(),
  workspaceLabel: z.string().nullable(),
  encryptionPublicKey: Base64Url,
  previewPolicy: PreviewPolicy,
  createdAt: IsoTimestamp,
  revokedAt: IsoTimestamp.nullable(),
  lastUsedAt: IsoTimestamp.nullable(),
}).openapi("DeviceSender");

export const DeviceSendersResponseSchema = z.object({ senders: z.array(DeviceSenderSchema) }).openapi("DeviceSendersResponse");

export const AnyJsonResponseSchema = z.record(z.string(), z.unknown()).openapi("JsonResponse");

export type SenderDraft = z.infer<typeof SenderDraftSchema>;
export type DeviceRegistration = {
  readonly recipientId?: string;
  readonly pairingSessionId?: string;
  readonly pairingSecret?: string;
  readonly displayName: string;
  readonly encryptionPublicKey: string;
  readonly signingPublicKey: string;
  readonly pushSubscription?: Record<string, unknown>;
};
export type MessageSubmission = ReturnType<typeof toMessageSubmission>;
export type ResponseSubmission = z.infer<typeof ResponseSubmissionRequestSchema>;
export type MessageMetadata = z.infer<typeof MessageMetadataSchema> & ServerVisibleMessageMetadata;

export function toDeviceRegistration(input: z.infer<typeof DeviceRegistrationRequestSchema>): DeviceRegistration {
  return {
    ...(input.recipientId === undefined ? {} : { recipientId: input.recipientId }),
    ...(input.pairingSessionId === undefined ? {} : { pairingSessionId: input.pairingSessionId }),
    ...(input.pairingSecret === undefined ? {} : { pairingSecret: input.pairingSecret }),
    displayName: input.device.displayName,
    encryptionPublicKey: input.device.encryptionPublicKey,
    signingPublicKey: input.device.signingPublicKey,
    ...(input.device.pushSubscription === undefined ? {} : { pushSubscription: input.device.pushSubscription }),
  };
}

export function toMessageSubmission(input: z.infer<typeof MessageSubmissionRequestSchema>) {
  return {
    schemaVersion: input.schemaVersion,
    messageId: input.metadata.messageId,
    recipientId: input.metadata.recipientId,
    senderId: input.metadata.senderId,
    mode: input.metadata.mode,
    createdAt: input.metadata.createdAt,
    expiresAt: input.metadata.expiresAt,
    ciphertext: input.ciphertext,
    contentNonce: input.contentNonce,
    contentAadHash: input.contentAadHash,
    keyWraps: input.keyWraps,
    senderSignature: input.senderSignature,
    ...(input.metadata.idempotencyKey === undefined ? {} : { idempotencyKey: input.metadata.idempotencyKey }),
  };
}
