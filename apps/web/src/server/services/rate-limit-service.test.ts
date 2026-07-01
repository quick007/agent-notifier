import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { rateLimitBuckets } from "../../db/schema";
import { sha256Base64Url } from "../hash";
import { AppError } from "../http";
import {
  clientIpFromHeaders,
  enforceRateLimits,
  senderPublicKeyFingerprint,
  visiblePairingCodeFingerprint,
} from "./rate-limit-service";

const mocks = vi.hoisted(() => ({
  requireDatabase: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  requireDatabase: mocks.requireDatabase,
}));

describe("rate limit service", () => {
  let db: FakeRateLimitDatabase;

  beforeEach(() => {
    db = new FakeRateLimitDatabase();
    mocks.requireDatabase.mockReturnValue(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("trips fixed-window limits with retryAfterSeconds", async () => {
    const now = new Date("2026-07-01T00:00:00.000Z");
    const check = {
      policy: { scope: "test.scope", maxAttempts: 2, windowSeconds: 60 },
      scopeId: "subject_a",
    };

    await enforceRateLimits(env(), [check], now);
    await enforceRateLimits(env(), [check], now);

    let error: unknown;
    try {
      await enforceRateLimits(env(), [check], now);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      status: 429,
      code: "rate_limited",
      retryAfterSeconds: 60,
    });
    expect(db.bucketRows[0]?.count).toBe(2);
  });

  it("keeps separate buckets per scope, scopeId, and fixed window", async () => {
    const now = new Date("2026-07-01T00:00:30.000Z");
    const policy = { scope: "test.scope", maxAttempts: 1, windowSeconds: 60 };
    const check = { policy, scopeId: "subject_a" };

    await enforceRateLimits(env(), [check], now);
    await expect(enforceRateLimits(env(), [check], now)).rejects.toMatchObject({ status: 429 });
    await enforceRateLimits(env(), [{ policy, scopeId: "subject_b" }], now);
    await enforceRateLimits(env(), [{ policy: { ...policy, scope: "test.other_scope" }, scopeId: "subject_a" }], now);
    await enforceRateLimits(env(), [check], new Date("2026-07-01T00:01:00.000Z"));

    expect(db.bucketRows.map((row) => `${row.scope}:${row.scopeId}:${row.windowStart}:${row.count}`)).toEqual([
      "test.scope:subject_a:2026-07-01T00:00:00.000Z:1",
      "test.scope:subject_b:2026-07-01T00:00:00.000Z:1",
      "test.other_scope:subject_a:2026-07-01T00:00:00.000Z:1",
      "test.scope:subject_a:2026-07-01T00:01:00.000Z:1",
    ]);
  });

  it("treats a failed conditional update as rate limited", async () => {
    const now = new Date("2026-07-01T00:00:01.000Z");
    const check = {
      policy: { scope: "test.scope", maxAttempts: 2, windowSeconds: 60 },
      scopeId: "subject_a",
    };
    db.bucketRows.push({
      id: "rl_existing",
      scope: "test.scope",
      scopeId: "subject_a",
      windowStart: "2026-07-01T00:00:00.000Z",
      count: 1,
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    db.beforeConflictUpdate = (bucket) => {
      bucket.count = 2;
    };

    await expect(enforceRateLimits(env(), [check], now)).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 59,
    });
    expect(db.bucketRows[0]?.count).toBe(2);
  });

  it("uses metadata headers and fingerprints non-content pairing metadata", async () => {
    const headers = new Headers({
      "CF-Connecting-IP": "203.0.113.10",
      "X-Forwarded-For": "198.51.100.4, 198.51.100.5",
    });
    const sender = { encryptionPublicKey: "sender_encryption_public_key", signingPublicKey: "sender_signing_public_key" };

    await expect(visiblePairingCodeFingerprint(" abcd-efgh ")).resolves.toBe(
      await sha256Base64Url("pairing-code:ABCDEFGH"),
    );
    await expect(senderPublicKeyFingerprint(sender)).resolves.toBe(
      await sha256Base64Url("sender-public-keys:"
        + "{\"encryptionPublicKey\":\"sender_encryption_public_key\",\"signingPublicKey\":\"sender_signing_public_key\"}"),
    );
    await expect(senderPublicKeyFingerprint({ ...sender, signingPublicKey: "other_signing_public_key" })).resolves.not.toBe(
      await senderPublicKeyFingerprint(sender),
    );
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.10");
    expect(clientIpFromHeaders(new Headers({ "X-Forwarded-For": "198.51.100.4, 198.51.100.5" }))).toBe("198.51.100.4");
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

class FakeRateLimitDatabase {
  readonly bucketRows: Array<typeof rateLimitBuckets.$inferInsert> = [];
  beforeConflictUpdate?: (bucket: typeof rateLimitBuckets.$inferInsert) => void;

  insert(table: unknown) {
    return {
      values: (value: typeof rateLimitBuckets.$inferInsert) => ({
        onConflictDoUpdate: (config: ConflictConfig) => ({
          run: async () => {
            if (table !== rateLimitBuckets) return d1Result(0);
            const existing = this.bucketRows.find((row) => sameBucket(row, value));
            if (!existing) {
              this.bucketRows.push(value);
              return d1Result(1);
            }

            this.beforeConflictUpdate?.(existing);
            delete this.beforeConflictUpdate;
            const maxAttempts = numericSqlParam(config.setWhere);
            if (maxAttempts === undefined) throw new Error("conditional update limit was not provided");
            if (existing.count >= maxAttempts) return d1Result(0);

            existing.count += 1;
            existing.updatedAt = config.set.updatedAt;
            return d1Result(1);
          },
        }),
      }),
    };
  }
}

function sameBucket(left: typeof rateLimitBuckets.$inferInsert, right: typeof rateLimitBuckets.$inferInsert): boolean {
  return left.scope === right.scope && left.scopeId === right.scopeId && left.windowStart === right.windowStart;
}

type ConflictConfig = {
  readonly set: { readonly updatedAt: string };
  readonly setWhere?: unknown;
};

function numericSqlParam(value: unknown): number | undefined {
  const chunks = (value as { readonly queryChunks?: readonly unknown[] }).queryChunks ?? [];
  for (const chunk of chunks) {
    const param = chunk as { readonly value?: unknown };
    if (typeof param.value === "number") return param.value;
  }
  return undefined;
}

function d1Result(changes: number) {
  return { success: true, meta: { changes } };
}

function env(): Env {
  return { DB: {} as D1Database };
}
