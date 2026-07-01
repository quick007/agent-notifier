import { lt, sql } from "drizzle-orm";

import { requireDatabase, type AppDatabase } from "../../db/client";
import { rateLimitBuckets } from "../../db/schema";
import { sha256Base64Url } from "../hash";
import { AppError } from "../http";
import { newId } from "../ids";

const ONE_MINUTE_SECONDS = 60;
const TEN_MINUTES_SECONDS = 10 * ONE_MINUTE_SECONDS;
const ONE_HOUR_SECONDS = 60 * ONE_MINUTE_SECONDS;

type RateLimitPolicy = {
  readonly scope: string;
  readonly maxAttempts: number;
  readonly windowSeconds: number;
};

export type RateLimitCheck = {
  readonly policy: RateLimitPolicy;
  readonly scopeId: string;
};

export const RATE_LIMIT_POLICIES = {
  pairingEmailStartByEmail: {
    scope: "pairing.email.start.email",
    maxAttempts: 3,
    windowSeconds: ONE_HOUR_SECONDS,
  },
  pairingEmailStartByIp: {
    scope: "pairing.email.start.ip",
    maxAttempts: 10,
    windowSeconds: ONE_HOUR_SECONDS,
  },
  pairingEmailStartBySenderPublicKey: {
    scope: "pairing.email.start.sender_key",
    maxAttempts: 5,
    windowSeconds: ONE_HOUR_SECONDS,
  },
  pairingCodeStartByIp: {
    scope: "pairing.code.start.ip",
    maxAttempts: 10,
    windowSeconds: TEN_MINUTES_SECONDS,
  },
  pairingCodeClaimByIp: {
    scope: "pairing.code.claim.ip",
    maxAttempts: 30,
    windowSeconds: TEN_MINUTES_SECONDS,
  },
  pairingCodeClaimByCode: {
    scope: "pairing.code.claim.code",
    maxAttempts: 5,
    windowSeconds: TEN_MINUTES_SECONDS,
  },
  senderMessagesBySender: {
    scope: "sender.messages.sender",
    maxAttempts: 60,
    windowSeconds: ONE_MINUTE_SECONDS,
  },
  senderMessagesByRecipient: {
    scope: "sender.messages.recipient",
    maxAttempts: 300,
    windowSeconds: ONE_MINUTE_SECONDS,
  },
} as const satisfies Record<string, RateLimitPolicy>;

export async function enforceRateLimits(env: Env, checks: readonly RateLimitCheck[], at = new Date()): Promise<void> {
  const db = requireDatabase(env);
  for (const check of checks) {
    await consumeRateLimit(db, check, at);
  }
}

export function clientIpFromHeaders(headers: Headers): string {
  return firstHeaderValue(headers.get("CF-Connecting-IP"))
    ?? firstHeaderValue(headers.get("X-Forwarded-For"))
    ?? "unknown";
}

export function normalizedEmailForRateLimit(email: string): string {
  return email.trim().toLowerCase();
}

export async function visiblePairingCodeFingerprint(code: string): Promise<string> {
  return sha256Base64Url(`pairing-code:${normalizeVisiblePairingCode(code)}`);
}

export async function senderPublicKeyFingerprint(sender: {
  readonly encryptionPublicKey: string;
  readonly signingPublicKey: string;
}): Promise<string> {
  return sha256Base64Url(`sender-public-keys:${JSON.stringify({
    encryptionPublicKey: sender.encryptionPublicKey,
    signingPublicKey: sender.signingPublicKey,
  })}`);
}

async function consumeRateLimit(db: AppDatabase, check: RateLimitCheck, at: Date): Promise<void> {
  const windowStart = windowStartIso(at, check.policy.windowSeconds);
  const result = await db.insert(rateLimitBuckets).values({
    id: newId("rl"),
    scope: check.policy.scope,
    scopeId: check.scopeId,
    windowStart,
    count: 1,
    updatedAt: at.toISOString(),
  }).onConflictDoUpdate({
    target: [rateLimitBuckets.scope, rateLimitBuckets.scopeId, rateLimitBuckets.windowStart],
    set: {
      count: sql<number>`${rateLimitBuckets.count} + 1`,
      updatedAt: at.toISOString(),
    },
    setWhere: lt(rateLimitBuckets.count, check.policy.maxAttempts),
  }).run();

  if (result.meta.changes === 0) {
    throw rateLimited(retryAfterSeconds(at, windowStart, check.policy.windowSeconds));
  }
}

function firstHeaderValue(value: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  return first ? first : undefined;
}

function normalizeVisiblePairingCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, "");
}

function windowStartIso(at: Date, windowSeconds: number): string {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(at.getTime() / windowMs) * windowMs).toISOString();
}

function retryAfterSeconds(at: Date, windowStart: string, windowSeconds: number): number {
  return Math.max(1, Math.ceil((Date.parse(windowStart) + windowSeconds * 1000 - at.getTime()) / 1000));
}

function rateLimited(retryAfterSeconds: number): AppError {
  return new AppError(429, "rate_limited", "Too many requests recently. Try again later.", retryAfterSeconds);
}
