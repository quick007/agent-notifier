import {
  BellIcon,
  ChatBubbleLeftEllipsisIcon,
  CodeBracketIcon,
  DevicePhoneMobileIcon,
  HandThumbUpIcon,
  LockClosedIcon
} from "@heroicons/react/24/outline";
import type { ReactElement } from "react";

const modes: Array<{ icon: ReactElement; title: string; body: string }> = [
  {
    icon: <BellIcon />,
    title: "Notify",
    body: "A one-way ping when a long task finishes or something needs your eyes."
  },
  {
    icon: <ChatBubbleLeftEllipsisIcon />,
    title: "Ask for a reply",
    body: "The agent is blocked and needs a short answer before it continues."
  },
  {
    icon: <HandThumbUpIcon />,
    title: "Request approval",
    body: "Approve or reject an action. Your signed choice goes back to the agent."
  }
];

const steps: Array<{ title: string; body: string }> = [
  {
    title: "Pair an agent",
    body: "Use a setup email or a short pairing code. No tokens to copy, no config to edit."
  },
  {
    title: "The agent encrypts and signs",
    body: "Content is encrypted on the sender before it reaches our servers."
  },
  {
    title: "Your device decrypts locally",
    body: "Only this device can read titles, bodies, replies, and approvals."
  }
];

export function ProductModes() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {modes.map((mode) => (
        <div
          className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          key={mode.title}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
            <span className="h-5 w-5">{mode.icon}</span>
          </span>
          <p className="mt-3 text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {mode.title}
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {mode.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ProductSteps() {
  return (
    <ol className="grid gap-4">
      {steps.map((step, index) => (
        <li className="flex gap-3" key={step.title}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              {step.title}
            </p>
            <p className="mt-0.5 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DeveloperCallout() {
  return (
    <a
      className="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:focus:ring-blue-400"
      href="/docs"
      rel="noreferrer"
      target="_blank"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        <CodeBracketIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-neutral-950 dark:text-neutral-50">
          Wire up an agent
        </span>
        <span className="block text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          CLI, local MCP, and the full API reference for Codex, Claude, and CI.
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium text-neutral-400 transition group-hover:text-neutral-950 dark:group-hover:text-neutral-50">
        Docs
      </span>
    </a>
  );
}

export function TrustNote() {
  return (
    <div className="grid gap-3">
      <TrustLine
        icon={<LockClosedIcon />}
        text="Contents are end-to-end encrypted. We cannot read titles, bodies, replies, or approvals."
      />
      <TrustLine
        icon={<DevicePhoneMobileIcon />}
        text="Your readable inbox lives on this device. Email is only for setup links and recovery."
      />
    </div>
  );
}

function TrustLine({ icon, text }: { icon: ReactElement; text: string }) {
  return (
    <div className="flex items-start gap-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
      <span className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
