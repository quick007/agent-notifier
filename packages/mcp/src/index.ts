#!/usr/bin/env node
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MCP_INSTRUCTIONS } from "./policy.js";
import { TOOL_DEFINITIONS, callTool } from "./tools.js";

const SERVER_VERSION = "0.1.0";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

function send(message: Record<string, unknown>): void {
  stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

function result(id: JsonRpcId | undefined, payload: unknown): void {
  if (id !== undefined) {
    send({ id, result: payload });
  }
}

function error(id: JsonRpcId | undefined, code: number, message: string): void {
  if (id !== undefined) {
    send({ id, error: { code, message } });
  }
}

function toolContent(payload: unknown): Record<string, unknown> {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
  };
}

function toolError(message: string): Record<string, unknown> {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ ok: false, error: { code: "tool_error", message } }),
      },
    ],
  };
}

async function handle(request: JsonRpcRequest): Promise<void> {
  const id = request.id;
  if (request.method === "initialize") {
    result(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "agent-notifier", version: SERVER_VERSION },
      instructions: MCP_INSTRUCTIONS,
    });
    return;
  }
  if (request.method === "notifications/initialized") {
    return;
  }
  if (request.method === "tools/list") {
    result(id, { tools: TOOL_DEFINITIONS });
    return;
  }
  if (request.method === "tools/call") {
    const params = request.params ?? {};
    const name = typeof params.name === "string" ? params.name : "";
    const args = typeof params.arguments === "object" && params.arguments ? params.arguments : {};
    try {
      result(id, toolContent(await callTool(name, args as Record<string, unknown>)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result(id, toolError(message));
    }
    return;
  }
  error(id, -32601, `Unknown method: ${request.method ?? "<missing>"}`);
}

export async function runStdioServer(): Promise<void> {
  const reader = createInterface({ input: stdin, crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line.trim()) {
      continue;
    }
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(null, -32700, message);
      continue;
    }
    try {
      await handle(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(request.id, -32000, message);
    }
  }
}

const isMain = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;

if (isMain) {
  runStdioServer().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    error(null, -32000, message);
    process.exitCode = 1;
  });
}
