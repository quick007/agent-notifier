import { DOMAINS, SIGNED_REQUEST_HEADERS, canonicalJson, canonicalRequestBytes, canonicalSigningBytes, messageContentAadBytes, messageEnvelopeSigningBytes, responseEnvelopeSigningBytes, type DeviceKeyWrap, type MessagePlaintext, type ResponseKind, type ResponsePlaintext, type ServerVisibleMessageMetadata } from "@agent-notifier/protocol";
import { bytesToUtf8, exportPrivateKeyPkcs8, exportPublicKeySpki, generateEncryptionKeyPair, generateSigningKeyPair, importEncryptionPrivateKey, importEncryptionPublicKey, importSigningPrivateKey, importSigningPublicKey, openContentFromDeviceWrap, randomBytes, sealContentForDevices, sha256Base64Url, signP256Sha256, toBase64Url, utf8ToBytes, verifyP256Sha256 } from "@agent-notifier/crypto";
import type { DeviceIdentity, Message, PairingState, PreviewPolicy, Sender } from "../types";

type JsonObject = Record<string, unknown>;
type PairingStatusJson = { status: "not_found" | "expired" | "paired" | "claimed" | "pending"; expiresAt?: string; recipientId?: string; sender?: ApiSenderDraft };
type ApiSenderDraft = { displayName?: string; kind?: string; machineLabel?: string; previewPolicy?: string; revokedAt?: string; lastUsedAt?: string; encryptionPublicKey?: string };
type PendingApiMessage = { messageId: string; metadata: ServerVisibleMessageMetadata; ciphertext: string; contentNonce: string; contentAadHash: string; senderSignature: string; sender: ApiSenderDraft & { senderId: string; signingPublicKey: string; encryptionPublicKey: string }; keyWrap?: DeviceKeyWrap; keyWraps?: readonly DeviceKeyWrap[] };
export type DecodedPendingMessage = { message: Message; sender: Sender };
export type MessageResponseDraft = { kind: "reply"; text: string } | { kind: "approval"; decision: "approved" | "rejected"; text?: string };

export async function createDeviceIdentity(displayName: string): Promise<DeviceIdentity> {
  const encryption = await generateEncryptionKeyPair({ extractable: true });
  const signing = await generateSigningKeyPair({ extractable: true });
  return {
    localId: crypto.randomUUID(),
    displayName,
    encryptionPublicKey: await exportPublicKeySpki(encryption.publicKey),
    signingPublicKey: await exportPublicKeySpki(signing.publicKey),
    encryptionPrivateKeyPkcs8: await exportPrivateKeyPkcs8(encryption.privateKey),
    signingPrivateKeyPkcs8: await exportPrivateKeyPkcs8(signing.privateKey),
    createdAt: new Date().toISOString()
  };
}

export async function startCodePairing(): Promise<PairingState> {
  const json = await jsonFetch<JsonObject>("/api/pairing/code/start", { method: "POST" });
  return {
    status: "code_ready",
    kind: "code",
    sessionId: readString(json, "sessionId"),
    code: readString(json, "code"),
    secret: readString(json, "secret"),
    expiresAt: readString(json, "expiresAt")
  };
}

export async function getPairingStatus(pairing: PairingState): Promise<PairingStatusJson> {
  if (!pairing.sessionId) throw new Error("Pairing session is missing.");
  const query = pairing.secret ? `?secret=${encodeURIComponent(pairing.secret)}` : "";
  return jsonFetch<PairingStatusJson>(`/api/pairing/${pairing.sessionId}/status${query}`);
}

export async function registerDevice(input: { device: DeviceIdentity; pairing: PairingState; recipientId?: string }): Promise<DeviceIdentity> {
  const json = await jsonFetch<JsonObject>("/api/devices/register", {
    method: "POST",
    body: JSON.stringify({
      ...(input.recipientId ? {
        recipientId: input.recipientId,
        pairingSessionId: input.pairing.sessionId,
        pairingSecret: input.pairing.secret
      } : {}),
      device: {
        displayName: input.device.displayName,
        encryptionPublicKey: input.device.encryptionPublicKey,
        signingPublicKey: input.device.signingPublicKey
      }
    }),
    headers: { "content-type": "application/json" }
  });
  return { ...input.device, recipientId: readString(json, "recipientId"), deviceId: readString(json, "deviceId") };
}

export async function approvePairing(device: DeviceIdentity, pairing: PairingState) {
  if (!pairing.sessionId) throw new Error("Pairing session is missing.");
  return signedDeviceFetch<JsonObject>(device, "POST", `/api/pairing/${pairing.sessionId}/approve`, pairing.secret ? { secret: pairing.secret } : {});
}

export async function listSenders(device: DeviceIdentity): Promise<Sender[]> {
  const json = await signedDeviceFetch<{ senders?: ApiSenderDraft[] }>(device, "GET", "/api/devices/senders");
  return (json.senders ?? []).map((sender) => apiSenderToLocal(sender));
}

export async function updatePushSubscription(device: DeviceIdentity, pushSubscription: PushSubscriptionJSON | null) {
  const json = await signedDeviceFetch<{ pushEnabled?: boolean }>(
    device,
    "POST",
    "/api/devices/push-subscription",
    { pushSubscription }
  );
  return json.pushEnabled === true;
}

export async function fetchPendingMessages(device: DeviceIdentity): Promise<DecodedPendingMessage[]> {
  const json = await signedDeviceFetch<{ messages?: unknown[] }>(device, "GET", "/api/devices/messages/pending");
  const decoded: DecodedPendingMessage[] = [];
  for (const pending of (json.messages ?? []).filter(isPendingApiMessage)) {
    decoded.push(await decryptPendingMessage(device, pending));
  }
  return decoded;
}

export async function markDelivered(device: DeviceIdentity, messageId: string) {
  await signedDeviceFetch(device, "POST", `/api/devices/messages/${messageId}/delivered`, {});
}
export async function revokeSender(device: DeviceIdentity, senderId: string) {
  await signedDeviceFetch(device, "POST", `/api/devices/senders/${senderId}/revoke`, {});
}

export async function submitMessageResponse(
  device: DeviceIdentity,
  message: Message,
  sender: Sender,
  draft: MessageResponseDraft
): Promise<NonNullable<Message["response"]>> {
  if (!sender.encryptionPublicKey) throw new Error("Sender encryption key is unavailable.");
  const responseId = `rsp_${crypto.randomUUID()}`;
  const kind = draft.kind;
  const expiresAt = message.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const respondedAt = new Date().toISOString();
  const aad = responseContentAadBytes({ responseId, messageId: message.id, kind, expiresAt });
  const sealed = await sealContentForDevices({
    plaintext: owned(utf8ToBytes(canonicalJson(responsePlaintext(message.id, draft, respondedAt)))),
    aad,
    devices: [{ deviceId: sender.id, publicKey: await importEncryptionPublicKey(sender.encryptionPublicKey) }]
  });
  const ciphertext = packResponseCiphertext(sealed);
  const signingEnvelope = { schemaVersion: 1 as const, responseId, messageId: message.id, kind, expiresAt, ciphertext, contentNonce: sealed.contentNonce };
  const deviceSignature = await signP256Sha256(
    await importSigningPrivateKey(device.signingPrivateKeyPkcs8),
    owned(responseEnvelopeSigningBytes(signingEnvelope))
  );
  await signedDeviceFetch(device, "POST", `/api/devices/messages/${message.id}/respond`, {
    schemaVersion: 1,
    responseId,
    kind,
    expiresAt,
    ciphertext,
    contentNonce: sealed.contentNonce,
    deviceSignature
  });
  return { ...draft, respondedAt };
}

async function decryptPendingMessage(device: DeviceIdentity, pending: PendingApiMessage): Promise<DecodedPendingMessage> {
  const keyWraps = pendingKeyWraps(pending);
  const envelope = { schemaVersion: 1 as const, metadata: pending.metadata, ciphertext: pending.ciphertext, contentNonce: pending.contentNonce, contentAadHash: pending.contentAadHash, keyWraps };
  const ok = await verifyP256Sha256(
    await importSigningPublicKey(pending.sender.signingPublicKey),
    owned(messageEnvelopeSigningBytes(envelope)),
    pending.senderSignature
  );
  if (!ok) throw new Error(`Message ${pending.messageId} failed sender signature verification.`);
  const ownWrap = keyWraps.find((wrap) => wrap.deviceId === device.deviceId);
  if (!ownWrap) throw new Error(`Message ${pending.messageId} does not include a wrap for this device.`);
  const plaintext = JSON.parse(bytesToUtf8(await openContentFromDeviceWrap(
    pending,
    ownWrap,
    await importEncryptionPrivateKey(device.encryptionPrivateKeyPkcs8),
    owned(messageContentAadBytes(pending.metadata))
  ))) as MessagePlaintext;
  if (plaintext.schemaVersion !== 1 || plaintext.mode !== pending.metadata.mode) {
    throw new Error(`Message ${pending.messageId} plaintext does not match metadata.`);
  }
  const request = plaintext.request ? requestToLocal(plaintext.request) : undefined;
  return {
    sender: apiSenderToLocal(pending.sender, pending.metadata.createdAt),
    message: {
      id: pending.messageId,
      senderId: pending.metadata.senderId,
      mode: pending.metadata.mode,
      title: plaintext.title,
      body: plaintext.body,
      sensitive: plaintext.sensitive,
      createdAt: plaintext.createdAt,
      expiresAt: pending.metadata.expiresAt,
      deliveryState: "delivered",
      saved: false,
      deleted: false,
      ...(request ? { request } : {})
    }
  };
}

async function signedDeviceFetch<T>(device: DeviceIdentity, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!device.deviceId) throw new Error("Device is not registered.");
  const bodyText = body === undefined ? "" : JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const nonce = toBase64Url(randomBytes(16));
  const bodySha256 = await sha256Base64Url(new TextEncoder().encode(bodyText));
  const signature = await signP256Sha256(await importSigningPrivateKey(device.signingPrivateKeyPkcs8), owned(canonicalRequestBytes({
    method,
    path,
    bodySha256,
    timestamp,
    nonce,
    subjectType: "device",
    subjectId: device.deviceId
  })));
  return jsonFetch<T>(path, {
    method,
    headers: {
      "content-type": "application/json",
      [SIGNED_REQUEST_HEADERS.deviceId]: device.deviceId,
      [SIGNED_REQUEST_HEADERS.timestamp]: timestamp,
      [SIGNED_REQUEST_HEADERS.nonce]: nonce,
      [SIGNED_REQUEST_HEADERS.signature]: signature
    },
    ...(body === undefined ? {} : { body: bodyText })
  });
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`API ${response.status}: ${JSON.stringify(json)}`);
  return json as T;
}

function apiSenderToLocal(sender: ApiSenderDraft & { id?: string; senderId?: string }, lastUsedAt?: string): Sender {
  return {
    id: sender.id ?? sender.senderId ?? "snd_unknown",
    displayName: sender.displayName ?? "Paired agent",
    kind: sender.kind === "codex" || sender.kind === "claude" || sender.kind === "ci" ? sender.kind : "generic",
    machineLabel: sender.machineLabel ?? "",
    lastUsedAt: sender.lastUsedAt ?? lastUsedAt ?? new Date().toISOString(),
    previewPolicy: previewPolicy(sender.previewPolicy),
    ...(sender.revokedAt ? { revokedAt: sender.revokedAt } : {}),
    ...(sender.encryptionPublicKey ? { encryptionPublicKey: sender.encryptionPublicKey } : {}),
    capabilities: { notify: true, requestReply: true, requestApproval: true }
  };
}

function previewPolicy(value: unknown): PreviewPolicy {
  if (value === "always_hide") return "always_hide";
  if (value === "allow_agent_choice") return "agent_choice";
  return "hide_sensitive";
}

function requestToLocal(request: NonNullable<MessagePlaintext["request"]>): NonNullable<Message["request"]> {
  if (request.kind === "reply") return { ...(request.prompt ? { prompt: request.prompt } : {}) };
  return { actionLabel: request.actionLabel, ...(request.riskText ? { riskText: request.riskText } : {}) };
}

function responsePlaintext(messageId: string, draft: MessageResponseDraft, respondedAt: string): ResponsePlaintext {
  if (draft.kind === "reply") return { schemaVersion: 1, messageId, kind: "reply", body: draft.text, respondedAt };
  return { schemaVersion: 1, messageId, kind: "approval", decision: draft.decision, respondedAt, ...(draft.text ? { note: draft.text } : {}) };
}

function responseContentAadBytes(input: { responseId: string; messageId: string; kind: ResponseKind; expiresAt: string }): ArrayBuffer {
  return owned(canonicalSigningBytes({ domain: DOMAINS.RESPONSE_V1, payload: { schemaVersion: 1, ...input } }));
}

function packResponseCiphertext(sealed: { ciphertext: string; contentNonce: string; contentAadHash: string; keyWraps: readonly DeviceKeyWrap[] }): string {
  const [senderKeyWrap] = sealed.keyWraps;
  if (!senderKeyWrap) throw new Error("Response is missing a sender key wrap.");
  return toBase64Url(utf8ToBytes(canonicalJson({
    schemaVersion: 1,
    format: "agent-notifier/response-sealed/v1",
    ciphertext: sealed.ciphertext,
    contentNonce: sealed.contentNonce,
    contentAadHash: sealed.contentAadHash,
    senderKeyWrap
  })));
}

function isPendingApiMessage(value: unknown): value is PendingApiMessage {
  const record = value as Partial<PendingApiMessage> | null;
  return Boolean(record && typeof record === "object" &&
    typeof record.messageId === "string" &&
    typeof record.ciphertext === "string" &&
    typeof record.contentNonce === "string" &&
    typeof record.contentAadHash === "string" &&
    typeof record.senderSignature === "string" &&
    record.metadata &&
    record.sender &&
    typeof record.sender.senderId === "string" &&
    typeof record.sender.signingPublicKey === "string" &&
    typeof record.sender.encryptionPublicKey === "string" &&
    (isKeyWrap(record.keyWrap) || (Array.isArray(record.keyWraps) && record.keyWraps.every(isKeyWrap))));
}

function pendingKeyWraps(pending: PendingApiMessage): readonly DeviceKeyWrap[] {
  if (pending.keyWraps?.length) return pending.keyWraps;
  if (pending.keyWrap) return [pending.keyWrap];
  throw new Error(`Message ${pending.messageId} is missing key wraps.`);
}

function isKeyWrap(value: unknown): value is DeviceKeyWrap {
  const wrap = value as Partial<DeviceKeyWrap> | null;
  return Boolean(wrap && typeof wrap === "object" &&
    wrap.schemaVersion === 1 &&
    typeof wrap.deviceId === "string" &&
    typeof wrap.ephemeralPublicKey === "string" &&
    typeof wrap.wrappedKey === "string" &&
    typeof wrap.wrapNonce === "string");
}

function readString(json: JsonObject, key: string): string {
  const value = json[key];
  if (typeof value !== "string") throw new Error(`API response is missing ${key}.`);
  return value;
}

function owned(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
