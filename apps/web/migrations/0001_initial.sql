CREATE TABLE `recipients` (
  `id` text PRIMARY KEY NOT NULL,
  `primary_email_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `disabled_at` text
);
CREATE TABLE `recipient_emails` (
  `id` text PRIMARY KEY NOT NULL,
  `recipient_id` text NOT NULL REFERENCES `recipients`(`id`),
  `email` text NOT NULL,
  `normalized_email` text NOT NULL,
  `verified_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE UNIQUE INDEX `recipient_emails_normalized_email_idx` ON `recipient_emails` (`normalized_email`);
CREATE INDEX `recipient_emails_recipient_id_idx` ON `recipient_emails` (`recipient_id`);
CREATE TABLE `devices` (
  `id` text PRIMARY KEY NOT NULL,
  `recipient_id` text NOT NULL REFERENCES `recipients`(`id`),
  `display_name` text NOT NULL,
  `encryption_public_key` text NOT NULL,
  `signing_public_key` text NOT NULL,
  `push_subscription_json` text,
  `push_subscription_hash` text,
  `push_enabled_at` text,
  `push_disabled_at` text,
  `last_delivered_at` text,
  `last_seen_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `revoked_at` text
);
CREATE INDEX `devices_recipient_active_idx` ON `devices` (`recipient_id`, `revoked_at`);
CREATE INDEX `devices_push_subscription_hash_idx` ON `devices` (`push_subscription_hash`);
CREATE TABLE `senders` (
  `id` text PRIMARY KEY NOT NULL,
  `recipient_id` text NOT NULL REFERENCES `recipients`(`id`),
  `display_name` text NOT NULL,
  `kind` text NOT NULL,
  `app_name` text,
  `machine_label` text,
  `workspace_label` text,
  `encryption_public_key` text NOT NULL,
  `signing_public_key` text NOT NULL,
  `capabilities_json` text NOT NULL,
  `preview_policy` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `revoked_at` text,
  `last_used_at` text
);
CREATE INDEX `senders_recipient_active_idx` ON `senders` (`recipient_id`, `revoked_at`);
CREATE INDEX `senders_signing_public_key_idx` ON `senders` (`signing_public_key`);
CREATE TABLE `pairing_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `recipient_id` text REFERENCES `recipients`(`id`),
  `email_id` text REFERENCES `recipient_emails`(`id`),
  `sender_draft_json` text,
  `code_hash` text,
  `magic_link_secret_hash` text,
  `expires_at` text NOT NULL,
  `claimed_at` text,
  `approved_at` text,
  `rejected_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `attempt_count` integer DEFAULT 0 NOT NULL
);
CREATE INDEX `pairing_sessions_expires_at_idx` ON `pairing_sessions` (`expires_at`);
CREATE INDEX `pairing_sessions_code_hash_idx` ON `pairing_sessions` (`kind`, `code_hash`);
CREATE TABLE `message_envelopes` (
  `id` text PRIMARY KEY NOT NULL,
  `recipient_id` text NOT NULL REFERENCES `recipients`(`id`),
  `sender_id` text NOT NULL REFERENCES `senders`(`id`),
  `mode` text NOT NULL,
  `state` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `first_delivered_at` text,
  `responded_at` text,
  `idempotency_key` text,
  `ciphertext` text NOT NULL,
  `content_nonce` text NOT NULL,
  `content_aad_hash` text NOT NULL,
  `sender_signature` text NOT NULL,
  `schema_version` integer NOT NULL
);
CREATE INDEX `message_envelopes_sender_created_idx` ON `message_envelopes` (`sender_id`, `created_at`);
CREATE INDEX `message_envelopes_recipient_state_expiry_idx` ON `message_envelopes` (`recipient_id`, `state`, `expires_at`);
CREATE UNIQUE INDEX `message_envelopes_sender_idempotency_idx` ON `message_envelopes` (`sender_id`, `idempotency_key`);
CREATE TABLE `message_key_wraps` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL REFERENCES `message_envelopes`(`id`),
  `device_id` text NOT NULL REFERENCES `devices`(`id`),
  `ephemeral_public_key` text NOT NULL,
  `wrapped_key` text NOT NULL,
  `wrap_nonce` text NOT NULL,
  `delivered_at` text,
  `delivery_error` text
);
CREATE INDEX `message_key_wraps_device_delivered_idx` ON `message_key_wraps` (`device_id`, `delivered_at`);
CREATE INDEX `message_key_wraps_message_id_idx` ON `message_key_wraps` (`message_id`);
CREATE TABLE `response_envelopes` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL REFERENCES `message_envelopes`(`id`),
  `recipient_id` text NOT NULL REFERENCES `recipients`(`id`),
  `sender_id` text NOT NULL REFERENCES `senders`(`id`),
  `device_id` text NOT NULL REFERENCES `devices`(`id`),
  `kind` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `fetched_at` text,
  `ciphertext` text NOT NULL,
  `content_nonce` text NOT NULL,
  `device_signature` text NOT NULL,
  `schema_version` integer NOT NULL
);
CREATE INDEX `response_envelopes_sender_fetched_idx` ON `response_envelopes` (`sender_id`, `fetched_at`);
CREATE INDEX `response_envelopes_message_id_idx` ON `response_envelopes` (`message_id`);
CREATE TABLE `delivery_events` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL REFERENCES `message_envelopes`(`id`),
  `device_id` text,
  `sender_id` text NOT NULL REFERENCES `senders`(`id`),
  `recipient_id` text NOT NULL REFERENCES `recipients`(`id`),
  `event` text NOT NULL,
  `created_at` text NOT NULL,
  `details_json` text
);
CREATE INDEX `delivery_events_message_created_idx` ON `delivery_events` (`message_id`, `created_at`);
CREATE INDEX `delivery_events_created_at_idx` ON `delivery_events` (`created_at`);
CREATE TABLE `rate_limit_buckets` (
  `id` text PRIMARY KEY NOT NULL,
  `scope` text NOT NULL,
  `scope_id` text NOT NULL,
  `window_start` text NOT NULL,
  `count` integer NOT NULL,
  `updated_at` text NOT NULL
);
CREATE UNIQUE INDEX `rate_limit_buckets_scope_window_idx` ON `rate_limit_buckets` (`scope`, `scope_id`, `window_start`);
CREATE TABLE `auth_nonces` (
  `id` text PRIMARY KEY NOT NULL,
  `subject_type` text NOT NULL,
  `subject_id` text NOT NULL,
  `nonce_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL
);
CREATE UNIQUE INDEX `auth_nonces_subject_nonce_idx` ON `auth_nonces` (`subject_type`, `subject_id`, `nonce_hash`);
CREATE INDEX `auth_nonces_expires_at_idx` ON `auth_nonces` (`expires_at`);
CREATE TABLE `aggregate_counters` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `count` integer NOT NULL,
  `updated_at` text NOT NULL
);
CREATE UNIQUE INDEX `aggregate_counters_name_idx` ON `aggregate_counters` (`name`);
