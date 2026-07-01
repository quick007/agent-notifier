import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

import { defaultState, pairedState } from "../data/seed";
import type { PairingLink } from "../lib/routes";
import { readStoredState, writeStoredState } from "../lib/storage";
import type { AppState, Message, PreviewPolicy, PushState, Sender } from "../types";

export function useAppState() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);

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
  }, [loaded, state]);

  const api = useMemo(
    () => ({
      state,
      loaded,
      startPairing() {
        updateSettings(setState, {
          pairing: {
            status: "code_ready",
            kind: "code",
            code: generatePairingCode(),
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
          }
        });
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
        setState((current) => pairedState(current));
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
        respond(setState, messageId, { kind: "reply", text });
      },
      submitApproval(messageId: string, decision: "approved" | "rejected", text?: string) {
        respond(setState, messageId, {
          kind: "approval",
          decision,
          ...(text ? { text } : {})
        });
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
        setState((current) => ({
          ...current,
          senders: current.senders.map((sender) =>
            sender.id === senderId
              ? { ...sender, revokedAt: new Date().toISOString() }
              : sender
          )
        }));
      }
    }),
    [loaded, state]
  );

  return api;
}

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePairingCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (byte) => codeAlphabet[byte % codeAlphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
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
  response: Omit<NonNullable<Message["response"]>, "respondedAt">
) {
  updateMessage(setState, messageId, (message) => ({
    ...message,
    deliveryState: "responded",
    response: {
      ...response,
      respondedAt: new Date().toISOString()
    }
  }));
}
