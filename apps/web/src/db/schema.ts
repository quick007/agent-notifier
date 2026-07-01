import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import type { DeliveryState, MessageMode, ResponseKind, SenderKind } from "@agent-notifier/protocol";

export const recipients = sqliteTable("recipients", {
  id: text("id").primaryKey(),
  primaryEmailId: text("primary_email_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  disabledAt: text("disabled_at"),
});

export const recipientEmails = sqliteTable("recipient_emails", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id").notNull().references(() => recipients.id),
  email: text("email").notNull(),
  normalizedEmail: text("normalized_email").notNull(),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("recipient_emails_normalized_email_idx").on(table.normalizedEmail),
  index("recipient_emails_recipient_id_idx").on(table.recipientId),
]);

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id").notNull().references(() => recipients.id),
  displayName: text("display_name").notNull(),
  encryptionPublicKey: text("encryption_public_key").notNull(),
  signingPublicKey: text("signing_public_key").notNull(),
  pushSubscriptionJson: text("push_subscription_json"),
  pushSubscriptionHash: text("push_subscription_hash"),
  pushEnabledAt: text("push_enabled_at"),
  pushDisabledAt: text("push_disabled_at"),
  lastDeliveredAt: text("last_delivered_at"),
  lastSeenAt: text("last_seen_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  revokedAt: text("revoked_at"),
}, (table) => [
  index("devices_recipient_active_idx").on(table.recipientId, table.revokedAt),
  index("devices_push_subscription_hash_idx").on(table.pushSubscriptionHash),
]);

export const senders = sqliteTable("senders", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id").notNull().references(() => recipients.id),
  displayName: text("display_name").notNull(),
  kind: text("kind").$type<SenderKind>().notNull(),
  appName: text("app_name"),
  machineLabel: text("machine_label"),
  workspaceLabel: text("workspace_label"),
  encryptionPublicKey: text("encryption_public_key").notNull(),
  signingPublicKey: text("signing_public_key").notNull(),
  capabilitiesJson: text("capabilities_json").notNull(),
  previewPolicy: text("preview_policy").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  revokedAt: text("revoked_at"),
  lastUsedAt: text("last_used_at"),
}, (table) => [
  index("senders_recipient_active_idx").on(table.recipientId, table.revokedAt),
  index("senders_signing_public_key_idx").on(table.signingPublicKey),
]);

export const pairingSessions = sqliteTable("pairing_sessions", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["email", "code"] }).notNull(),
  recipientId: text("recipient_id").references(() => recipients.id),
  senderId: text("sender_id").references(() => senders.id),
  emailId: text("email_id").references(() => recipientEmails.id),
  senderDraftJson: text("sender_draft_json"),
  codeHash: text("code_hash"),
  magicLinkSecretHash: text("magic_link_secret_hash"),
  expiresAt: text("expires_at").notNull(),
  claimedAt: text("claimed_at"),
  approvedAt: text("approved_at"),
  rejectedAt: text("rejected_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
}, (table) => [
  index("pairing_sessions_expires_at_idx").on(table.expiresAt),
  index("pairing_sessions_code_hash_idx").on(table.kind, table.codeHash),
  index("pairing_sessions_sender_id_idx").on(table.senderId),
]);

export const messageEnvelopes = sqliteTable("message_envelopes", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id").notNull().references(() => recipients.id),
  senderId: text("sender_id").notNull().references(() => senders.id),
  mode: text("mode").$type<MessageMode>().notNull(),
  state: text("state").$type<DeliveryState>().notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  firstDeliveredAt: text("first_delivered_at"),
  respondedAt: text("responded_at"),
  idempotencyKey: text("idempotency_key"),
  ciphertext: text("ciphertext").notNull(),
  contentNonce: text("content_nonce").notNull(),
  contentAadHash: text("content_aad_hash").notNull(),
  senderSignature: text("sender_signature").notNull(),
  schemaVersion: integer("schema_version").notNull(),
}, (table) => [
  index("message_envelopes_sender_created_idx").on(table.senderId, table.createdAt),
  index("message_envelopes_recipient_state_expiry_idx").on(table.recipientId, table.state, table.expiresAt),
  uniqueIndex("message_envelopes_sender_idempotency_idx").on(table.senderId, table.idempotencyKey),
]);

export const messageKeyWraps = sqliteTable("message_key_wraps", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messageEnvelopes.id),
  deviceId: text("device_id").notNull().references(() => devices.id),
  ephemeralPublicKey: text("ephemeral_public_key").notNull(),
  wrappedKey: text("wrapped_key").notNull(),
  wrapNonce: text("wrap_nonce").notNull(),
  deliveredAt: text("delivered_at"),
  deliveryError: text("delivery_error"),
}, (table) => [
  index("message_key_wraps_device_delivered_idx").on(table.deviceId, table.deliveredAt),
  index("message_key_wraps_message_id_idx").on(table.messageId),
]);

export const responseEnvelopes = sqliteTable("response_envelopes", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messageEnvelopes.id),
  recipientId: text("recipient_id").notNull().references(() => recipients.id),
  senderId: text("sender_id").notNull().references(() => senders.id),
  deviceId: text("device_id").notNull().references(() => devices.id),
  kind: text("kind").$type<ResponseKind>().notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  fetchedAt: text("fetched_at"),
  ciphertext: text("ciphertext").notNull(),
  contentNonce: text("content_nonce").notNull(),
  deviceSignature: text("device_signature").notNull(),
  schemaVersion: integer("schema_version").notNull(),
}, (table) => [
  index("response_envelopes_sender_fetched_idx").on(table.senderId, table.fetchedAt),
  index("response_envelopes_message_id_idx").on(table.messageId),
]);

export const deliveryEvents = sqliteTable("delivery_events", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messageEnvelopes.id),
  deviceId: text("device_id"),
  senderId: text("sender_id").notNull().references(() => senders.id),
  recipientId: text("recipient_id").notNull().references(() => recipients.id),
  event: text("event").notNull(),
  createdAt: text("created_at").notNull(),
  detailsJson: text("details_json"),
}, (table) => [
  index("delivery_events_message_created_idx").on(table.messageId, table.createdAt),
  index("delivery_events_created_at_idx").on(table.createdAt),
]);

export const rateLimitBuckets = sqliteTable("rate_limit_buckets", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  scopeId: text("scope_id").notNull(),
  windowStart: text("window_start").notNull(),
  count: integer("count").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("rate_limit_buckets_scope_window_idx").on(table.scope, table.scopeId, table.windowStart),
]);

export const authNonces = sqliteTable("auth_nonces", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type", { enum: ["sender", "device"] }).notNull(),
  subjectId: text("subject_id").notNull(),
  nonceHash: text("nonce_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("auth_nonces_subject_nonce_idx").on(table.subjectType, table.subjectId, table.nonceHash),
  index("auth_nonces_expires_at_idx").on(table.expiresAt),
]);

export const aggregateCounters = sqliteTable("aggregate_counters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  count: integer("count").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("aggregate_counters_name_idx").on(table.name),
]);
