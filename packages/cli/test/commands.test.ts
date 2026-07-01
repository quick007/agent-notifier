import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { runCli } from "../dist/index.js";

let tempDir: string;
let previousStateFile: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "agent-notifier-cli-"));
  previousStateFile = process.env.AGENT_NOTIFIER_STATE_FILE;
  process.env.AGENT_NOTIFIER_STATE_FILE = join(tempDir, "state.json");
});

afterEach(async () => {
  if (previousStateFile === undefined) {
    delete process.env.AGENT_NOTIFIER_STATE_FILE;
  } else {
    process.env.AGENT_NOTIFIER_STATE_FILE = previousStateFile;
  }
  await rm(tempDir, { recursive: true, force: true });
});

test("notify without API URL fails closed without storing plaintext", async () => {
  const result = await runCli([
    "notify",
    "--title",
    "Done",
    "--body",
    "The task finished.",
    "--non-sensitive",
  ]);

  expect(result).toMatchObject({
    ok: false,
    kind: "notify",
    state: "api_not_configured",
    transport: "local_config",
    serverAccepted: false,
    error: { code: "api_not_configured" },
  });
  expect(result.messageId).toBeUndefined();
  const state = JSON.parse(await readFile(process.env.AGENT_NOTIFIER_STATE_FILE ?? "", "utf8")) as {
    messages?: unknown[];
  };
  expect(state.messages).toEqual([]);
});

test("setup email without API URL records local sender config only", async () => {
  const result = await runCli([
    "setup",
    "email",
    "--email",
    "user@example.com",
    "--sender-name",
    "Codex on PC",
  ]);

  expect(result).toMatchObject({
    ok: false,
    kind: "setup_email",
    state: "api_not_configured",
    transport: "local_config",
    serverAccepted: false,
    error: { code: "api_not_configured" },
  });
});
