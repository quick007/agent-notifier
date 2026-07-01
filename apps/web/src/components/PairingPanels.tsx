import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

import { NPM_PACKAGE } from "../lib/links";
import { requestPushPermission } from "../lib/pwa";
import type { Settings } from "../types";
import { CopyBlock } from "./CopyBlock";
import { Badge, Button } from "./ui";

export function EmailLinkPanel({
  canApprove,
  error,
  onApprove,
  onPushState,
  onStartPairing,
  secretPresent,
  senderDisplayName,
  sessionId,
  status
}: {
  canApprove: boolean;
  error?: string;
  onApprove: () => void;
  onPushState: (state: Settings["pushState"]) => void;
  onStartPairing: () => void;
  secretPresent: boolean;
  senderDisplayName?: string;
  sessionId: string;
  status: Settings["pairing"]["status"];
}) {
  const navigate = useNavigate();

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium">Setup link detected</p>
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
      <SenderPreview senderDisplayName={senderDisplayName} />
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-4 grid gap-2">
        <Button onClick={async () => onPushState(await requestPushPermission())}>
          Enable notifications
        </Button>
        <Button disabled={!canApprove || status === "approving"} onClick={onApprove} tone="primary">
          <CheckCircleIcon className="h-5 w-5" />
          {status === "approving" ? "Approving..." : canApprove ? "Approve sender" : "Waiting for sender details"}
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
  canApprove,
  code,
  error,
  expiresAt,
  onApprove,
  onPushState,
  secret,
  senderDisplayName,
  status
}: {
  canApprove: boolean;
  code: string;
  error?: string;
  expiresAt?: string;
  onApprove: () => void;
  onPushState: (state: Settings["pushState"]) => void;
  secret?: string;
  senderDisplayName?: string;
  status: Settings["pairing"]["status"];
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium">Pairing code</p>
        <Badge tone={canApprove ? "green" : "amber"}>{canApprove ? "Claimed" : "Waiting"}</Badge>
      </div>
      <CopyBlock className="mt-3 min-w-0 max-w-full" label="Code" value={code} />
      {secret && (
        <CopyBlock className="mt-3 min-w-0 max-w-full" label="Secret" value={secret} />
      )}
      <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
        Give both values to your agent. When it claims the session, confirm the
        sender below before pairing this device.
      </p>
      <SenderPreview senderDisplayName={senderDisplayName} />
      {expiresAt && (
        <p className="mt-1 text-xs text-neutral-500">
          Expires {new Date(expiresAt).toLocaleTimeString()}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-4 grid gap-2">
        <Button onClick={async () => onPushState(await requestPushPermission())}>
          Enable notifications
        </Button>
        <Button disabled={!canApprove || status === "approving"} tone="primary" onClick={onApprove}>
          <CheckCircleIcon className="h-5 w-5" />
          {status === "approving" ? "Approving..." : canApprove ? "Approve sender" : "Waiting for sender"}
        </Button>
      </div>
    </div>
  );
}

function SenderPreview({ senderDisplayName }: { senderDisplayName: string | undefined }) {
  return (
    <div className="mt-3 min-w-0 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <p className="break-words text-sm text-neutral-800 dark:text-neutral-200">
        {senderDisplayName ?? "Waiting for sender details"}
      </p>
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
      <CopyBlock className="mt-3" value={`npx -y ${NPM_PACKAGE} setup`} />
    </div>
  );
}
