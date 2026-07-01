import { SIGNED_REQUEST_HEADERS, canonicalRequestText } from "@agent-notifier/protocol";
import { and, eq, isNull } from "drizzle-orm";

import { requireDatabase } from "../db/client";
import { authNonces, devices, senders } from "../db/schema";
import { copyToArrayBuffer, sha256Base64Url, sha256BytesBase64Url } from "./hash";
import { AppError } from "./http";
import { newId, nowIso } from "./ids";

const MAX_SKEW_MS = 5 * 60 * 1000;

export { canonicalRequestText } from "@agent-notifier/protocol";

export interface SenderAuth {
  readonly senderId: string;
  readonly recipientId: string;
}

export interface DeviceAuth {
  readonly deviceId: string;
  readonly recipientId: string;
}

export async function verifySenderRequest(env: Env, request: Request): Promise<SenderAuth> {
  const senderId = requireHeader(request, SIGNED_REQUEST_HEADERS.senderId);
  const auth = readSignatureHeaders(request);
  const db = requireDatabase(env);
  const [sender] = await db.select().from(senders).where(and(
    eq(senders.id, senderId),
    isNull(senders.revokedAt),
  )).limit(1).all();

  if (!sender) throw new AppError(401, "invalid_signature", "Sender is not active.");
  await verifySignedRequest(request, auth, "sender", senderId, sender.signingPublicKey);
  await recordNonce(env, "sender", senderId, auth.nonce, auth.timestamp);

  return { senderId, recipientId: sender.recipientId };
}

export async function verifyDeviceRequest(env: Env, request: Request): Promise<DeviceAuth> {
  const deviceId = requireHeader(request, SIGNED_REQUEST_HEADERS.deviceId);
  const auth = readSignatureHeaders(request);
  const db = requireDatabase(env);
  const [device] = await db.select().from(devices).where(and(
    eq(devices.id, deviceId),
    isNull(devices.revokedAt),
  )).limit(1).all();

  if (!device) throw new AppError(401, "invalid_signature", "Device is not active.");
  await verifySignedRequest(request, auth, "device", deviceId, device.signingPublicKey);
  await recordNonce(env, "device", deviceId, auth.nonce, auth.timestamp);

  return { deviceId, recipientId: device.recipientId };
}

async function verifySignedRequest(
  request: Request,
  auth: SignatureHeaders,
  subjectType: "sender" | "device",
  subjectId: string,
  publicKey: string,
): Promise<void> {
  assertFreshTimestamp(auth.timestamp);
  const url = new URL(request.url);
  const bodySha256 = await hashRequestBody(request);
  const signingText = canonicalRequestText({
    method: request.method,
    path: `${url.pathname}${url.search}`,
    bodySha256,
    timestamp: auth.timestamp,
    nonce: auth.nonce,
    subjectType,
    subjectId,
  });
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    await importSigningPublicKey(publicKey),
    copyToArrayBuffer(fromBase64Url(auth.signature)),
    new TextEncoder().encode(signingText),
  );

  if (!ok) throw new AppError(401, "invalid_signature", "Request signature is invalid.");
}

async function recordNonce(
  env: Env,
  subjectType: "sender" | "device",
  subjectId: string,
  nonce: string,
  timestamp: string,
): Promise<void> {
  const createdAt = nowIso();
  const expiresAt = new Date(Date.parse(timestamp) + MAX_SKEW_MS).toISOString();
  const nonceHash = await sha256Base64Url(`${subjectType}:${subjectId}:${nonce}`);

  try {
    await requireDatabase(env).insert(authNonces).values({
      id: newId("rl"),
      subjectType,
      subjectId,
      nonceHash,
      expiresAt,
      createdAt,
    }).run();
  } catch {
    throw new AppError(401, "replayed_signature", "Request nonce was already used.");
  }
}

function readSignatureHeaders(request: Request): SignatureHeaders {
  return {
    signature: requireHeader(request, SIGNED_REQUEST_HEADERS.signature),
    timestamp: requireHeader(request, SIGNED_REQUEST_HEADERS.timestamp),
    nonce: requireHeader(request, SIGNED_REQUEST_HEADERS.nonce),
  };
}

function assertFreshTimestamp(timestamp: string, now = Date.now()): void {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) throw new AppError(401, "invalid_signature", "Request timestamp is invalid.");
  if (Math.abs(now - parsed) > MAX_SKEW_MS) throw new AppError(401, "stale_signature", "Request timestamp is too old.");
}

async function hashRequestBody(request: Request): Promise<string> {
  const body = await request.clone().arrayBuffer();
  return sha256BytesBase64Url(new Uint8Array(body));
}

async function importSigningPublicKey(spki: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    copyToArrayBuffer(fromBase64Url(spki)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

function requireHeader(request: Request, name: string): string {
  const value = request.headers.get(name);
  if (!value) throw new AppError(401, "missing_signature", `${name} header is required.`);
  return value;
}

type SignatureHeaders = {
  readonly signature: string;
  readonly timestamp: string;
  readonly nonce: string;
};

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
