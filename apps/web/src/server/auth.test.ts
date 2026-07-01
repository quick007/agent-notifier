import { describe, expect, it } from "vite-plus/test";
import { SIGNED_REQUEST_HEADERS } from "@agent-notifier/protocol";

import { canonicalRequestText, verifySenderRequest } from "./auth";

describe("signed request auth", () => {
  it("rejects a bad sender signature", async () => {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const env = authEnv("snd_bad", await exportSpki(keys.publicKey));
    const request = signedRequest("snd_bad", "not-a-real-signature");

    await expect(verifySenderRequest(env, request)).rejects.toThrow("Request signature is invalid.");
  });

  it("accepts a valid sender signature and rejects nonce replay", async () => {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const publicKey = await exportSpki(keys.publicKey);
    const timestamp = new Date().toISOString();
    const nonce = "nonce-one";
    const bodySha256 = await sha256(new Uint8Array());
    const signature = await sign(keys.privateKey, canonicalRequestText({
      method: "GET",
      path: "/api/senders/messages/msg_123/status",
      bodySha256,
      timestamp,
      nonce,
      subjectType: "sender",
      subjectId: "snd_ok",
    }));
    const env = authEnv("snd_ok", publicKey);

    const first = await verifySenderRequest(env, signedRequest("snd_ok", signature, timestamp, nonce));
    expect(first).toEqual({ senderId: "snd_ok", recipientId: "rcp_123" });
    await expect(verifySenderRequest(env, signedRequest("snd_ok", signature, timestamp, nonce))).rejects.toThrow("Request nonce was already used.");
  });
});

function signedRequest(senderId: string, signature: string, timestamp = new Date().toISOString(), nonce = "nonce-test"): Request {
  return new Request("https://agent-notifier.test/api/senders/messages/msg_123/status", {
    headers: {
      [SIGNED_REQUEST_HEADERS.senderId]: senderId,
      [SIGNED_REQUEST_HEADERS.signature]: signature,
      [SIGNED_REQUEST_HEADERS.timestamp]: timestamp,
      [SIGNED_REQUEST_HEADERS.nonce]: nonce,
    },
  });
}

function authEnv(senderId: string, publicKey: string): Env {
  const nonces = new Set<string>();
  const sender = {
    id: senderId,
    recipientId: "rcp_123",
    displayName: "Test sender",
    kind: "generic",
    appName: null,
    machineLabel: null,
    workspaceLabel: null,
    encryptionPublicKey: "sender-encryption-public-key",
    signingPublicKey: publicKey,
    capabilitiesJson: "{}",
    previewPolicy: "allow_agent_choice",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    revokedAt: null,
    lastUsedAt: null,
  };
  return {
    DB: {
      prepare(sql: string) {
        return {
          bind(...params: unknown[]) {
            return {
              async all() {
                return { results: senderRows(sql, params, sender) };
              },
              async raw() {
                return senderRows(sql, params, sender).map(senderRawRow);
              },
              async run() {
                const nonce = String(params[3]);
                if (nonces.has(nonce)) throw new Error("duplicate");
                nonces.add(nonce);
                return { success: true, meta: {} };
              },
            };
          },
        };
      },
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
      dump: async () => new ArrayBuffer(0),
    } as unknown as D1Database,
  };
}

function senderRows(sql: string, params: unknown[], sender: ReturnType<typeof senderRow>): Array<ReturnType<typeof senderRow>> {
  if (!sql.includes("from \"senders\"") || params[0] !== sender.id) return [];
  return [sender];
}

function senderRow(sender: {
  readonly id: string;
  readonly recipientId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly appName: string | null;
  readonly machineLabel: string | null;
  readonly workspaceLabel: string | null;
  readonly encryptionPublicKey: string;
  readonly signingPublicKey: string;
  readonly capabilitiesJson: string;
  readonly previewPolicy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revokedAt: string | null;
  readonly lastUsedAt: string | null;
}) {
  return sender;
}

function senderRawRow(sender: ReturnType<typeof senderRow>): unknown[] {
  return [
    sender.id,
    sender.recipientId,
    sender.displayName,
    sender.kind,
    sender.appName,
    sender.machineLabel,
    sender.workspaceLabel,
    sender.encryptionPublicKey,
    sender.signingPublicKey,
    sender.capabilitiesJson,
    sender.previewPolicy,
    sender.createdAt,
    sender.updatedAt,
    sender.revokedAt,
    sender.lastUsedAt,
  ];
}

async function exportSpki(key: CryptoKey): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.exportKey("spki", key)));
}

async function sign(key: CryptoKey, text: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(text))));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const body: Uint8Array<ArrayBuffer> = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", body.buffer)));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
