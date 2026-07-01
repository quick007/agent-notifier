import { and, eq, isNull } from "drizzle-orm";

import { requireDatabase } from "../../db/client";
import { devices, pairingSessions, recipientEmails, recipients, senders } from "../../db/schema";
import { AppError } from "../http";
import { randomSecret, sha256Base64Url, timingSafeEqual } from "../hash";
import { addSecondsIso, clampSeconds, newId, nowIso } from "../ids";
import type { SenderDraft } from "../schemas";
import { sendSetupEmail } from "./resend-service";

const EMAIL_EXPIRY_SECONDS = 30 * 60;
const CODE_EXPIRY_SECONDS = 10 * 60;
const MAX_EXPIRY_SECONDS = 24 * 60 * 60;

export async function startEmailPairing(env: Env, input: {
  readonly email: string;
  readonly sender: SenderDraft;
  readonly requestedExpirySeconds?: unknown;
}, publicOrigin: string) {
  const db = requireDatabase(env);
  const now = nowIso();
  const sessionId = newId("pair");
  const secret = randomSecret();
  const expiresAt = addSecondsIso(clampSeconds(input.requestedExpirySeconds, EMAIL_EXPIRY_SECONDS, MAX_EXPIRY_SECONDS));
  const normalizedEmail = input.email.trim().toLowerCase();
  const recipientEmail = await getOrCreateRecipientEmail(db, input.email, normalizedEmail, now);

  await db.insert(pairingSessions).values({
    id: sessionId,
    kind: "email",
    recipientId: recipientEmail.recipientId,
    emailId: recipientEmail.id,
    senderDraftJson: JSON.stringify(input.sender),
    magicLinkSecretHash: await sha256Base64Url(secret),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  }).run();

  const origin = normalizePublicOrigin(publicOrigin);
  const setupUrl = `${origin}/setup/pair/${sessionId}?secret=${encodeURIComponent(secret)}`;
  await sendSetupEmail(env, {
    email: input.email,
    senderDisplayName: input.sender.displayName,
    setupUrl,
    publicOrigin: origin,
    expiresAt,
  });

  return { sessionId, expiresAt, status: "pending" as const };
}

async function getOrCreateRecipientEmail(
  db: ReturnType<typeof requireDatabase>,
  email: string,
  normalizedEmail: string,
  now: string,
) {
  const [existingEmail] = await db
    .select({
      id: recipientEmails.id,
      recipientId: recipientEmails.recipientId,
    })
    .from(recipientEmails)
    .where(eq(recipientEmails.normalizedEmail, normalizedEmail))
    .limit(1)
    .all();

  if (existingEmail) return existingEmail;

  const recipientId = newId("rcp");
  const emailId = newId("eml");
  await db.insert(recipients).values({ id: recipientId, primaryEmailId: emailId, createdAt: now, updatedAt: now }).run();
  await db.insert(recipientEmails).values({
    id: emailId,
    recipientId,
    email,
    normalizedEmail,
    createdAt: now,
    updatedAt: now,
  }).run();

  return { id: emailId, recipientId };
}

export async function startCodePairing(env: Env) {
  const db = requireDatabase(env);
  const now = nowIso();
  const sessionId = newId("pair");
  const code = humanCode();
  const secret = randomSecret();
  const expiresAt = addSecondsIso(CODE_EXPIRY_SECONDS);

  await db.insert(pairingSessions).values({
    id: sessionId,
    kind: "code",
    codeHash: await sha256Base64Url(`${code}:${secret}`),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  }).run();

  return { sessionId, code, secret, expiresAt };
}

export async function claimCodePairing(env: Env, code: string, secret: string, sender: SenderDraft) {
  const db = requireDatabase(env);
  const [session] = await db
    .select()
    .from(pairingSessions)
    .where(eq(pairingSessions.codeHash, await sha256Base64Url(`${code}:${secret}`)))
    .limit(1)
    .all();

  if (!session || session.expiresAt < nowIso()) {
    throw new AppError(404, "pairing_not_found", "Pairing code is invalid or expired.");
  }
  if (session.claimedAt || session.approvedAt || session.rejectedAt) {
    throw new AppError(409, "pairing_already_used", "Pairing session is already used.");
  }

  await db.update(pairingSessions).set({
    senderDraftJson: JSON.stringify(sender),
    claimedAt: nowIso(),
    updatedAt: nowIso(),
    attemptCount: session.attemptCount + 1,
  }).where(eq(pairingSessions.id, session.id)).run();

  return { sessionId: session.id, status: "claimed" as const, expiresAt: session.expiresAt };
}

export async function approvePairing(
  env: Env,
  sessionId: string,
  deviceId: string,
  recipientId: string,
  secret?: string,
) {
  const db = requireDatabase(env);
  const [session] = await db.select().from(pairingSessions).where(eq(pairingSessions.id, sessionId)).limit(1).all();
  if (!session || !session.senderDraftJson || session.expiresAt < nowIso()) {
    throw new AppError(404, "pairing_not_found", "Pairing session is invalid or expired.");
  }
  if (session.approvedAt || session.rejectedAt) {
    throw new AppError(409, "pairing_already_used", "Pairing session is already used.");
  }
  let secretVerified = false;
  if (session.magicLinkSecretHash) {
    if (!secret) throw new AppError(401, "missing_pairing_secret", "Pairing secret is required.");
    const secretHash = await sha256Base64Url(secret);
    if (!timingSafeEqual(secretHash, session.magicLinkSecretHash)) {
      throw new AppError(401, "invalid_pairing_secret", "Pairing secret is invalid.");
    }
    secretVerified = true;
  }

  const sender = JSON.parse(session.senderDraftJson) as SenderDraft;
  const senderId = newId("snd");
  const now = nowIso();
  const pairedRecipientId = session.recipientId ?? recipientId;
  if (session.recipientId && session.recipientId !== recipientId) {
    if (!secretVerified) throw new AppError(403, "scope_mismatch", "Pairing session is not scoped to this device.");
    await db.update(devices).set({
      recipientId: session.recipientId,
      updatedAt: now,
    }).where(and(
      eq(devices.id, deviceId),
      eq(devices.recipientId, recipientId),
      isNull(devices.revokedAt),
    )).run();
  }

  await db.insert(senders).values({
    id: senderId,
    recipientId: pairedRecipientId,
    displayName: sender.displayName,
    kind: sender.kind,
    encryptionPublicKey: sender.encryptionPublicKey,
    signingPublicKey: sender.signingPublicKey,
    capabilitiesJson: JSON.stringify(sender.capabilities),
    previewPolicy: "allow_agent_choice",
    createdAt: now,
    updatedAt: now,
    ...(sender.appName === undefined ? {} : { appName: sender.appName }),
    ...(sender.machineLabel === undefined ? {} : { machineLabel: sender.machineLabel }),
    ...(sender.workspaceLabel === undefined ? {} : { workspaceLabel: sender.workspaceLabel }),
  }).run();
  await db.update(pairingSessions).set({
    recipientId: pairedRecipientId,
    senderId,
    approvedAt: now,
    updatedAt: now,
  }).where(eq(pairingSessions.id, session.id)).run();

  return { senderId, recipientId: pairedRecipientId, status: "paired" as const };
}

export async function pairingStatus(env: Env, sessionId: string, secret?: string) {
  const db = requireDatabase(env);
  const [session] = await db.select().from(pairingSessions).where(eq(pairingSessions.id, sessionId)).limit(1).all();
  if (!session) return { status: "not_found" as const };
  if (session.expiresAt < nowIso()) return { status: "expired" as const, expiresAt: session.expiresAt };
  const shared = { expiresAt: session.expiresAt };
  if (session.approvedAt) {
    return {
      status: "paired" as const,
      ...shared,
      ...(session.recipientId ? { recipientId: session.recipientId } : {}),
      ...(session.senderId ? { senderId: session.senderId } : {}),
    };
  }
  if (session.claimedAt) return { status: "claimed" as const, ...shared, ...(await safePairingDetails(db, session, secret)) };
  return { status: "pending" as const, ...shared, ...(await safePairingDetails(db, session, secret)) };
}

async function safePairingDetails(
  db: ReturnType<typeof requireDatabase>,
  session: typeof pairingSessions.$inferSelect,
  secret?: string,
) {
  if (!session.senderDraftJson || !(await canRevealPairingDetails(session, secret))) return {};
  const sender = JSON.parse(session.senderDraftJson) as SenderDraft;
  const deviceRows = session.recipientId ? await activeDeviceKeys(db, session.recipientId) : [];

  return {
    sender: {
      displayName: sender.displayName,
      kind: sender.kind,
      encryptionPublicKey: sender.encryptionPublicKey,
      signingPublicKey: sender.signingPublicKey,
      capabilities: sender.capabilities,
      ...(sender.appName === undefined ? {} : { appName: sender.appName }),
      ...(sender.machineLabel === undefined ? {} : { machineLabel: sender.machineLabel }),
      ...(sender.workspaceLabel === undefined ? {} : { workspaceLabel: sender.workspaceLabel }),
    },
    ...(session.recipientId ? { recipientId: session.recipientId, devices: deviceRows } : {}),
  };
}

async function canRevealPairingDetails(
  session: typeof pairingSessions.$inferSelect,
  secret?: string,
): Promise<boolean> {
  if (!session.magicLinkSecretHash) return true;
  if (!secret) return false;
  return timingSafeEqual(await sha256Base64Url(secret), session.magicLinkSecretHash);
}

async function activeDeviceKeys(db: ReturnType<typeof requireDatabase>, recipientId: string) {
  const rows = await db.select().from(devices).where(and(
    eq(devices.recipientId, recipientId),
    isNull(devices.revokedAt),
  )).all();

  return rows.map(deviceKeySummary);
}

function deviceKeySummary(device: typeof devices.$inferSelect) {
  return {
    deviceId: device.id,
    encryptionPublicKey: device.encryptionPublicKey,
    signingPublicKey: device.signingPublicKey,
  };
}

function normalizePublicOrigin(publicOrigin: string): string {
  return new URL(publicOrigin).origin;
}

function humanCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(8);
  crypto.getRandomValues(values);
  const code = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
