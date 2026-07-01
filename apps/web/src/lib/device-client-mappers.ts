import type { MessagePlaintext } from "@agent-notifier/protocol";

import type { Message, PreviewPolicy, Sender } from "../types";

export type ApiSenderDraft = {
  displayName?: string;
  kind?: string;
  machineLabel?: string;
  previewPolicy?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  encryptionPublicKey?: string;
};

export function apiSenderToLocal(sender: ApiSenderDraft & { id?: string; senderId?: string }, lastUsedAt?: string): Sender {
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

export function requestToLocal(request: NonNullable<MessagePlaintext["request"]>): NonNullable<Message["request"]> {
  if (request.kind === "reply") return { ...(request.prompt ? { prompt: request.prompt } : {}) };
  return { actionLabel: request.actionLabel, ...(request.riskText ? { riskText: request.riskText } : {}) };
}

function previewPolicy(value: unknown): PreviewPolicy {
  if (value === "always_hide") return "always_hide";
  if (value === "allow_agent_choice") return "agent_choice";
  return "hide_sensitive";
}
