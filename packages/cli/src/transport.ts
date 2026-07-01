import { SIGNED_REQUEST_HEADERS, canonicalRequestText as protocolCanonicalRequestText } from "@agent-notifier/protocol";
import { importSigningPrivateKey, randomBytes, sha256Base64Url, signP256Sha256, toBase64Url } from "@agent-notifier/crypto";
import type { SenderRecord, StoredState } from "./contracts.js";

export interface TransportConfig {
  apiUrl?: string;
  localOnly: boolean;
}

export function transportConfig(state: StoredState, input?: { apiUrl?: string; localOnly?: boolean }): TransportConfig {
  const apiUrl = input?.apiUrl ?? process.env.AGENT_NOTIFIER_API_URL ?? state.apiBaseUrl;
  return {
    ...(apiUrl ? { apiUrl: apiUrl.replace(/\/$/, "") } : {}),
    localOnly: input?.localOnly === true || process.env.AGENT_NOTIFIER_TRANSPORT === "local",
  };
}

export function shouldUseApi(config: TransportConfig): config is TransportConfig & { apiUrl: string } {
  return !config.localOnly && typeof config.apiUrl === "string" && config.apiUrl.length > 0;
}

export async function signedFetch(input: {
  apiUrl: string;
  path: string;
  method: "GET" | "POST";
  sender: SenderRecord;
  body?: unknown;
}): Promise<unknown> {
  if (!input.sender.signingPrivateKeyPkcs8) {
    throw new Error("Sender signing key is not available locally.");
  }

  const bodyText = input.body === undefined ? "" : JSON.stringify(input.body);
  const timestamp = new Date().toISOString();
  const nonce = toBase64Url(randomBytes(16));
  const bodySha256 = await sha256Base64Url(new TextEncoder().encode(bodyText));
  const signingText = canonicalRequestText({
    method: input.method,
    path: input.path,
    bodySha256,
    timestamp,
    nonce,
    subjectId: input.sender.id,
  });
  const signature = await signP256Sha256(
    await importSigningPrivateKey(input.sender.signingPrivateKeyPkcs8),
    new TextEncoder().encode(signingText),
  );

  const init: RequestInit = {
    method: input.method,
    headers: {
      "content-type": "application/json",
      [SIGNED_REQUEST_HEADERS.senderId]: input.sender.id,
      [SIGNED_REQUEST_HEADERS.timestamp]: timestamp,
      [SIGNED_REQUEST_HEADERS.nonce]: nonce,
      [SIGNED_REQUEST_HEADERS.signature]: signature,
    },
  };
  if (input.body !== undefined) {
    init.body = bodyText;
  }

  const response = await fetch(`${input.apiUrl}${input.path}`, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export function canonicalRequestText(input: {
  method: string;
  path: string;
  bodySha256: string;
  timestamp: string;
  nonce: string;
  subjectId: string;
}): string {
  return protocolCanonicalRequestText({
    method: input.method.toUpperCase(),
    path: input.path,
    bodySha256: input.bodySha256,
    timestamp: input.timestamp,
    nonce: input.nonce,
    subjectType: "sender",
    subjectId: input.subjectId,
  });
}
