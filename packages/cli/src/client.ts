import { sha256Base64Url, utf8ToBytes } from "@agent-notifier/crypto";
import { canonicalJson } from "@agent-notifier/protocol";
import type { AgentNotifierResult, LocalMessageRecord, SendInput, SenderRecord, SetupInput, WaitInput } from "./contracts.js";
import { isDeliveryState } from "./contracts.js";
import { fromNow } from "./duration.js";
import { ensureSenderIdentity } from "./identity.js";
import { remotePairingStatus, remoteSendMessage, remoteStatus, remoteWait, startRemoteSetup } from "./remote.js";
import { createId, ensureSender, findMessage, hasRecentDuplicate, readState, writeState } from "./store.js";
import { shouldUseApi, transportConfig } from "./transport.js";

const DEFAULT_MESSAGE_TTL_MS = 14 * 86_400_000;
const DEFAULT_REQUEST_TTL_MS = 30 * 60_000;
const DUPLICATE_WINDOW_MS = 30_000;

function now(): string {
  return new Date().toISOString();
}

function localWarning(): string {
  return "Only local sender configuration was updated; no Worker API request was made.";
}

export async function setupNotifier(input: SetupInput): Promise<AgentNotifierResult> {
  const state = await readState();
  const sender = ensureSender(state, input.senderName, input.senderKind);
  const config = transportConfig(state, input);
  if (shouldUseApi(config)) {
    await ensureSenderIdentity(sender, input.senderName, input.senderKind);
    state.apiBaseUrl = config.apiUrl;
    await writeState(state);
    const result = await startRemoteSetup(config.apiUrl, input, sender);
    if (result.sessionId) sender.pairingSessionId = result.sessionId;
    if (input.secret) sender.pairingSecret = input.secret;
    applyPairingResult(sender, result);
    await writeState(state);
    return result;
  }

  await writeState(state);
  if (input.email || input.code) {
    return {
      ok: false,
      kind: input.email ? "setup_email" : "setup_code",
      state: "api_not_configured",
      transport: "local_config",
      at: now(),
      senderId: sender.id,
      serverAccepted: false,
      warning: localWarning(),
      error: {
        code: "api_not_configured",
        message: "Live setup requires --api-url or AGENT_NOTIFIER_API_URL; no setup email or code claim was sent.",
      },
    };
  }

  return {
    ok: true,
    kind: "setup",
    state: "needs_setup_method",
    transport: "local_config",
    at: now(),
    senderId: sender.id,
    serverAccepted: false,
    next: "Prefer email setup with --email and --api-url; use --code with --secret as a fallback.",
  };
}

export async function sendMessage(input: SendInput): Promise<AgentNotifierResult> {
  const state = await readState();
  const sender = ensureSender(state, input.senderName);
  const requestTtl = input.mode === "notify" ? DEFAULT_MESSAGE_TTL_MS : DEFAULT_REQUEST_TTL_MS;
  const message: LocalMessageRecord = {
    id: createId("msg_local"),
    senderId: sender.id,
    mode: input.mode,
    state: "accepted",
    createdAt: now(),
    expiresAt: fromNow(input.expiresInMs ?? requestTtl),
    dedupeKey: await localDedupeKey(input),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };

  if (hasRecentDuplicate(state, message, DUPLICATE_WINDOW_MS)) {
    return {
      ok: false,
      kind: "send_message",
      state: "duplicate_suppressed",
      transport: "local_config",
      at: now(),
      senderId: sender.id,
      error: {
        code: "duplicate_suppressed",
        message: "An identical local message was already accepted in the last 30 seconds.",
      },
    };
  }

  const config = transportConfig(state);
  if (!shouldUseApi(config)) {
    await writeState(state);
    return {
      ok: false,
      kind: input.mode,
      state: "api_not_configured",
      transport: "local_config",
      at: now(),
      senderId: sender.id,
      serverAccepted: false,
      warning: "No plaintext message was stored locally or sent remotely.",
      error: {
        code: "api_not_configured",
        message: "Live send requires AGENT_NOTIFIER_API_URL or a stored API URL from setup.",
      },
    };
  }

  await ensureSenderIdentity(sender, input.senderName, undefined);
  await writeState(state);
  await refreshPairing(config.apiUrl, sender);
  if (sender.id.startsWith("snd_local")) {
    await writeState(state);
    return {
      ok: false,
      kind: "send_message",
      state: "setup_required",
      transport: "http_api",
      at: now(),
      apiUrl: config.apiUrl,
      senderId: sender.id,
      serverAccepted: false,
      error: {
        code: "setup_not_paired",
        message: "Live send requires a paired server sender. Run setup status for the pairing session or finish setup on the device.",
      },
    };
  }

  const result = await remoteSendMessage(config.apiUrl, sender, input, message);
  applyPairingResult(sender, result);
  if (result.ok) {
    message.id = result.messageId ?? message.id;
    message.senderId = sender.id;
    if (result.state && isDeliveryState(result.state)) message.state = result.state;
    state.messages.push(message);
  }
  await writeState(state);
  return result;
}

export async function getMessageStatus(messageId: string): Promise<AgentNotifierResult> {
  const state = await readState();
  const config = transportConfig(state);
  const sender = state.senders.find((candidate) => !candidate.revokedAt);
  if (shouldUseApi(config) && messageId.startsWith("pair_")) {
    const status = await remotePairingStatus(config.apiUrl, messageId, sender?.pairingSecret);
    if (sender) {
      applyPairingResult(sender, status);
      await writeState(state);
    }
    return status;
  }
  if (shouldUseApi(config) && sender?.id && !sender.id.startsWith("snd_local")) {
    return remoteStatus(config.apiUrl, sender, messageId);
  }

  const message = findMessage(state, messageId);
  if (!message) {
    return {
      ok: false,
      kind: "message_status",
      transport: "local_config",
      at: now(),
      error: {
        code: "message_not_found",
        message: `No local status record found for ${messageId}.`,
      },
    };
  }

  return {
    ok: true,
    kind: "message_status",
    state: message.state,
    transport: "local_config",
    at: now(),
    messageId: message.id,
    senderId: message.senderId,
    expiresAt: message.expiresAt,
    serverAccepted: false,
    ...(message.responseRef ? { responseRef: message.responseRef } : {}),
  };
}

export async function waitForMessageState(input: WaitInput): Promise<AgentNotifierResult> {
  const state = await readState();
  const config = transportConfig(state);
  const sender = state.senders.find((candidate) => !candidate.revokedAt);
  if (shouldUseApi(config) && sender?.id && !sender.id.startsWith("snd_local")) {
    return remoteWait(config.apiUrl, sender, input);
  }

  const started = Date.now();
  while (Date.now() - started <= input.timeoutMs) {
    const status = await getMessageStatus(input.messageId);
    if (status.ok && status.state === input.state) return status;
    await new Promise((resolve) => setTimeout(resolve, input.intervalMs));
  }

  return {
    ok: false,
    kind: "wait_for_message_state",
    state: "timeout",
    transport: "local_config",
    at: now(),
    messageId: input.messageId,
    error: {
      code: "timeout",
      message: `Timed out waiting for ${input.messageId} to reach ${input.state}.`,
    },
  };
}

export async function listSenders(): Promise<AgentNotifierResult> {
  const state = await readState();
  return {
    ok: true,
    kind: "senders_list",
    transport: "local_config",
    at: now(),
    senders: state.senders,
  };
}

export async function revokeSender(senderId: string): Promise<AgentNotifierResult> {
  const state = await readState();
  const sender = state.senders.find((candidate) => candidate.id === senderId);
  if (!sender) {
    return {
      ok: false,
      kind: "sender_revoke",
      transport: "local_config",
      at: now(),
      senderId,
      error: {
        code: "sender_not_found",
        message: `No local sender found for ${senderId}.`,
      },
    };
  }

  sender.revokedAt = now();
  await writeState(state);
  return {
    ok: true,
    kind: "sender_revoke",
    state: "revoked",
    transport: "local_config",
    at: sender.revokedAt,
    senderId,
    serverAccepted: false,
    warning: localWarning(),
  };
}

async function refreshPairing(apiUrl: string, sender: SenderRecord): Promise<void> {
  if (!sender.pairingSessionId || !sender.id.startsWith("snd_local")) return;
  applyPairingResult(sender, await remotePairingStatus(apiUrl, sender.pairingSessionId, sender.pairingSecret));
}

function applyPairingResult(sender: SenderRecord, result: AgentNotifierResult): void {
  if (result.senderId && !result.senderId.startsWith("snd_local")) sender.id = result.senderId;
  if (result.recipientId) sender.recipientId = result.recipientId;
}

async function localDedupeKey(input: SendInput): Promise<string> {
  return sha256Base64Url(utf8ToBytes(canonicalJson({
    mode: input.mode,
    title: input.title,
    body: input.body,
    sensitive: input.sensitive,
    ...(input.actionLabel ? { actionLabel: input.actionLabel } : {}),
    ...(input.prompt ? { prompt: input.prompt } : {}),
    ...(input.risk ? { risk: input.risk } : {}),
  })));
}
