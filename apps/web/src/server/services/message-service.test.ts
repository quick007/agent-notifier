import {
  exportPublicKeySpki,
  generateSigningKeyPair,
  sha256Base64Url,
  signP256Sha256,
} from "@agent-notifier/crypto";
import {
  messageContentAadBytes,
  messageEnvelopeSigningBytes,
  responseEnvelopeSigningBytes,
  type DeviceKeyWrap,
  type ServerVisibleMessageMetadata,
} from "@agent-notifier/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { deliveryEvents, devices, messageEnvelopes, messageKeyWraps, responseEnvelopes, senders } from "../../db/schema";
import { MessageSubmissionRequestSchema, type ResponseSubmission, toMessageSubmission } from "../schemas";
import { createMessage, submitResponse } from "./message-service";

const mocks = vi.hoisted(() => ({
  requireDatabase: vi.fn(),
  sendPushWakeups: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  requireDatabase: mocks.requireDatabase,
}));

vi.mock("./push-service", () => ({
  sendPushWakeups: mocks.sendPushWakeups,
}));

describe("message service envelope integrity", () => {
  let db: FakeMessageDatabase;

  beforeEach(() => {
    db = new FakeMessageDatabase();
    mocks.requireDatabase.mockReturnValue(db);
    mocks.sendPushWakeups.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects message submissions with mismatched content AAD hashes before insert", async () => {
    const signed = await signedMessage({ contentAadHash: "bad_hash" });
    db.senderRows[0]!.signingPublicKey = signed.senderPublicKey;

    await expect(createMessage(env(), waitCtx(), signed.input)).rejects.toThrow("contentAadHash must match message metadata.");
    expect(db.messageRows).toHaveLength(0);
    expect(db.wrapRows).toHaveLength(0);
  });

  it("rejects message submissions with invalid sender envelope signatures before insert", async () => {
    const signed = await signedMessage();
    db.senderRows[0]!.signingPublicKey = signed.senderPublicKey;

    await expect(createMessage(env(), waitCtx(), {
      ...signed.input,
      senderSignature: "bad_signature",
    })).rejects.toThrow("Message envelope sender signature is invalid.");
    expect(db.messageRows).toHaveLength(0);
    expect(db.wrapRows).toHaveLength(0);
  });

  it("rejects response submissions with invalid device envelope signatures before insert", async () => {
    const deviceKeys = await generateSigningKeyPair({ extractable: true });
    db.deviceRows[0]!.signingPublicKey = await exportPublicKeySpki(deviceKeys.publicKey);
    db.messageRows.push(messageRow());
    db.wrapRows.push(wrapRow("dev_a", "msg_test"));
    const response = await signedResponse(deviceKeys.privateKey);

    await expect(submitResponse(env(), "dev_a", "rcp_test", "msg_test", {
      ...response,
      deviceSignature: "bad_signature",
    })).rejects.toThrow("Response envelope device signature is invalid.");
    expect(db.responseRows).toHaveLength(0);
  });
});

class FakeMessageDatabase {
  readonly senderRows = [senderRow()];
  readonly deviceRows = [deviceRow("dev_a"), deviceRow("dev_b")];
  readonly messageRows: Array<ReturnType<typeof messageRow> | Record<string, unknown>> = [];
  readonly wrapRows: Array<ReturnType<typeof wrapRow> | Record<string, unknown>> = [];
  readonly responseRows: Record<string, unknown>[] = [];
  readonly eventRows: Record<string, unknown>[] = [];

  select(selection?: unknown) {
    return { from: (table: unknown) => query(this.selectedRows(table, selection)) };
  }

  insert(table: unknown) {
    return {
      values: (value: Record<string, unknown> | Record<string, unknown>[]) => ({
        run: async () => {
          const rows = Array.isArray(value) ? value : [value];
          if (table === messageEnvelopes) this.messageRows.push(...rows);
          if (table === messageKeyWraps) this.wrapRows.push(...rows);
          if (table === responseEnvelopes) this.responseRows.push(...rows);
          if (table === deliveryEvents) this.eventRows.push(...rows);
          return { success: true };
        },
      }),
    };
  }

  update() {
    return { set: () => ({ where: () => ({ run: async () => ({ success: true }) }) }) };
  }

  private selectedRows(table: unknown, selection: unknown): unknown[] {
    if (table === senders) return this.senderRows;
    if (table === devices) {
      return hasSelectionKey(selection, "deviceId")
        ? this.deviceRows.map((row) => ({ deviceId: row.id, pushSubscriptionJson: row.pushSubscriptionJson }))
        : this.deviceRows;
    }
    if (table === messageEnvelopes) return this.messageRows;
    if (table === messageKeyWraps) return this.wrapRows;
    return [];
  }
}

function query(rows: unknown[]) {
  const chain = {
    where: () => chain,
    limit: () => chain,
    all: async () => rows,
  };
  return chain;
}

function hasSelectionKey(selection: unknown, key: string): boolean {
  return Boolean(selection && typeof selection === "object" && key in selection);
}

async function signedMessage(options: { readonly contentAadHash?: string } = {}) {
  const keys = await generateSigningKeyPair({ extractable: true });
  const metadata = messageMetadata();
  const contentAadHash = options.contentAadHash ?? await sha256Base64Url(owned(messageContentAadBytes(metadata)));
  const envelope = {
    schemaVersion: 1 as const,
    metadata,
    ciphertext: "ciphertext",
    contentNonce: "content_nonce",
    contentAadHash,
    keyWraps: [keyWrap("dev_b"), keyWrap("dev_a")],
  };
  const senderSignature = await signP256Sha256(keys.privateKey, owned(messageEnvelopeSigningBytes(envelope)));
  const request = MessageSubmissionRequestSchema.parse({ ...envelope, senderSignature });
  return {
    input: toMessageSubmission(request),
    senderPublicKey: await exportPublicKeySpki(keys.publicKey),
  };
}

async function signedResponse(privateKey: CryptoKey): Promise<ResponseSubmission> {
  const body = {
    schemaVersion: 1 as const,
    responseId: "rsp_test",
    kind: "reply" as const,
    expiresAt: "2999-07-01T00:30:00.000Z",
    ciphertext: "ciphertext",
    contentNonce: "content_nonce",
  };
  return {
    ...body,
    deviceSignature: await signP256Sha256(privateKey, owned(responseEnvelopeSigningBytes({ ...body, messageId: "msg_test" }))),
  };
}

function messageMetadata(): ServerVisibleMessageMetadata {
  return {
    schemaVersion: 1,
    messageId: "msg_test",
    recipientId: "rcp_test",
    senderId: "snd_test",
    mode: "request_reply",
    createdAt: "2026-07-01T00:00:00.000Z",
    expiresAt: "2999-07-01T00:30:00.000Z",
  };
}

function keyWrap(deviceId: string): DeviceKeyWrap {
  return {
    schemaVersion: 1,
    deviceId,
    ephemeralPublicKey: `ephemeral_${deviceId}`,
    wrappedKey: `wrapped_${deviceId}`,
    wrapNonce: `nonce_${deviceId}`,
  };
}

function senderRow() {
  return {
    id: "snd_test",
    recipientId: "rcp_test",
    displayName: "Test sender",
    kind: "generic" as const,
    appName: null,
    machineLabel: null,
    workspaceLabel: null,
    encryptionPublicKey: "sender_encryption_public_key",
    signingPublicKey: "sender_signing_public_key",
    capabilitiesJson: "{}",
    previewPolicy: "allow_agent_choice",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    revokedAt: null,
    lastUsedAt: null,
  };
}

function deviceRow(id: string) {
  return {
    id,
    recipientId: "rcp_test",
    displayName: "Phone",
    encryptionPublicKey: "device_encryption_public_key",
    signingPublicKey: "device_signing_public_key",
    pushSubscriptionJson: null,
    pushSubscriptionHash: null,
    pushEnabledAt: null,
    pushDisabledAt: null,
    lastDeliveredAt: null,
    lastSeenAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    revokedAt: null,
  };
}

function messageRow() {
  return {
    ...messageMetadata(),
    id: "msg_test",
    state: "accepted" as const,
    firstDeliveredAt: null,
    respondedAt: null,
    idempotencyKey: null,
    ciphertext: "ciphertext",
    contentNonce: "content_nonce",
    contentAadHash: "content_aad_hash",
    senderSignature: "sender_signature",
  };
}

function wrapRow(deviceId: string, messageId: string) {
  return {
    id: `wrap_${deviceId}`,
    messageId,
    deviceId,
    ephemeralPublicKey: `ephemeral_${deviceId}`,
    wrappedKey: `wrapped_${deviceId}`,
    wrapNonce: `nonce_${deviceId}`,
    deliveredAt: null,
    deliveryError: null,
  };
}

function env(): Env {
  return { DB: {} as D1Database };
}

function waitCtx() {
  return { waitUntil: vi.fn() };
}

function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}
