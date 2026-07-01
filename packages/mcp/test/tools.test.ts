import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { TOOL_DEFINITIONS, callTool } from "../dist/tools.js";

function tool(name: string): Record<string, unknown> {
  const found = TOOL_DEFINITIONS.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Missing tool ${name}`);
  }
  return found.inputSchema;
}

test("advertises all required Agent Notifier MCP tools", () => {
  expect(TOOL_DEFINITIONS.map((definition) => definition.name)).toEqual([
    "setup_notifier",
    "send_notification",
    "request_reply",
    "request_approval",
    "get_message_status",
    "wait_for_message_state",
    "list_senders",
    "explain_usage_policy",
  ]);
});

test("schemas expose the fields handlers consume", () => {
  expect(tool("send_notification")).toMatchObject({
    required: ["title", "body"],
    properties: { title: { type: "string" }, body: { type: "string" } },
  });
  expect(tool("get_message_status")).toMatchObject({
    required: ["messageId"],
    properties: { messageId: { type: "string" } },
  });
  expect(tool("wait_for_message_state")).toMatchObject({
    required: ["messageId", "state"],
    properties: { state: { enum: ["accepted", "delivered", "responded", "expired"] } },
  });
});

test("usage policy tool returns machine-readable guidance", async () => {
  await expect(callTool("explain_usage_policy", {})).resolves.toMatchObject({
    ok: true,
    policy: {
      routineProgressSpam: false,
      inventedApprovalGates: false,
      askBeforeSetupEmailUnlessDelegated: true,
    },
  });
});

test("invalid stdio tool calls return a JSON-RPC response", () => {
  const entrypoint = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  const input = `${JSON.stringify({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "send_notification", arguments: {} },
  })}\n`;
  const result = spawnSync(process.execPath, [entrypoint], { input, encoding: "utf8" });
  expect(result.status).toBe(0);
  const [line] = result.stdout.trim().split(/\r?\n/);
  expect(JSON.parse(line ?? "{}")).toMatchObject({
    jsonrpc: "2.0",
    id: 7,
    result: { isError: true },
  });
  expect(result.stdout).toContain("title and body are required");
});
