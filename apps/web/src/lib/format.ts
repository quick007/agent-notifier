import type { Message, PreviewPolicy, Sender } from "../types";

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const minutes = Math.round(diff / 60_000);

  if (Math.abs(minutes) < 60) {
    return relativeFormatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return relativeFormatter.format(hours, "hour");
  }

  return relativeFormatter.format(Math.round(hours / 24), "day");
}

export function shouldHidePreview(
  message: Message,
  sender: Sender | undefined,
  globalPolicy: PreviewPolicy
) {
  if (globalPolicy === "always_hide" || sender?.previewPolicy === "always_hide") {
    return true;
  }

  return message.sensitive;
}

export function senderName(sender: Sender | undefined) {
  return sender?.displayName ?? "Unknown sender";
}

export function pendingMessage(message: Message) {
  return (
    message.deliveryState !== "expired" &&
    !message.response &&
    (message.mode === "request_reply" || message.mode === "request_approval")
  );
}

export function modeLabel(mode: Message["mode"]) {
  if (mode === "request_reply") return "Reply request";
  if (mode === "request_approval") return "Approval request";
  return "Notification";
}
