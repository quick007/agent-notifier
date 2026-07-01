import { useState } from "react";

import { MCP_NPM_PACKAGE, NPM_PACKAGE } from "../lib/links";
import { CopyBlock } from "./CopyBlock";
import { cn } from "./ui";

const agentPrompt = [
  "Set up Agent Notifier so you can send encrypted notifications to my phone.",
  "Use the local MCP server or the CLI. Prefer email pairing and ask before",
  "sending the setup email. Only notify me when a long task finishes, you're",
  "blocked, or an action needs my approval."
].join(" ");

const mcpConfig = `{
  "mcpServers": {
    "agent-notifier": {
      "command": "npx",
      "args": ["-y", "${MCP_NPM_PACKAGE}", "--stdio"]
    }
  }
}`;

const cliCommands = `npx -y ${NPM_PACKAGE} setup
npx -y ${NPM_PACKAGE} notify --title "Done" --body "The task finished."`;

type Tab = "agent" | "tools";

export function SetupInstructions() {
  const [tab, setTab] = useState<Tab>("agent");

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Start from your agent
          </h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Paste one instruction and let the local tool handle setup, keys, and
            pairing.
          </p>
        </div>
        <div
          aria-label="Setup method"
          className="inline-flex self-start rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-sm dark:border-neutral-800 dark:bg-neutral-950"
          role="tablist"
        >
          <TabButton active={tab === "agent"} onClick={() => setTab("agent")}>
            Agent setup
          </TabButton>
          <TabButton active={tab === "tools"} onClick={() => setTab("tools")}>
            MCP / CLI
          </TabButton>
        </div>
      </div>

      <div className="mt-5">{tab === "agent" ? <AgentSetup /> : <ToolsSetup />}</div>
    </section>
  );
}

function AgentSetup() {
  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
          Paste this into Codex, Claude, or any agent
        </p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          It installs the local notifier, prefers email pairing, and asks before
          sending anything.
        </p>
        <CopyBlock className="mt-3" multiline value={agentPrompt} />
      </div>
      <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950/60">
        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
          Approve the sender
        </p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          Open the setup email link or enter the pairing code the agent gives
          you, then approve the sender on this device.
        </p>
      </div>
    </div>
  );
}

function ToolsSetup() {
  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
          Local MCP server
        </p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          Add this to your MCP client config. Keys are generated and stored
          locally by the runtime.
        </p>
        <CopyBlock className="mt-3" label="mcp.json" multiline value={mcpConfig} />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
          Command line
        </p>
        <CopyBlock className="mt-3" label="terminal" value={cliCommands} />
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "min-h-9 rounded-md px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400",
        active
          ? "bg-white text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-neutral-50"
          : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50"
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}
