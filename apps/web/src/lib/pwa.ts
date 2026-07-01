import type { Message, PreviewPolicy, PushState, Sender } from "../types";
import { shouldHidePreview } from "./format";

export type PwaStatus = {
  pushState: PushState;
  serviceWorkerReady: boolean;
  standalone: boolean;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    "standalone" in navigator
  );
}

export function detectPushState(): PushState {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted_missing_subscription";
  }

  return "default";
}

export async function registerServiceWorker(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  try {
    await navigator.serviceWorker.register("/sw.js");
    return true;
  } catch {
    return false;
  }
}

export async function requestPushPermission(): Promise<PushState> {
  const registered = await registerServiceWorker();
  if (!registered) return "service_worker_error";
  if (!("Notification" in window)) return "unsupported";

  const result = await Notification.requestPermission();
  if (result === "denied") return "denied";
  if (result === "granted") {
    await getPushSubscription().catch(() => null);
    return "granted_missing_subscription";
  }
  return "default";
}

export async function getPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  if (!("Notification" in window) || Notification.permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing.toJSON();

  const publicKey = await loadVapidPublicKey();
  if (!publicKey) return null;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(publicKey)
  });
  return subscription.toJSON();
}

export async function sendTestNotification() {
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: "agent-notifier:test-notification" });
}

export async function showMessageNotification(
  message: Message,
  sender: Sender | undefined,
  policy: PreviewPolicy
) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.ready;
  const hide = shouldHidePreview(message, sender, policy);
  await registration.showNotification(hide ? "Agent Notifier" : message.title, {
    body: hide ? "New encrypted notification" : message.body,
    icon: "/icons/icon.svg",
    tag: `agent-notifier-${message.id}`,
    data: { url: `/message/${message.id}` },
    ...(sender ? { badge: "/icons/icon.svg" } : {})
  });
}

export function getPwaStatus(): PwaStatus {
  return {
    pushState: detectPushState(),
    serviceWorkerReady: "serviceWorker" in navigator,
    standalone: isStandalone()
  };
}

async function loadVapidPublicKey(): Promise<string | null> {
  const response = await fetch("/api/push/vapid-public-key");
  if (!response.ok) return null;
  const json = await response.json().catch(() => ({})) as { publicKey?: unknown };
  return typeof json.publicKey === "string" ? json.publicKey : null;
}

function base64UrlToBytes(value: string): ArrayBuffer {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
