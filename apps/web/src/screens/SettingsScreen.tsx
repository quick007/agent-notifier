import {
  BellAlertIcon,
  CodeBracketIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";

import { getPwaStatus, requestPushPermission, sendTestNotification } from "../lib/pwa";
import type { PreviewPolicy, PushState, Settings } from "../types";
import { Badge, Button } from "../components/ui";

const pushLabels: Record<PushState, string> = {
  unsupported: "Not supported on this browser",
  default: "Not enabled yet",
  granted: "On",
  granted_missing_subscription: "On, finishing setup",
  denied: "Blocked in browser settings",
  ios_not_installed: "Add to Home Screen first",
  paired_no_push: "Paired, notifications off",
  service_worker_error: "Needs a refresh"
};

function pushLabel(state: PushState) {
  return pushLabels[state] ?? state;
}

export function SettingsScreen({
  settings,
  onPreviewPolicy,
  onPushState,
  onRetention
}: {
  settings: Settings;
  onPreviewPolicy: (policy: PreviewPolicy) => void;
  onPushState: (state: Settings["pushState"]) => void;
  onRetention: (days: 7 | 30 | 90) => void;
}) {
  return (
    <section className="an-rise mx-auto w-full max-w-2xl px-4 py-5 md:px-8 md:py-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Previews, notifications, retention, and recovery for this device.
      </p>

      <div className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-900 dark:border-neutral-900 dark:bg-neutral-950">
        <a className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900" href="#/settings/notifications">
          <BellAlertIcon className="h-5 w-5 text-neutral-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Notifications</p>
            <p className="truncate text-xs text-neutral-500">{pushLabel(settings.pushState)}</p>
          </div>
          <Badge tone={settings.pushState === "granted" ? "green" : "amber"}>
            {settings.pushState === "granted" ? "On" : "Check"}
          </Badge>
        </a>

        <SelectRow
          label="Preview policy"
          onChange={(value) => onPreviewPolicy(value as PreviewPolicy)}
          value={settings.globalPreviewPolicy}
        >
          <option value="agent_choice">Agent choice</option>
          <option value="hide_sensitive">Hide sensitive only</option>
          <option value="always_hide">Always hide</option>
        </SelectRow>

        <SelectRow
          label="Local retention"
          onChange={(value) => onRetention(Number(value) as 7 | 30 | 90)}
          value={String(settings.localRetentionDays)}
        >
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </SelectRow>

        <InfoRow
          icon={<EnvelopeIcon />}
          label="Email and recovery"
          value={settings.email ?? "Not added"}
        />
        <InfoRow
          icon={<DevicePhoneMobileIcon />}
          label="This device"
          value={`${settings.deviceName} - local keys stored in browser storage`}
        />
        <InfoRow
          icon={<ShieldCheckIcon />}
          label="Legal"
          value="Privacy, Security, and Terms"
          href="#/privacy"
        />
        <InfoRow
          icon={<CodeBracketIcon />}
          label="Developers"
          value="CLI, MCP, and API reference"
          href="/docs"
          external
        />
      </div>

      <p className="mt-6 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
        Message contents are end-to-end encrypted. The service sees delivery
        metadata such as email, device IDs, sender IDs, timestamps, queue state,
        and push subscription metadata.
      </p>

      <Button className="mt-4" onClick={() => onPushState(getPwaStatus().pushState)}>
        Refresh device status
      </Button>
    </section>
  );
}

export function PushTroubleshootingScreen({
  settings,
  onPushState
}: {
  settings: Settings;
  onPushState: (state: Settings["pushState"]) => void;
}) {
  const steps = [
    ["Open from Home Screen", "On iPhone, add this PWA before relying on push."],
    ["Enable notifications", "Pairing can finish even when notifications are blocked."],
    ["Open-app fetch", "If push is off, messages appear when you open the app."]
  ];

  return (
    <section className="an-rise mx-auto w-full max-w-2xl px-4 py-5 md:px-8 md:py-8">
      <a className="inline-flex text-sm text-neutral-500 transition hover:text-neutral-950 dark:hover:text-neutral-50" href="#/settings">
        Back to settings
      </a>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Push troubleshooting</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
        Current status: <span className="font-medium">{pushLabel(settings.pushState)}</span>
      </p>

      <div className="mt-6 grid gap-3">
        {steps.map(([title, body]) => (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-900 dark:bg-neutral-950" key={title}>
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{body}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          tone="primary"
          onClick={async () => onPushState(await requestPushPermission())}
        >
          Enable notifications
        </Button>
        <Button onClick={() => void sendTestNotification()}>Test notification</Button>
      </div>
    </section>
  );
}

function SelectRow({
  children,
  label,
  onChange,
  value
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <select
        className="rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function InfoRow({
  external,
  href,
  icon,
  label,
  value
}: {
  external?: boolean;
  href?: string;
  icon: React.ReactElement;
  label: string;
  value: string;
}) {
  const content = (
    <>
      <span className="h-5 w-5 shrink-0 text-neutral-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-neutral-500">{value}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a
        className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
        href={href}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {content}
      </a>
    );
  }

  return <div className="flex min-h-16 items-center gap-3 px-4 py-3">{content}</div>;
}
