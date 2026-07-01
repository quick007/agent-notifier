import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { pairingSessions, recipientEmails, recipients } from "../../db/schema";
import type { SenderDraft } from "../schemas";
import { startEmailPairing } from "./pairing-service";

const mocks = vi.hoisted(() => ({
  requireDatabase: vi.fn(),
  sendSetupEmail: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  requireDatabase: mocks.requireDatabase,
}));

vi.mock("./resend-service", () => ({
  sendSetupEmail: mocks.sendSetupEmail,
}));

describe("startEmailPairing", () => {
  let db: FakePairingDatabase;

  beforeEach(() => {
    db = new FakePairingDatabase();
    mocks.requireDatabase.mockReturnValue(db);
    mocks.sendSetupEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates fresh sessions while reusing an existing normalized email", async () => {
    const first = await startEmailPairing(env(), {
      email: "Luseufert5@Gmail.com",
      sender: senderDraft("Codex"),
    }, "https://agent-notifier.test");
    const second = await startEmailPairing(env(), {
      email: " luseufert5@gmail.com ",
      sender: senderDraft("Codex retry"),
    }, "https://agent-notifier.test");

    expect(first.sessionId).not.toBe(second.sessionId);
    expect(db.recipientRows).toHaveLength(1);
    expect(db.emailRows).toHaveLength(1);
    expect(db.sessionRows).toHaveLength(2);
    expect(db.sessionRows[0]?.recipientId).toBe(db.sessionRows[1]?.recipientId);
    expect(db.sessionRows[0]?.emailId).toBe(db.sessionRows[1]?.emailId);
    expect(db.sessionRows[0]?.magicLinkSecretHash).not.toBe(db.sessionRows[1]?.magicLinkSecretHash);
    expect(mocks.sendSetupEmail).toHaveBeenCalledTimes(2);
  });
});

class FakePairingDatabase {
  readonly recipientRows: Array<typeof recipients.$inferInsert> = [];
  readonly emailRows: Array<typeof recipientEmails.$inferInsert> = [];
  readonly sessionRows: Array<typeof pairingSessions.$inferInsert> = [];

  select() {
    return {
      from: (table: unknown) => ({
        where: () => ({
          limit: () => ({
            all: async () => {
              if (table !== recipientEmails) return [];
              return this.emailRows.map((row) => ({
                id: row.id,
                recipientId: row.recipientId,
              }));
            },
          }),
        }),
      }),
    };
  }

  insert(table: unknown) {
    return {
      values: (value: Record<string, unknown>) => ({
        run: async () => {
          if (table === recipients) this.recipientRows.push(value as typeof recipients.$inferInsert);
          if (table === recipientEmails) this.insertEmail(value as typeof recipientEmails.$inferInsert);
          if (table === pairingSessions) this.sessionRows.push(value as typeof pairingSessions.$inferInsert);
          return { success: true };
        },
      }),
    };
  }

  private insertEmail(row: typeof recipientEmails.$inferInsert) {
    if (this.emailRows.some((existing) => existing.normalizedEmail === row.normalizedEmail)) {
      throw new Error("UNIQUE constraint failed: recipient_emails.normalized_email");
    }
    this.emailRows.push(row);
  }
}

function senderDraft(displayName: string): SenderDraft {
  return {
    displayName,
    kind: "codex",
    encryptionPublicKey: "sender-encryption-public-key",
    signingPublicKey: "sender-signing-public-key",
    capabilities: {},
  };
}

function env(): Env {
  return {
    DB: {} as D1Database,
    RESEND_API_KEY: "resend-key",
    RESEND_FROM_EMAIL: "Agent Notifier <setup@example.com>",
  };
}
