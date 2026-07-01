import type { PushState } from "../types";

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
  if (result === "granted") return "granted_missing_subscription";
  return "default";
}

export async function sendTestNotification() {
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: "agent-notifier:test-notification" });
}

export function getPwaStatus(): PwaStatus {
  return {
    pushState: detectPushState(),
    serviceWorkerReady: "serviceWorker" in navigator,
    standalone: isStandalone()
  };
}
