import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { exportPublicKeySpki, generateEncryptionKeyPair } from "@agent-notifier/crypto";
import { sendMessage, setupNotifier } from "../dist/client.js";
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
