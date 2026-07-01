import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { LocalMessageRecord, SenderKind, SenderRecord, StoredState } from "./contracts.js";
import { createLocalSender } from "./identity.js";

const DEFAULT_STATE: StoredState = {
  version: 1,
  senders: [],
  messages: [],
};

export function statePath(): string {
  return process.env.AGENT_NOTIFIER_STATE_FILE ?? join(homedir(), ".agent-notifier", "state.json");
}

export async function readState(): Promise<StoredState> {
  try {
    const text = await readFile(statePath(), "utf8");
    const parsed = JSON.parse(text) as StoredState;
    const apiBaseUrl = typeof parsed.apiBaseUrl === "string" ? parsed.apiBaseUrl : undefined;
    return {
      version: 1,
      ...(apiBaseUrl ? { apiBaseUrl } : {}),
      senders: Array.isArray(parsed.senders) ? parsed.senders : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_STATE, senders: [], messages: [] };
    }
    throw error;
  }
}

export async function writeState(state: StoredState): Promise<void> {
  const target = statePath();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

export function createId(prefix: string): string {
  const random = crypto.getRandomValues(new Uint8Array(10));
  const suffix = Buffer.from(random).toString("base64url").slice(0, 14);
  return `${prefix}_${suffix}`;
}

export function ensureSender(
  state: StoredState,
  displayName = "Agent Notifier local sender",
  kind: SenderKind = "generic",
): SenderRecord {
  const active = state.senders.find((sender) => !sender.revokedAt);
  if (active) {
    return active;
  }

  const sender = createLocalSender(displayName, kind);
  state.senders.push(sender);
  return sender;
}

export function findMessage(state: StoredState, messageId: string): LocalMessageRecord | undefined {
  return state.messages.find((message) => message.id === messageId);
}

export function hasRecentDuplicate(state: StoredState, message: LocalMessageRecord, withinMs: number): boolean {
  const createdAt = Date.parse(message.createdAt);
  return state.messages.some((existing) => {
    if (existing.senderId !== message.senderId || existing.mode !== message.mode) {
      return false;
    }
    if (existing.dedupeKey !== message.dedupeKey) {
      return false;
    }
    return createdAt - Date.parse(existing.createdAt) >= 0 && createdAt - Date.parse(existing.createdAt) < withinMs;
  });
}
