import {
  CommandLineIcon,
  CpuChipIcon,
  NoSymbolIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";

import type { PreviewPolicy, Sender } from "../types";
import { Badge, Button, ConfirmDialog, Toggle, cn } from "../components/ui";

export function SendersScreen({
  senders,
  selectedSenderId,
  onRevoke,
  onUpdate
}: {
  senders: Sender[];
  selectedSenderId?: string;
  onRevoke: (senderId: string) => void;
  onUpdate: (senderId: string, patch: Partial<Sender>) => void;
}) {
  const selected = selectedSenderId
    ? senders.find((sender) => sender.id === selectedSenderId)
    : null;

  if (selected) {
    return <SenderDetail onRevoke={onRevoke} onUpdate={onUpdate} sender={selected} />;
  }

  return (
    <section className="an-rise mx-auto w-full max-w-3xl px-4 py-5 md:px-8 md:py-8">
      <h1 className="text-xl font-semibold tracking-tight">Senders</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Paired agents allowed to send encrypted notifications here.
      </p>
      {senders.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-12 text-center dark:border-neutral-800">
          <p className="text-sm font-medium">No paired senders</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-neutral-500">
            Pair an agent from setup to let it notify this device.
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-900 dark:border-neutral-900 dark:bg-neutral-950">
          {senders.map((sender) => (
            <a
              className="flex min-h-20 items-center gap-3 px-4 py-3 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:hover:bg-neutral-900"
              href={`#/senders/${sender.id}`}
              key={sender.id}
            >
              <SenderIcon kind={sender.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{sender.displayName}</p>
                <p className="mt-1 truncate text-xs text-neutral-500">
                  {sender.machineLabel}
                </p>
              </div>
              {sender.revokedAt ? <Badge tone="red">Revoked</Badge> : <Badge tone="green">Active</Badge>}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function SenderDetail({
  sender,
  onRevoke,
  onUpdate
}: {
  sender: Sender;
  onRevoke: (senderId: string) => void;
  onUpdate: (senderId: string, patch: Partial<Sender>) => void;
}) {
  return (
    <section className="an-rise mx-auto w-full max-w-2xl px-4 py-5 md:px-8 md:py-8">
      <a className="inline-flex text-sm text-neutral-500 transition hover:text-neutral-950 dark:hover:text-neutral-50" href="#/senders">
        Back to senders
      </a>
      <div className="mt-5 flex items-start gap-3">
        <SenderIcon kind={sender.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-xl font-semibold tracking-tight">{sender.displayName}</h1>
            {sender.revokedAt && <Badge tone="red">Revoked</Badge>}
          </div>
          <p className="mt-1 text-sm text-neutral-500">{sender.machineLabel}</p>
        </div>
      </div>

      <div className="mt-7 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-900 dark:border-neutral-900 dark:bg-neutral-950">
        <CapabilityRow label="Send notifications" sender={sender} field="notify" onUpdate={onUpdate} />
        <CapabilityRow label="Request replies" sender={sender} field="requestReply" onUpdate={onUpdate} />
        <CapabilityRow label="Request approvals" sender={sender} field="requestApproval" onUpdate={onUpdate} />
        <label className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
          <span>
            <span className="block text-sm font-medium">Preview policy</span>
            <span className="block text-xs text-neutral-500">Applied on this device after decrypt.</span>
          </span>
          <select
            className="rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
            onChange={(event) =>
              onUpdate(sender.id, {
                previewPolicy: event.target.value as PreviewPolicy
              })
            }
            value={sender.previewPolicy}
          >
            <option value="agent_choice">Agent choice</option>
            <option value="hide_sensitive">Hide sensitive</option>
            <option value="always_hide">Always hide</option>
          </select>
        </label>
      </div>

      <div className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <h2 className="text-sm font-semibold text-red-900 dark:text-red-100">
          Revoke sender
        </h2>
        <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">
          The agent can no longer send through Agent Notifier. Local agent files
          may still exist on its machine.
        </p>
        <ConfirmDialog
          body="Future signed requests from this sender should be rejected by the service once backend revocation is connected."
          confirmLabel="Revoke"
          onConfirm={() => onRevoke(sender.id)}
          title="Revoke sender?"
        >
          <Button className="mt-4" disabled={Boolean(sender.revokedAt)} tone="danger">
            <NoSymbolIcon className="h-5 w-5" />
            {sender.revokedAt ? "Revoked" : "Revoke sender"}
          </Button>
        </ConfirmDialog>
      </div>
    </section>
  );
}

function CapabilityRow({
  field,
  label,
  sender,
  onUpdate
}: {
  field: keyof Sender["capabilities"];
  label: string;
  sender: Sender;
  onUpdate: (senderId: string, patch: Partial<Sender>) => void;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <Toggle
        checked={sender.capabilities[field]}
        label={label}
        onCheckedChange={(checked) =>
          onUpdate(sender.id, {
            capabilities: { ...sender.capabilities, [field]: checked }
          })
        }
      />
    </div>
  );
}

function SenderIcon({ kind }: { kind: Sender["kind"] }) {
  const Icon = kind === "ci" ? CpuChipIcon : kind === "claude" ? SparklesIcon : CommandLineIcon;
  const tint =
    kind === "ci"
      ? "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300"
      : kind === "claude"
        ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300";
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tint)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}
