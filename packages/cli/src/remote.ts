import {
  canonicalJson,
  messageContentAadBytes,
  messageEnvelopeSigningBytes,
  type MessagePlaintext,
  type MessageSubmissionEnvelope,
  type ServerVisibleMessageMetadata,
} from "@agent-notifier/protocol";
import {
  importEncryptionPublicKey,
  importSigningPrivateKey,
  sealContentForDevices,
  signP256Sha256,
  utf8ToBytes,
} from "@agent-notifier/crypto";
import { createApiClient, endpointPath, jsonOrThrow } from "./api-client.js";
import type { SenderDraftJson } from "./api-client.js";
import type { AgentNotifierResult, LocalMessageRecord, MessageTargetDevice, SendInput, SenderRecord, SetupInput, WaitInput } from "./contracts.js";
import { decryptSenderResponse, parseResponseEnvelope } from "./response.js";
import { signedFetch } from "./transport.js";

export function senderDraft(sender: SenderRecord): SenderDraftJson {
  if (!sender.encryptionPublicKey || !sender.signingPublicKey) {
    throw new Error("Sender public keys are not available locally.");
  }
  return {
    displayName: sender.displayName,
    kind: sender.kind,
    encryptionPublicKey: sender.encryptionPublicKey,
    signingPublicKey: sender.signingPublicKey,
    capabilities: {
      notify: true,
      request_reply: true,
      request_approval: true,
    },
  };
}

export async function startRemoteSetup(apiUrl: string, input: SetupInput, sender: SenderRecord): Promise<AgentNotifierResult> {
  const client = createApiClient(apiUrl);
  if (!input.email && (!input.code || !input.secret)) {
    return liveBlocked("setup_code", apiUrl, "Live code setup needs both code and secret from the code pairing start response.");
  }
  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  if (input.email) {
    response = await client.api.pairing.email.start.$post({ json: { email: input.email, sender: senderDraft(sender) } });
  } else {
    const code = input.code;
    const secret = input.secret;
    if (!code || !secret) {
      return liveBlocked("setup_code", apiUrl, "Live code setup needs both code and secret from the code pairing start response.");
    }
    response = await client.api.pairing.code.claim.$post({ json: { code, secret, sender: senderDraft(sender) } });
  }
  const json = await jsonOrThrow(response) as Record<string, unknown>;
  return {
    ok: true,
    kind: input.email ? "setup_email" : "setup_code",
    state: typeof json.status === "string" ? json.status : "pending",
    transport: "http_api",
    at: new Date().toISOString(),
    senderId: sender.id,
    apiUrl,
    serverAccepted: true,
    ...(typeof json.sessionId === "string" ? { sessionId: json.sessionId } : {}),
    ...(typeof json.expiresAt === "string" ? { expiresAt: json.expiresAt } : {}),
    ...(sender.keyStorageWarning ? { warning: sender.keyStorageWarning } : {}),
  };
}

export async function remotePairingStatus(apiUrl: string, sessionId: string, secret?: string): Promise<AgentNotifierResult> {
  const endpoint = createApiClient(apiUrl).api.pairing[":sessionId"].status;
  const query = secret ? { secret } : {};
  const response = await endpoint.$get({ param: { sessionId }, query });
  const json = await jsonOrThrow(response);
  return {
    ok: json.status !== "not_found",
    kind: "setup_status",
    state: typeof json.status === "string" ? json.status : "unknown",
    transport: "http_api",
    at: new Date().toISOString(),
    apiUrl,
    sessionId,
    serverAccepted: true,
    ...(typeof json.senderId === "string" ? { senderId: json.senderId } : {}),
    ...(typeof json.recipientId === "string" ? { recipientId: json.recipientId } : {}),
    ...(typeof json.expiresAt === "string" ? { expiresAt: json.expiresAt } : {}),
  };
}

export async function remoteStatus(
  apiUrl: string,
  sender: SenderRecord,
  messageId: string,
  knownDevices: readonly MessageTargetDevice[] = [],
): Promise<AgentNotifierResult> {
  const endpoint = createApiClient(apiUrl).api.senders.messages[":messageId"].status;
  const response = await signedFetch({ apiUrl, sender, method: "GET", path: endpointPath(endpoint.$url({ param: { messageId } })) }) as Record<string, unknown>;
  const result: AgentNotifierResult = {
    ok: true,
    kind: "message_status",
    transport: "http_api",
    at: new Date().toISOString(),
    apiUrl,
    senderId: sender.id,
    messageId,
    serverAccepted: true,
    ...(typeof response.state === "string" ? { state: response.state } : {}),
    ...(typeof response.expiresAt === "string" ? { expiresAt: response.expiresAt } : {}),
  };
  return result.state === "responded" ? withRemoteResponse(apiUrl, sender, messageId, result, knownDevices) : result;
}

export async function remoteWait(
  apiUrl: string,
  sender: SenderRecord,
  input: WaitInput,
  knownDevices: readonly MessageTargetDevice[] = [],
): Promise<AgentNotifierResult> {
  const started = Date.now();
  while (Date.now() - started <= input.timeoutMs) {
    const status = await remoteStatus(apiUrl, sender, input.messageId, knownDevices);
    if (status.state === input.state) return status;
    await new Promise((resolve) => setTimeout(resolve, input.intervalMs));
  }
  return {
    ok: false,
    kind: "wait_for_message_state",
    state: "timeout",
    transport: "http_api",
    at: new Date().toISOString(),
    apiUrl,
    senderId: sender.id,
    messageId: input.messageId,
    error: { code: "timeout", message: `Timed out waiting for ${input.messageId} to reach ${input.state}.` },
  };
}

export async function remoteSendMessage(apiUrl: string, sender: SenderRecord, input: SendInput, message: LocalMessageRecord): Promise<AgentNotifierResult> {
  if (!sender.signingPrivateKeyPkcs8) {
    return liveBlocked("send_message", apiUrl, "Sender signing key is not available locally.");
  }
  const targets = await senderTargets(apiUrl, sender);
  message.targetDevices = targets.devices.map(({ deviceId, signingPublicKey }) => ({ deviceId, signingPublicKey }));
  const metadata: ServerVisibleMessageMetadata = {
    schemaVersion: 1,
    messageId: message.id.replace("msg_local_", "msg_"),
    recipientId: targets.recipientId,
    senderId: targets.senderId,
    mode: input.mode,
    createdAt: message.createdAt,
    expiresAt: message.expiresAt,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };
  const plaintext: MessagePlaintext = {
    schemaVersion: 1,
    title: input.title,
    body: input.body,
    sensitive: input.sensitive,
    mode: input.mode,
    createdAt: message.createdAt,
    request: requestPlaintext(input),
  };
  const aad = ownedBuffer(messageContentAadBytes(metadata));
  const sealed = await sealContentForDevices({
    plaintext: ownedBuffer(utf8ToBytes(canonicalJson(plaintext))),
    aad,
    devices: await Promise.all(targets.devices.map(async (device) => ({
      deviceId: device.deviceId,
      publicKey: await importEncryptionPublicKey(device.encryptionPublicKey),
    }))),
  });
  const unsigned: Omit<MessageSubmissionEnvelope, "senderSignature"> = {
    schemaVersion: 1,
    metadata,
    ciphertext: sealed.ciphertext,
    contentNonce: sealed.contentNonce,
    contentAadHash: sealed.contentAadHash,
    keyWraps: sealed.keyWraps,
  };
  const senderSignature = await signP256Sha256(
    await importSigningPrivateKey(sender.signingPrivateKeyPkcs8),
    ownedBuffer(messageEnvelopeSigningBytes(unsigned)),
  );
  const body: MessageSubmissionEnvelope = { ...unsigned, senderSignature };
  const endpoint = createApiClient(apiUrl).api.senders.messages;
  const response = await signedFetch({ apiUrl, sender, method: "POST", path: endpointPath(endpoint.$url(undefined)), body }) as Record<string, unknown>;
  return {
    ok: true,
    kind: input.mode,
    state: typeof response.state === "string" ? response.state : "accepted",
    transport: "http_api",
    at: message.createdAt,
    apiUrl,
    messageId: typeof response.messageId === "string" ? response.messageId : metadata.messageId,
    senderId: targets.senderId,
    recipientId: targets.recipientId,
    expiresAt: metadata.expiresAt,
    serverAccepted: true,
  };
}

function liveBlocked(kind: string, apiUrl: string, message: string): AgentNotifierResult {
  return {
    ok: false,
    kind,
    transport: "http_api",
    at: new Date().toISOString(),
    apiUrl,
    serverAccepted: false,
    error: { code: "live_transport_blocked", message },
  };
}

async function senderTargets(apiUrl: string, sender: SenderRecord): Promise<{
  senderId: string;
  recipientId: string;
  devices: Array<{ deviceId: string; encryptionPublicKey: string; signingPublicKey: string }>;
}> {
  const endpoint = createApiClient(apiUrl).api.senders.targets;
  const response = await signedFetch({ apiUrl, sender, method: "GET", path: endpointPath(endpoint.$url(undefined)) }) as Record<string, unknown>;
  const devices = Array.isArray(response.devices) ? response.devices.filter(isDeviceTarget) : [];
  if (typeof response.senderId !== "string" || typeof response.recipientId !== "string" || devices.length === 0) {
    throw new Error("API did not return active recipient device targets.");
  }
  return { senderId: response.senderId, recipientId: response.recipientId, devices };
}

function isDeviceTarget(value: unknown): value is { deviceId: string; encryptionPublicKey: string; signingPublicKey: string } {
  return typeof value === "object" && value !== null &&
    typeof (value as { deviceId?: unknown }).deviceId === "string" &&
    typeof (value as { encryptionPublicKey?: unknown }).encryptionPublicKey === "string" &&
    typeof (value as { signingPublicKey?: unknown }).signingPublicKey === "string";
}

async function withRemoteResponse(
  apiUrl: string,
  sender: SenderRecord,
  messageId: string,
  result: AgentNotifierResult,
  knownDevices: readonly MessageTargetDevice[],
): Promise<AgentNotifierResult> {
  try {
    const endpoint = createApiClient(apiUrl).api.senders.messages[":messageId"].response;
    const path = endpointPath(endpoint.$url({ param: { messageId } }));
    const json = await signedFetch({ apiUrl, sender, method: "GET", path });
    const envelope = parseResponseEnvelope(json);
    const devices = knownDevices.length > 0
      ? knownDevices
      : (await senderTargets(apiUrl, sender)).devices.map(({ deviceId, signingPublicKey }) => ({ deviceId, signingPublicKey }));
    const response = await decryptSenderResponse({ sender, envelope, devices });
    return { ...result, responseRef: response.responseId, response };
  } catch (error) {
    return {
      ...result,
      warning: `Message is responded, but the encrypted response is not yet fetchable or decryptable: ${errorMessage(error)}`,
    };
  }
}

function requestPlaintext(input: SendInput): MessagePlaintext["request"] {
  if (input.mode === "request_reply") {
    return { kind: "reply", ...(input.prompt ? { prompt: input.prompt } : {}) };
  }
  if (input.mode === "request_approval") {
    return {
      kind: "approval",
      actionLabel: input.actionLabel ?? "Approve",
      ...(input.risk ? { riskText: input.risk } : {}),
    };
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
