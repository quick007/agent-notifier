import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

import { requestPushPermission } from "../lib/pwa";
import type { Settings } from "../types";
import { CopyBlock } from "./CopyBlock";
import { Badge, Button } from "./ui";

export function EmailLinkPanel({
  onPushState,
  onStartPairing,
  secretPresent,
  sessionId
}: {
  onPushState: (state: Settings["pushState"]) => void;
  onStartPairing: () => void;
  secretPresent: boolean;
  sessionId: string;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Setup link detected</p>
        <Badge tone={secretPresent ? "green" : "amber"}>
          {secretPresent ? "Secret ready" : "Needs secret"}
        </Badge>
      </div>
      <p className="mt-3 break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        {sessionId}
      </p>
      <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
        This device captured the email pairing session. Sender details appear
        here before approval, and contents remain end-to-end encrypted.
      </p>
      <div className="mt-4 grid gap-2">
        <Button onClick={async () => onPushState(await requestPushPermission())}>
          Enable notifications
        </Button>
        <Button disabled tone="primary">
          Waiting for sender details
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            onStartPairing();
            navigate("/setup/pair");
          }}
        >
          Use pairing code instead
        </Button>
      </div>
    </div>
  );
}

export function CodePanel({
  code,
  expiresAt,
  onApprove,
  onPushState
}: {
  code: string;
  expiresAt?: string;
  onApprove: () => void;
  onPushState: (state: Settings["pushState"]) => void;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Pairing code</p>
        <Badge tone="amber">10 min</Badge>
      </div>
      <p className="mt-3 select-all rounded-xl bg-neutral-950 px-4 py-4 text-center font-mono text-2xl font-semibold tracking-[0.2em] text-white dark:bg-neutral-50 dark:text-neutral-950">
        {code}
      </p>
      <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
        Give this code to your agent. When it claims the session, approve the
        sender here.
      </p>
      {expiresAt && (
        <p className="mt-1 text-xs text-neutral-500">
          Expires {new Date(expiresAt).toLocaleTimeString()}
        </p>
      )}
      <div className="mt-4 grid gap-2">
        <Button onClick={async () => onPushState(await requestPushPermission())}>
          Enable notifications
        </Button>
        <Button
          tone="primary"
          onClick={() => {
            onApprove();
            navigate("/inbox");
          }}
        >
          <CheckCircleIcon className="h-5 w-5" />
          Approve sender
        </Button>
      </div>
    </div>
  );
}

export function CliQuickStart() {
  return (
    <div>
      <p className="text-sm font-medium">Prefer the terminal?</p>
      <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
        Run setup from any shell and follow the on-screen pairing prompt.
      </p>
      <CopyBlock className="mt-3" value="npx @agent-notifier/cli setup" />
    </div>
  );
}
