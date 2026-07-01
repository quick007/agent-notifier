import { CheckCircleIcon } from "@heroicons/react/24/outline";

import { navigate } from "../lib/routes";
import { requestPushPermission } from "../lib/pwa";
import type { Settings } from "../types";
import { BrandMark } from "../components/Brand";
import {
  DeveloperCallout,
  ProductModes,
  ProductSteps,
  TrustNote
} from "../components/ProductExplainer";
import { SiteFooter } from "../components/SiteFooter";
import { Badge, Button } from "../components/ui";

export function SetupScreen({
  settings,
  onStartPairing,
  onApprovePairing,
  onPushState
}: {
  settings: Settings;
  onStartPairing: () => void;
  onApprovePairing: () => void;
  onPushState: (state: Settings["pushState"]) => void;
}) {
  const hasCode = Boolean(settings.pairing.code);
  const hasEmailLink =
    settings.pairing.kind === "email" && settings.pairing.sessionId;
  const pairing = hasEmailLink || hasCode;

  return (
    <div className="an-rise mx-auto w-full max-w-3xl px-5 py-10 md:py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950">
        <BrandMark className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Encrypted notifications and lightweight approvals for AI agents
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-7 text-neutral-600 dark:text-neutral-300">
        Let Codex, Claude, CI, or any agent reach your phone when a task is
        done, it&rsquo;s blocked, or it needs your approval. Contents stay
        end-to-end encrypted &mdash; only this device can read them.
      </p>

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        {hasEmailLink ? (
          <EmailLinkPanel
            onPushState={onPushState}
            onStartPairing={onStartPairing}
            secretPresent={Boolean(settings.pairing.secret)}
            sessionId={settings.pairing.sessionId ?? ""}
          />
        ) : hasCode ? (
          <CodePanel
            code={settings.pairing.code ?? ""}
            onApprove={onApprovePairing}
            onPushState={onPushState}
            {...(settings.pairing.expiresAt
              ? { expiresAt: settings.pairing.expiresAt }
              : {})}
          />
        ) : (
          <StartPanel onStartPairing={onStartPairing} />
        )}
      </div>

      {!pairing && (
        <>
          <section className="mt-14">
            <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
            <div className="mt-5">
              <ProductSteps />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-semibold tracking-tight">
              Three ways an agent can reach you
            </h2>
            <div className="mt-5">
              <ProductModes />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-semibold tracking-tight">
              What we can and cannot see
            </h2>
            <div className="mt-5">
              <TrustNote />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-semibold tracking-tight">
              Built for developers
            </h2>
            <div className="mt-5">
              <DeveloperCallout />
            </div>
          </section>
        </>
      )}

      <SiteFooter className="mt-12" />
    </div>
  );
}

function StartPanel({ onStartPairing }: { onStartPairing: () => void }) {
  return (
    <div className="grid gap-3">
      <Button
        tone="primary"
        onClick={() => {
          onStartPairing();
          navigate("/setup/pair");
        }}
      >
        Pair an agent
      </Button>
      <a
        className="text-center text-sm text-neutral-500 transition hover:text-neutral-950 dark:hover:text-neutral-50"
        href="#/setup/pair"
      >
        Waiting for a setup email?
      </a>
    </div>
  );
}

function EmailLinkPanel({
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

function CodePanel({
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
        <Button
          onClick={async () => {
            onPushState(await requestPushPermission());
          }}
        >
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
          Approve demo sender
        </Button>
      </div>
    </div>
  );
}
