import { flagBoolean, flagString, parseArgs } from "./args.js";
import { listSenders, getMessageStatus, revokeSender, sendMessage, setupNotifier, waitForMessageState } from "./client.js";
import { isDeliveryState, isSenderKind } from "./contracts.js";
import type { AgentNotifierResult, DeliveryState, MessageMode, SenderKind, SetupInput } from "./contracts.js";
import { parseDuration } from "./duration.js";

function requireValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing required ${label}`);
  }
  return value;
}

function deliveryState(value: string | undefined, fallback: DeliveryState): DeliveryState {
  if (!value) {
    return fallback;
  }
  if (!isDeliveryState(value)) {
    throw new Error(`Invalid delivery state: ${value}`);
  }
  return value;
}

function senderKind(value: string | undefined): SenderKind {
  if (value && isSenderKind(value)) {
    return value;
  }
  return "generic";
}

function sensitiveFlag(flags: Record<string, string | boolean>): boolean {
  if (flagBoolean(flags, "non-sensitive")) {
    return false;
  }
  return true;
}

async function handleSetup(subcommand: string | undefined, flags: Record<string, string | boolean>): Promise<AgentNotifierResult> {
  const email = flagString(flags, "email") ?? (subcommand === "email" ? flagString(flags, "to") : undefined);
  const code = flagString(flags, "code") ?? (subcommand === "code" ? flagString(flags, "value") : undefined);
  const secret = flagString(flags, "secret");
  const senderName = flagString(flags, "sender-name");
  const apiUrl = flagString(flags, "api-url");
  const input: SetupInput = {
    senderKind: senderKind(flagString(flags, "sender-kind")),
    localOnly: flagBoolean(flags, "local-only"),
  };
  if (email) {
    input.email = email;
  }
  if (code) {
    input.code = code;
  }
  if (secret) {
    input.secret = secret;
  }
  if (senderName) {
    input.senderName = senderName;
  }
  if (apiUrl) {
    input.apiUrl = apiUrl;
  }
  return setupNotifier(input);
}

async function handleSend(mode: MessageMode, flags: Record<string, string | boolean>): Promise<AgentNotifierResult> {
  const expiresIn = flagString(flags, "expires-in");
  const senderName = flagString(flags, "sender-name");
  const idempotencyKey = flagString(flags, "idempotency-key");
  const actionLabel = flagString(flags, "action-label");
  const prompt = flagString(flags, "prompt");
  const risk = flagString(flags, "risk");
  const result = await sendMessage({
    mode,
    title: requireValue(flagString(flags, "title"), "--title"),
    body: requireValue(flagString(flags, "body"), "--body"),
    sensitive: sensitiveFlag(flags),
    ...(senderName ? { senderName } : {}),
    ...(expiresIn ? { expiresInMs: parseDuration(expiresIn) } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(actionLabel ? { actionLabel } : {}),
    ...(prompt ? { prompt } : {}),
    ...(risk ? { risk } : {}),
  });

  const waitFor = flagBoolean(flags, "wait")
    ? deliveryState(flagString(flags, "wait-for"), mode === "notify" ? "delivered" : "responded")
    : flagString(flags, "wait-for");
  if (result.ok && result.messageId && waitFor) {
    return waitForMessageState({
      messageId: result.messageId,
      state: deliveryState(waitFor, "delivered"),
      timeoutMs: parseDuration(flagString(flags, "timeout") ?? "30s", "s"),
      intervalMs: 1_000,
    });
  }
  return result;
}

export async function runCli(argv: string[]): Promise<AgentNotifierResult> {
  const parsed = parseArgs(argv);
  const [command, subcommand] = parsed.command;

  if (!command || command === "help" || command === "--help") {
    return {
      ok: true,
      kind: "help",
      state: "available",
      transport: "local_config",
      at: new Date().toISOString(),
      next: "Commands: setup, setup email, setup code, notify, reply, approve, status, senders list, senders revoke.",
    };
  }

  if (command === "setup") {
    return handleSetup(subcommand, parsed.flags);
  }
  if (command === "email") {
    const email = flagString(parsed.flags, "email") ?? parsed.positional[0];
    return handleSetup("email", email ? { ...parsed.flags, email } : parsed.flags);
  }
  if (command === "code") {
    const code = flagString(parsed.flags, "code") ?? parsed.positional[0];
    return handleSetup("code", code ? { ...parsed.flags, code } : parsed.flags);
  }
  if (command === "notify") {
    return handleSend("notify", parsed.flags);
  }
  if (command === "reply") {
    return handleSend("request_reply", parsed.flags);
  }
  if (command === "approve") {
    return handleSend("request_approval", parsed.flags);
  }
  if (command === "status") {
    return getMessageStatus(requireValue(subcommand ?? parsed.positional[0], "message id"));
  }
  if (command === "senders" && subcommand === "list") {
    return listSenders();
  }
  if (command === "senders" && subcommand === "revoke") {
    return revokeSender(requireValue(parsed.positional[0], "sender id"));
  }

  throw new Error(`Unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`);
}
