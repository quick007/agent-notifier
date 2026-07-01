import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { devices, messageKeyWraps, senders } from "../../db/schema";
import { listSendersForDevice, pendingMessages } from "./device-service";

const mocks = vi.hoisted(() => ({
  requireDatabase: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  requireDatabase: mocks.requireDatabase,
}));

describe("pendingMessages", () => {
  let db: FakeDeviceDatabase;

  beforeEach(() => {
    db = new FakeDeviceDatabase();
    mocks.requireDatabase.mockReturnValue(db);
  });

  it("returns the current device wrap and the full signed key-wrap set", async () => {
    const messages = await pendingMessages(env(), "dev_a");

    expect(messages).toHaveLength(1);
    expect(messages[0]!.keyWrap.deviceId).toBe("dev_a");
    expect(messages[0]!.keyWraps.map((wrap) => wrap.deviceId)).toEqual(["dev_a", "dev_b"]);
    expect(messages[0]!.sender.signingPublicKey).toBe("sender_signing_public_key");
  });

  it("returns sender encryption public keys for response encryption", async () => {
    const result = await listSendersForDevice(env(), "dev_a");

    expect(result.senders).toHaveLength(1);
    expect(result.senders[0]!.id).toBe("snd_test");
    expect(result.senders[0]!.encryptionPublicKey).toBe("sender_encryption_public_key");
  });
});

class FakeDeviceDatabase {
  readonly deviceRows = [deviceRow("dev_a")];
  readonly senderRows = [senderRow()];
  readonly deliveryRows = [{
    wrap: wrapRow("dev_a"),
    message: messageRow(),
    sender: senderRow(),
  }];
  readonly wrapRows = [wrapRow("dev_b"), wrapRow("dev_a")];

  select(selection?: unknown) {
    return {
      from: (table: unknown) => {
        const rows = this.selectedRows(table, selection);
        return query(rows);
      },
    };
  }

  private selectedRows(table: unknown, selection: unknown): unknown[] {
    if (table === devices) return this.deviceRows;
    if (table === senders) return this.senderRows;
    if (table === messageKeyWraps && hasSelectionKey(selection, "wrap")) return this.deliveryRows;
    return this.wrapRows;
  }
}

function query(rows: unknown[]) {
  const chain = {
    innerJoin: () => chain,
    where: () => chain,
    limit: () => chain,
    all: async () => rows,
  };
  return chain;
}

function hasSelectionKey(selection: unknown, key: string): boolean {
  return Boolean(selection && typeof selection === "object" && key in selection);
}

function messageRow() {
  return {
    id: "msg_test",
    recipientId: "rcp_test",
    senderId: "snd_test",
    mode: "notify" as const,
    state: "accepted" as const,
    createdAt: "2026-07-01T00:00:00.000Z",
    expiresAt: "2999-07-01T00:30:00.000Z",
    firstDeliveredAt: null,
    respondedAt: null,
    idempotencyKey: null,
    ciphertext: "ciphertext",
    contentNonce: "content_nonce",
    contentAadHash: "content_aad_hash",
    senderSignature: "sender_signature",
    schemaVersion: 1,
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

function wrapRow(deviceId: string) {
  return {
    id: `wrap_${deviceId}`,
    messageId: "msg_test",
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
