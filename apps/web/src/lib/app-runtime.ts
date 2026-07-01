import {
  approvePairing,
  createDeviceIdentity,
  fetchPendingMessages,
  getPairingStatus,
  listSenders,
  markDelivered,
  registerDevice,
  revokeSender as revokeSenderRemote,
  submitMessageResponse,
  updatePushSubscription,
  type DecodedPendingMessage,
  type MessageResponseDraft
} from "./device-client";
import { getPushSubscription, showMessageNotification } from "./pwa";
import { writeStoredState } from "./storage";
import type { AppState, DeviceIdentity, Message, PairingState, PreviewPolicy, PushState, Sender } from "../types";

export async function completePairingState(current: AppState): Promise<AppState> {
  const pairing = current.settings.pairing;
  const remote = await getPairingStatus(pairing);
  if (remote.status === "expired") throw new Error("Pairing session expired.");
  if (!remote.sender) throw new Error("Waiting for sender details.");

  let device = current.device ?? await createDeviceIdentity(current.settings.deviceName);
  if (!device.deviceId) {
    device = await registerDevice(deviceRegistration(device, pairing, remote.recipientId));
  }

  const approved = await approvePairing(device, pairing);
  const recipientId = typeof approved.recipientId === "string" ? approved.recipientId : device.recipientId;
  device = {
    ...device,
    ...(recipientId ? { recipientId } : {})
  };
  const pushState = await syncPushState(device);
  const remoteSenders = await listSenders(device);
  return {
    ...current,
    device,
    senders: mergeSenders(current.senders, remoteSenders),
    settings: {
      ...current.settings,
      deviceReady: true,
      pushState,
      pairing: {
        ...pairing,
        status: "paired",
        ...(remote.sender.displayName ? { senderDisplayName: remote.sender.displayName } : {})
      }
    }
  };
}

export async function syncPushState(device: DeviceIdentity): Promise<PushState> {
  const subscription = await getPushSubscription().catch(() => null);
  if (!subscription) return "paired_no_push";
  return (await updatePushSubscription(device, subscription)) ? "granted" : "paired_no_push";
}

export async function syncPendingState(current: AppState, policy: PreviewPolicy): Promise<AppState | null> {
  if (!current.device?.deviceId) return null;
  const device = current.device;
  const decoded = await fetchPendingMessages(device).catch(() => []);
  if (decoded.length === 0) return null;

  const next = mergePending(current, decoded);
  await writeStoredState(next);
  await Promise.all(decoded.map(({ message }) => markDelivered(device, message.id).catch(() => undefined)));
  await Promise.all(decoded
    .filter(({ message }) => !current.messages.some((item) => item.id === message.id))
    .map(({ message, sender }) => showMessageNotification(message, sender, policy)));
  return next;
}

export async function submitResponseForMessage(
  current: AppState,
  messageId: string,
  response: MessageResponseDraft
): Promise<NonNullable<Message["response"]>> {
  const { device, message, sender } = responseContext(current, messageId);
  return submitMessageResponse(device, message, sender, response);
}

export async function revokeSenderForDevice(current: AppState, senderId: string): Promise<void> {
  if (!current.device?.deviceId) throw new Error("Device is not registered.");
  await revokeSenderRemote(current.device, senderId);
}

export function applyPairingStatus(
  pairing: PairingState,
  remote: Awaited<ReturnType<typeof getPairingStatus>>
): PairingState {
  if (remote.status === "claimed" || remote.status === "pending") {
    return {
      ...pairing,
      status: remote.status === "claimed" ? "claimed" : pairing.status === "email_link" ? "email_link" : "pending",
      ...(remote.sender?.displayName ? { senderDisplayName: remote.sender.displayName } : {}),
      ...(remote.expiresAt ? { expiresAt: remote.expiresAt } : {})
    };
  }
  if (remote.status === "expired") {
    return { ...pairing, status: "expired", ...(remote.expiresAt ? { expiresAt: remote.expiresAt } : {}) };
  }
  return pairing;
}

export function pairingErrorState(current: AppState, error: unknown): AppState {
  return {
    ...current,
    settings: {
      ...current.settings,
      pairing: {
        ...current.settings.pairing,
        status: "error",
        error: error instanceof Error ? error.message : "Pairing failed."
      }
    }
  };
}

function deviceRegistration(device: DeviceIdentity, pairing: PairingState, recipientId?: string) {
  return {
    device,
    pairing,
    ...(recipientId ? { recipientId } : {})
  };
}

function mergePending(current: AppState, decoded: DecodedPendingMessage[]): AppState {
  const existing = new Set(current.messages.map((message) => message.id));
  const fresh = decoded.filter(({ message }) => !existing.has(message.id)).map(({ message }) => message);
  return {
    ...current,
    senders: mergeSenders(current.senders, decoded.map(({ sender }) => sender)),
    messages: [...fresh, ...current.messages]
  };
}

function mergeSenders(current: Sender[], incoming: Sender[]): Sender[] {
  const byId = new Map(current.map((sender) => [sender.id, sender]));
  for (const sender of incoming) {
    const existing = byId.get(sender.id);
    byId.set(sender.id, existing ? { ...existing, ...sender } : sender);
  }
  return Array.from(byId.values());
}

function responseContext(current: AppState, messageId: string): { device: DeviceIdentity; message: Message; sender: Sender } {
  if (!current.device?.deviceId) throw new Error("Device is not registered.");
  const message = current.messages.find((item) => item.id === messageId);
  if (!message) throw new Error("Message was not found locally.");
  const sender = current.senders.find((item) => item.id === message.senderId);
  if (!sender) throw new Error("Sender was not found locally.");
  return { device: current.device, message, sender };
}
