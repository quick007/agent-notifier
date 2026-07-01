import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { defaultState } from "../data/seed";
import {
  applyPairingStatus,
  completePairingState,
  pairingErrorState,
  revokeSenderForDevice,
  syncPendingState,
  syncPushState,
  submitResponseForMessage
} from "../lib/app-runtime";
import {
  getPairingStatus,
  startCodePairing
} from "../lib/device-client";
import type { PairingLink } from "../lib/routes";
import { readStoredState, writeStoredState } from "../lib/storage";
import type { AppState, Message, PreviewPolicy, PushState, Sender } from "../types";

export function useAppState() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);

  const finishPairing = (snapshot: AppState) => {
    const { error: _error, ...pairing } = snapshot.settings.pairing;
    updateSettings(setState, {
      pairing: { ...pairing, status: "approving" }
    });
    void completePairingState(snapshot).then(
      (paired) => {
        stateRef.current = paired;
        setState(paired);
        void runPendingSync(paired);
      },
      (error: unknown) => setState((current) => pairingErrorState(current, error))
    );
  };

  const runPendingSync = async (snapshot: AppState) => {
    const synced = await syncPendingState(snapshot, snapshot.settings.globalPreviewPolicy);
    if (!synced) return;
    stateRef.current = synced;
    setState(synced);
  };

  useEffect(() => {
    let active = true;
    readStoredState().then((stored) => {
      if (!active) return;
      setState(stored ?? defaultState);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loaded) void writeStoredState(state);
    stateRef.current = state;
  }, [loaded, state]);

  useEffect(() => {
    if (!loaded || !state.device?.deviceId) return;
    void runPendingSync(stateRef.current);
  }, [loaded, state.device?.deviceId, state.settings.globalPreviewPolicy]);

  useEffect(() => {
    if (!loaded || !("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "agent-notifier:sync-pending") {
        void runPendingSync(stateRef.current);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !state.device?.deviceId || state.settings.pushState !== "granted_missing_subscription") return;
    void syncPushState(state.device).then(
      (pushState) => updateSettings(setState, { pushState }),
      () => updateSettings(setState, { pushState: "paired_no_push" })
    );
  }, [loaded, state.device, state.settings.pushState]);

  useEffect(() => {
    const pairing = state.settings.pairing;
    if (!loaded || !pairing.kind || !pairing.sessionId) return;
    if (!["email_link", "code_ready", "pending"].includes(pairing.status)) return;

    let active = true;
    const check = async () => {
      try {
        const remote = await getPairingStatus(pairing);
        if (!active) return;
        setState((current) => ({
          ...current,
          settings: {
            ...current.settings,
            pairing: applyPairingStatus(current.settings.pairing, remote)
          }
        }));
      } catch {
        // Polling should not interrupt manual approval.
      }
    };
    void check();
    const interval = window.setInterval(check, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loaded, state.settings.pairing.kind, state.settings.pairing.sessionId, state.settings.pairing.status]);

  const api = useMemo(
    () => ({
      state,
      loaded,
      startPairing() {
        updateSettings(setState, { pairing: { status: "starting", kind: "code" } });
        void startCodePairing().then(
          (pairing) => updateSettings(setState, { pairing }),
          (error: unknown) => setState((current) => pairingErrorState(current, error))
        );
      },
      loadPairingLink(pairingLink: PairingLink) {
        setState((current) => {
          const pairing = current.settings.pairing;
          if (
            pairing.kind === "email" &&
            pairing.sessionId === pairingLink.sessionId &&
            pairing.secret === pairingLink.secret
          ) {
            return current;
          }

          return {
            ...current,
            settings: {
              ...current.settings,
              pairing: {
                status: "email_link",
                kind: "email",
                sessionId: pairingLink.sessionId,
                ...(pairingLink.secret ? { secret: pairingLink.secret } : {})
              }
            }
          };
        });
      },
      approvePairing() {
        finishPairing(stateRef.current);
      },
      setPushState(pushState: PushState) {
        updateSettings(setState, { pushState });
      },
      setGlobalPreviewPolicy(globalPreviewPolicy: PreviewPolicy) {
        updateSettings(setState, { globalPreviewPolicy });
      },
      setRetention(localRetentionDays: 7 | 30 | 90) {
        updateSettings(setState, { localRetentionDays });
      },
      toggleSave(messageId: string) {
        updateMessage(setState, messageId, (message) => ({
          ...message,
          saved: !message.saved
        }));
      },
      deleteMessage(messageId: string) {
        updateMessage(setState, messageId, (message) => ({
          ...message,
          deleted: true,
          saved: false
        }));
      },
      submitReply(messageId: string, text: string) {
        void submitResponseForMessage(stateRef.current, messageId, { kind: "reply", text }).then(
          (response) => respond(setState, messageId, response),
          () => undefined
        );
      },
      submitApproval(messageId: string, decision: "approved" | "rejected", text?: string) {
        void submitResponseForMessage(stateRef.current, messageId, {
          kind: "approval",
          decision,
          ...(text ? { text } : {})
        }).then(
          (response) => respond(setState, messageId, response),
          () => undefined
        );
      },
      updateSender(senderId: string, patch: Partial<Sender>) {
        setState((current) => ({
          ...current,
          senders: current.senders.map((sender) =>
            sender.id === senderId ? { ...sender, ...patch } : sender
          )
        }));
      },
      revokeSender(senderId: string) {
        void revokeSenderForDevice(stateRef.current, senderId).then(
          () => setState((current) => ({
            ...current,
            senders: current.senders.map((sender) =>
              sender.id === senderId
                ? { ...sender, revokedAt: new Date().toISOString() }
                : sender
            )
          })),
          () => undefined
        );
      }
    }),
    [loaded, state]
  );

  return api;
}

function updateSettings(
  setState: Dispatch<SetStateAction<AppState>>,
  patch: Partial<AppState["settings"]>
) {
  setState((current) => ({
    ...current,
    settings: { ...current.settings, ...patch }
  }));
}

function updateMessage(
  setState: Dispatch<SetStateAction<AppState>>,
  messageId: string,
  update: (message: Message) => Message
) {
  setState((current) => ({
    ...current,
    messages: current.messages.map((message) =>
      message.id === messageId ? update(message) : message
    )
  }));
}

function respond(
  setState: Dispatch<SetStateAction<AppState>>,
  messageId: string,
  response: NonNullable<Message["response"]>
) {
  updateMessage(setState, messageId, (message) => ({
    ...message,
    deliveryState: "responded",
    response
  }));
}
