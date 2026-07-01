import type { AppState } from "../types";

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

/**
 * State after a first successful pairing. The inbox starts empty: real messages
 * only appear once a paired agent sends one. No placeholder content ships by
 * default.
 */
export function pairedState(current: AppState): AppState {
  return {
    ...current,
    settings: {
      ...current.settings,
      deviceReady: true,
      pairing: { ...current.settings.pairing, status: "paired" }
    }
  };
}
