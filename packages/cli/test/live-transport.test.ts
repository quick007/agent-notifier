import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  exportPrivateKeyPkcs8,
  exportPublicKeySpki,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  sealContentForDevices,
  signP256Sha256,
  toBase64Url,
  utf8ToBytes,
} from "@agent-notifier/crypto";
import { DOMAINS, canonicalJson, canonicalSigningBytes, responseEnvelopeSigningBytes } from "@agent-notifier/protocol";
import { getMessageStatus, sendMessage, setupNotifier, waitForMessageState } from "../dist/client.js";
import { readState } from "../dist/store.js";
import { writeState } from "../dist/store.js";
import { canonicalRequestText } from "../dist/transport.js";

let tempDir: string;
let previousStateFile: string | undefined;
let previousApiUrl: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "agent-notifier-live-"));
  previousStateFile = process.env.AGENT_NOTIFIER_STATE_FILE;
  previousApiUrl = process.env.AGENT_NOTIFIER_API_URL;
  process.env.AGENT_NOTIFIER_STATE_FILE = join(tempDir, "state.json");
});

afterEach(async () => {
  if (previousStateFile === undefined) delete process.env.AGENT_NOTIFIER_STATE_FILE;
  else process.env.AGENT_NOTIFIER_STATE_FILE = previousStateFile;
  if (previousApiUrl === undefined) delete process.env.AGENT_NOTIFIER_API_URL;
  else process.env.AGENT_NOTIFIER_API_URL = previousApiUrl;
  vi.restoreAllMocks();
  await rm(tempDir, { recursive: true, force: true });
});

test("setup uses API transport when AGENT_NOTIFIER_API_URL is configured", async () => {
  process.env.AGENT_NOTIFIER_API_URL = "https://api.example.test/";
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ sessionId: "pair_123", status: "pending", expiresAt: "2026-07-01T00:00:00.000Z" })),
  );

  const result = await setupNotifier({ email: "user@example.com", senderName: "Codex" });

  expect(result).toMatchObject({
    ok: true,
    transport: "http_api",
    apiUrl: "https://api.example.test",
    serverAccepted: true,
    sessionId: "pair_123",
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.example.test/api/pairing/email/start",
    expect.objectContaining({ method: "POST" }),
  );
});

test("live send submits encrypted envelope without plaintext content", async () => {
  process.env.AGENT_NOTIFIER_API_URL = "https://api.example.test";
  const deviceKeys = await generateEncryptionKeyPair({ extractable: true });
  const bodies: string[] = [];
  await writeState({
    version: 1,
    apiBaseUrl: "https://api.example.test",
    senders: [{
      id: "snd_123",
      recipientId: "rcp_123",
      displayName: "Codex",
      kind: "codex",
      createdAt: "2026-07-01T00:00:00.000Z",
    }],
    messages: [],
  });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    bodies.push(typeof init?.body === "string" ? init.body : "");
    if (String(url).endsWith("/api/senders/targets")) {
      return new Response(JSON.stringify({
        senderId: "snd_123",
        recipientId: "rcp_123",
        devices: [{
          deviceId: "dev_123",
          encryptionPublicKey: await exportPublicKeySpki(deviceKeys.publicKey),
          signingPublicKey: "unused",
        }],
      }));
    }
    if (String(url).endsWith("/api/senders/messages")) {
      return new Response(JSON.stringify({ messageId: "msg_123", state: "accepted" }), { status: 202 });
    }
    throw new Error(`Unexpected fetch ${String(url)}`);
  });

  const result = await sendMessage({
    mode: "notify",
    title: "Secret title",
    body: "Secret body",
    sensitive: true,
  });

  expect(result).toMatchObject({
    ok: true,
    transport: "http_api",
    serverAccepted: true,
    messageId: "msg_123",
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const submission = JSON.parse(bodies[1] ?? "{}") as Record<string, unknown>;
  expect(JSON.stringify(submission)).not.toContain("Secret title");
  expect(JSON.stringify(submission)).not.toContain("Secret body");
  expect(submission).toMatchObject({
    schemaVersion: 1,
    metadata: { senderId: "snd_123", recipientId: "rcp_123", mode: "notify" },
    keyWraps: [{ deviceId: "dev_123" }],
  });
  const state = await readState();
  expect(state.messages[0]?.targetDevices).toEqual([{ deviceId: "dev_123", signingPublicKey: "unused" }]);
});

test("wait for responded fetches, verifies, and decrypts sender response", async () => {
  process.env.AGENT_NOTIFIER_API_URL = "https://api.example.test";
  const senderEncryption = await generateEncryptionKeyPair({ extractable: true });
  const senderSigning = await generateSigningKeyPair({ extractable: true });
  const deviceSigning = await generateSigningKeyPair({ extractable: true });
  const response = await encryptedReplyResponse({
    senderPublicKey: senderEncryption.publicKey,
    deviceSigningPrivateKey: deviceSigning.privateKey,
  });
  await writeState({
    version: 1,
    apiBaseUrl: "https://api.example.test",
    senders: [{
      id: "snd_123",
      recipientId: "rcp_123",
      displayName: "Codex",
      kind: "codex",
      createdAt: "2026-07-01T00:00:00.000Z",
      encryptionPublicKey: await exportPublicKeySpki(senderEncryption.publicKey),
      signingPublicKey: await exportPublicKeySpki(senderSigning.publicKey),
      encryptionPrivateKeyPkcs8: await exportPrivateKeyPkcs8(senderEncryption.privateKey),
      signingPrivateKeyPkcs8: await exportPrivateKeyPkcs8(senderSigning.privateKey),
    }],
    messages: [{
      id: "msg_123",
      senderId: "snd_123",
      mode: "request_reply",
      state: "delivered",
      createdAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2026-07-01T00:30:00.000Z",
      dedupeKey: "dedupe",
      targetDevices: [{ deviceId: "dev_123", signingPublicKey: await exportPublicKeySpki(deviceSigning.publicKey) }],
    }],
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).endsWith("/api/senders/messages/msg_123/status")) {
      return new Response(JSON.stringify({ messageId: "msg_123", state: "responded", expiresAt: "2026-07-01T00:30:00.000Z" }));
    }
    if (String(url).endsWith("/api/senders/messages/msg_123/response")) {
      return new Response(JSON.stringify(response));
    }
    throw new Error(`Unexpected fetch ${String(url)}`);
  });

  const result = await waitForMessageState({ messageId: "msg_123", state: "responded", timeoutMs: 50, intervalMs: 1 });

  expect(result).toMatchObject({
    ok: true,
    state: "responded",
    responseRef: "rsp_123",
    response: {
      responseId: "rsp_123",
      messageId: "msg_123",
      deviceId: "dev_123",
      kind: "reply",
      body: "Ship it.",
      respondedAt: "2026-07-01T00:05:00.000Z",
    },
  });
});

test("responded status warns when encrypted response is not fetchable yet", async () => {
  process.env.AGENT_NOTIFIER_API_URL = "https://api.example.test";
  const senderSigning = await generateSigningKeyPair({ extractable: true });
  await writeState({
    version: 1,
    apiBaseUrl: "https://api.example.test",
    senders: [{
      id: "snd_123",
      recipientId: "rcp_123",
      displayName: "Codex",
      kind: "codex",
      createdAt: "2026-07-01T00:00:00.000Z",
      signingPrivateKeyPkcs8: await exportPrivateKeyPkcs8(senderSigning.privateKey),
    }],
    messages: [],
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).endsWith("/api/senders/messages/msg_123/status")) {
      return new Response(JSON.stringify({ messageId: "msg_123", state: "responded" }));
    }
    if (String(url).endsWith("/api/senders/messages/msg_123/response")) {
      return new Response(JSON.stringify({ error: "response_not_found", message: "Response was not found." }), { status: 404 });
    }
    throw new Error(`Unexpected fetch ${String(url)}`);
  });

  const result = await getMessageStatus("msg_123");

  expect(result).toMatchObject({ ok: true, state: "responded" });
  expect(result.response).toBeUndefined();
  expect(result.warning).toContain("not yet fetchable");
});

test("canonical request text matches backend sender auth fields", () => {
  expect(canonicalRequestText({
    method: "post",
    path: "/api/senders/messages",
    bodySha256: "abc",
    timestamp: "2026-07-01T00:00:00.000Z",
    nonce: "nonce",
    subjectId: "snd_123",
  })).toBe(
    'agent-notifier/request/v1\n{"bodySha256":"abc","method":"POST","nonce":"nonce","path":"/api/senders/messages","schemaVersion":1,"subjectId":"snd_123","subjectType":"sender","timestamp":"2026-07-01T00:00:00.000Z"}',
  );
});

async function encryptedReplyResponse(input: {
  senderPublicKey: CryptoKey;
  deviceSigningPrivateKey: CryptoKey;
}) {
  const responseId = "rsp_123";
  const messageId = "msg_123";
  const kind = "reply" as const;
  const expiresAt = "2026-07-01T00:30:00.000Z";
  const contentAad = canonicalSigningBytes({
    domain: DOMAINS.RESPONSE_V1,
    payload: { schemaVersion: 1, responseId, messageId, kind, expiresAt },
  });
  const sealed = await sealContentForDevices({
    plaintext: utf8ToBytes(canonicalJson({
      schemaVersion: 1,
      messageId,
      kind,
      body: "Ship it.",
      respondedAt: "2026-07-01T00:05:00.000Z",
    })),
    aad: contentAad,
    devices: [{ deviceId: "snd_123", publicKey: input.senderPublicKey }],
  });
  const [senderKeyWrap] = sealed.keyWraps;
  if (!senderKeyWrap) throw new Error("missing sender key wrap");
  const ciphertext = toBase64Url(utf8ToBytes(canonicalJson({
    schemaVersion: 1,
    format: "agent-notifier/response-sealed/v1",
    ciphertext: sealed.ciphertext,
    contentNonce: sealed.contentNonce,
    contentAadHash: sealed.contentAadHash,
    senderKeyWrap,
  })));
  return {
    id: responseId,
    messageId,
    recipientId: "rcp_123",
    senderId: "snd_123",
    deviceId: "dev_123",
    kind,
    createdAt: "2026-07-01T00:05:00.000Z",
    expiresAt,
    ciphertext,
    contentNonce: sealed.contentNonce,
    deviceSignature: await signP256Sha256(input.deviceSigningPrivateKey, responseEnvelopeSigningBytes({
      schemaVersion: 1,
      responseId,
      messageId,
      kind,
      expiresAt,
      ciphertext,
      contentNonce: sealed.contentNonce,
    })),
    schemaVersion: 1,
  };
}
