import {
  getMessageStatus,
  listSenders,
  sendMessage,
  setupNotifier,
  waitForMessageState,
} from "@agent-notifier/cli/client";
import { DELIVERY_STATES, SENDER_KINDS, isDeliveryState, isSenderKind } from "@agent-notifier/cli";
import type { DeliveryState, SendInput, SetupInput } from "@agent-notifier/cli";
import { usagePolicyPayload } from "./policy.js";

type Args = Record<string, unknown>;

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const titleBodySchema = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required: ["title", "body"],
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    sensitive: { type: "boolean", default: true },
    senderName: { type: "string" },
    idempotencyKey: { type: "string" },
    ...extra,
  },
});

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "setup_notifier",
    description: "Start local setup state for Agent Notifier. Ask before sending setup email unless delegated.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        email: { type: "string" },
        code: { type: "string" },
        senderName: { type: "string" },
        senderKind: { enum: SENDER_KINDS },
      },
    },
  },
  {
    name: "send_notification",
    description: "Send a meaningful one-way notification.",
    inputSchema: titleBodySchema(),
  },
  {
    name: "request_reply",
    description: "Ask the user for a short freeform reply.",
    inputSchema: titleBodySchema({
      prompt: { type: "string" },
    }),
  },
  {
    name: "request_approval",
    description: "Ask for approval or rejection of an action that already needs consent.",
    inputSchema: titleBodySchema({
      actionLabel: { type: "string" },
      risk: { type: "string" },
    }),
  },
  {
    name: "get_message_status",
    description: "Read sender-visible message state.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["messageId"],
      properties: { messageId: { type: "string" } },
    },
  },
  {
    name: "wait_for_message_state",
    description: "Wait for a message to reach accepted, delivered, responded, or expired.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["messageId", "state"],
      properties: {
        messageId: { type: "string" },
        state: { enum: DELIVERY_STATES },
        timeoutMs: { type: "number", minimum: 0 },
        intervalMs: { type: "number", minimum: 1 },
      },
    },
  },
  {
    name: "list_senders",
    description: "List locally known sender records.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "explain_usage_policy",
    description: "Return compact policy guidance for using Agent Notifier safely.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
];

function stringArg(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function boolArg(args: Args, key: string, fallback: boolean): boolean {
  const value = args[key];
  return typeof value === "boolean" ? value : fallback;
}

function numberArg(args: Args, key: string, fallback: number): number {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function setupInput(args: Args): SetupInput {
  const input: SetupInput = {};
  const email = stringArg(args, "email");
  const code = stringArg(args, "code");
  const senderName = stringArg(args, "senderName");
  const senderKind = stringArg(args, "senderKind");
  if (email) input.email = email;
  if (code) input.code = code;
  if (senderName) input.senderName = senderName;
  if (senderKind && isSenderKind(senderKind)) {
    input.senderKind = senderKind;
  }
  return input;
}

function sendInput(args: Args, mode: SendInput["mode"]): SendInput {
  const title = stringArg(args, "title");
  const body = stringArg(args, "body");
  if (!title || !body) {
    throw new Error("title and body are required");
  }
  const input: SendInput = {
    mode,
    title,
    body,
    sensitive: boolArg(args, "sensitive", true),
  };
  const senderName = stringArg(args, "senderName");
  const idempotencyKey = stringArg(args, "idempotencyKey");
  const actionLabel = stringArg(args, "actionLabel");
  const prompt = stringArg(args, "prompt");
  const risk = stringArg(args, "risk");
  if (senderName) input.senderName = senderName;
  if (idempotencyKey) input.idempotencyKey = idempotencyKey;
  if (actionLabel) input.actionLabel = actionLabel;
  if (prompt) input.prompt = prompt;
  if (risk) input.risk = risk;
  return input;
}

function stateArg(value: string | undefined): DeliveryState {
  if (value && isDeliveryState(value)) {
    return value;
  }
  throw new Error("state must be accepted, delivered, responded, or expired");
}

export async function callTool(name: string, args: Args): Promise<unknown> {
  if (name === "setup_notifier") {
    return setupNotifier(setupInput(args));
  }
  if (name === "send_notification") {
    return sendMessage(sendInput(args, "notify"));
  }
  if (name === "request_reply") {
    return sendMessage(sendInput(args, "request_reply"));
  }
  if (name === "request_approval") {
    return sendMessage(sendInput(args, "request_approval"));
  }
  if (name === "get_message_status") {
    const messageId = stringArg(args, "messageId");
    if (!messageId) throw new Error("messageId is required");
    return getMessageStatus(messageId);
  }
  if (name === "wait_for_message_state") {
    const messageId = stringArg(args, "messageId");
    if (!messageId) throw new Error("messageId is required");
    return waitForMessageState({
      messageId,
      state: stateArg(stringArg(args, "state")),
      timeoutMs: numberArg(args, "timeoutMs", 30_000),
      intervalMs: numberArg(args, "intervalMs", 1_000),
    });
  }
  if (name === "list_senders") {
    return listSenders();
  }
  if (name === "explain_usage_policy") {
    return usagePolicyPayload();
  }
  throw new Error(`Unknown tool: ${name}`);
}
