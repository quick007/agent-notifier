import type { AppState, Message, Sender } from "../types";

const now = new Date("2026-06-30T17:20:00.000Z");

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

function minutesAhead(minutes: number) {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export const sampleSenders: Sender[] = [
  {
    id: "snd_codex_sessions",
    displayName: "Codex on Luca's PC - sessions",
    kind: "codex",
    machineLabel: "Windows workstation",
    lastUsedAt: minutesAgo(8),
    previewPolicy: "agent_choice",
    capabilities: {
      notify: true,
      requestReply: true,
      requestApproval: true
    }
  },
  {
    id: "snd_ci_release",
    displayName: "GitHub Actions - release",
    kind: "ci",
    machineLabel: "CI runner",
    lastUsedAt: minutesAgo(74),
    previewPolicy: "hide_sensitive",
    capabilities: {
      notify: true,
      requestReply: false,
      requestApproval: true
    }
  }
];

export const sampleMessages: Message[] = [
  {
    id: "msg_publish",
    senderId: "snd_ci_release",
    mode: "request_approval",
    title: "Approve production deploy?",
    body: "Release 1.4.2 passed checks and is waiting for your signed approval.",
    sensitive: false,
    createdAt: minutesAgo(8),
    expiresAt: minutesAhead(22),
    deliveryState: "delivered",
    saved: false,
    deleted: false,
    request: {
      actionLabel: "Publish release",
      riskText: "This returns human intent only. Agent Notifier will not run it."
    }
  },
  {
    id: "msg_blocked",
    senderId: "snd_codex_sessions",
    mode: "request_reply",
    title: "Need target browser",
    body: "Should I validate the notification flow in Chrome, Edge, or both?",
    sensitive: false,
    createdAt: minutesAgo(21),
    expiresAt: minutesAhead(39),
    deliveryState: "delivered",
    saved: true,
    deleted: false,
    request: {
      prompt: "Short answer is enough."
    }
  },
  {
    id: "msg_sensitive",
    senderId: "snd_codex_sessions",
    mode: "notify",
    title: "Private log review finished",
    body: "The local scan completed. Open the app to read the decrypted result.",
    sensitive: true,
    createdAt: minutesAgo(64),
    deliveryState: "delivered",
    saved: false,
    deleted: false
  },
  {
    id: "msg_done",
    senderId: "snd_codex_sessions",
    mode: "notify",
    title: "Chrome Web Store monitor is live",
    body: "The hourly check is running. You will get a phone alert when the listing changes.",
    sensitive: false,
    createdAt: minutesAgo(180),
    deliveryState: "responded",
    saved: false,
    deleted: false
  }
];

export const defaultState: AppState = {
  settings: {
    deviceReady: false,
    deviceName: "This device",
    globalPreviewPolicy: "hide_sensitive",
    localRetentionDays: 30,
    pushState: "default",
    pairing: { status: "idle" }
  },
  senders: [],
  messages: []
};

export function pairedDemoState(): AppState {
  return {
    settings: {
      ...defaultState.settings,
      deviceReady: true,
      email: "luca@example.com",
      pushState: "paired_no_push"
    },
    senders: sampleSenders,
    messages: sampleMessages
  };
}
