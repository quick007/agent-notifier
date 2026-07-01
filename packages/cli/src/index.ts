#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./commands.js";

export { runCli } from "./commands.js";
export {
  getMessageStatus,
  listSenders,
  revokeSender,
  sendMessage,
  setupNotifier,
  waitForMessageState,
} from "./client.js";
export {
  DELIVERY_STATES,
  SENDER_KINDS,
  isDeliveryState,
  isSenderKind,
} from "./contracts.js";
export type {
  AgentNotifierResult,
  AgentNotifierResponse,
  DeliveryState,
  MessageMode,
  SendInput,
  SenderRecord,
  SetupInput,
  WaitInput,
} from "./contracts.js";

const isMain = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;

if (isMain) {
  runCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (!result.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error: unknown) => {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          kind: "error",
          transport: "local_config",
          at: new Date().toISOString(),
          error: {
            code: "cli_error",
            message: error instanceof Error ? error.message : String(error),
          },
        })}\n`,
      );
      process.exitCode = 1;
    });
}
