import {
  ArrowRightIcon,
  CodeBracketIcon
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { DOCS_URL, GITHUB_URL } from "../lib/links";
import type { Settings } from "../types";
import { BrandMark, GitHubIcon } from "../components/Brand";
import { CodePanel, EmailLinkPanel } from "../components/PairingPanels";
import {
  DeveloperCallout,
  ProductModes,
  ProductSteps,
  TrustNote
} from "../components/ProductExplainer";
import { SetupInstructions } from "../components/SetupInstructions";
import { SiteFooter } from "../components/SiteFooter";
import { Button, cn } from "../components/ui";

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
    settings.pairing.kind === "email" && Boolean(settings.pairing.sessionId);
  const pairing = hasEmailLink || hasCode;

  return (
    <div className="an-rise mx-auto w-full max-w-7xl px-5 py-6 sm:px-6 lg:px-8 lg:py-10">
      <TopBar />
      {pairing ? (
        <PairingLayout
          hasEmailLink={hasEmailLink}
          onApprovePairing={onApprovePairing}
          onPushState={onPushState}
          onStartPairing={onStartPairing}
          settings={settings}
        />
      ) : (
        <LandingLayout onStartPairing={onStartPairing} />
      )}

      <SiteFooter className="mt-14 border-t border-neutral-200 pt-6 dark:border-neutral-900" />
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950">
          <BrandMark className="h-6 w-6" />
        </div>
        <p className="truncate text-sm font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
          Agent Notifier
        </p>
      </div>
      <nav className="flex shrink-0 items-center gap-2" aria-label="Resources">
        <TopLink hideOnMobile href={DOCS_URL}>
          <CodeBracketIcon className="h-4 w-4" />
          API reference
        </TopLink>
        <TopLink href={GITHUB_URL}>
          <GitHubIcon className="h-4 w-4" />
          GitHub
        </TopLink>
      </nav>
    </header>
  );
}

function TopLink({
  children,
  hideOnMobile = false,
  href
}: {
  children: ReactNode;
  hideOnMobile?: boolean;
  href: string;
}) {
  return (
    <a
      className={cn(
        hideOnMobile ? "hidden sm:inline-flex" : "inline-flex",
        "min-h-10 items-center gap-2 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-50 dark:focus:ring-blue-400"
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function LandingLayout({ onStartPairing }: { onStartPairing: () => void }) {
  return (
    <>
      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.95fr)] lg:items-start xl:gap-14">
        <div className="max-w-2xl lg:pt-8">
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl lg:text-6xl">
            Encrypted notifications and lightweight approvals for AI agents
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-neutral-600 dark:text-neutral-300">
            Let Codex, Claude, CI, or any agent reach your phone when a task is
            done, blocked, or waiting on approval. Contents stay end-to-end
            encrypted &mdash; only your device can read them.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus:ring-offset-neutral-950"
              href={DOCS_URL}
              rel="noreferrer"
              target="_blank"
            >
              <CodeBracketIcon className="h-5 w-5" />
              API reference
              <ArrowRightIcon className="h-4 w-4" />
            </a>
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:hover:text-neutral-50 dark:focus:ring-offset-neutral-950"
              href={GITHUB_URL}
              rel="noreferrer"
              target="_blank"
            >
              <GitHubIcon className="h-5 w-5" />
              GitHub
            </a>
          </div>
          <div className="mt-10 max-w-xl">
            <ProductSteps />
          </div>
        </div>

        <div className="min-w-0 lg:sticky lg:top-8">
          <SetupInstructions />
          <ManualPairFallback
            className="mt-5"
            onStartPairing={onStartPairing}
          />
        </div>
      </section>

      <section className="mt-16 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            What we can and cannot see
          </h2>
          <div className="mt-5">
            <TrustNote />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            Three ways an agent can reach you
          </h2>
          <div className="mt-5">
            <ProductModes />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
          Built for developers
        </h2>
        <div className="mt-5">
          <DeveloperCallout />
        </div>
      </section>
    </>
  );
}

function PairingLayout({
  hasEmailLink,
  onApprovePairing,
  onPushState,
  onStartPairing,
  settings
}: {
  hasEmailLink: boolean;
  onApprovePairing: () => void;
  onPushState: (state: Settings["pushState"]) => void;
  onStartPairing: () => void;
  settings: Settings;
}) {
  return (
    <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.75fr)] lg:items-start xl:gap-14">
      <div className="max-w-2xl lg:pt-8">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-5xl">
          Finish pairing this device
        </h1>
        <p className="mt-5 max-w-xl text-base leading-8 text-neutral-600 dark:text-neutral-300">
          Approve the sender, enable notifications, and keep readable message
          contents local to this browser.
        </p>
        <div className="mt-10 max-w-xl">
          <TrustNote />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {hasEmailLink ? (
          <EmailLinkPanel
            onPushState={onPushState}
            onStartPairing={onStartPairing}
            secretPresent={Boolean(settings.pairing.secret)}
            sessionId={settings.pairing.sessionId ?? ""}
          />
        ) : (
          <CodePanel
            code={settings.pairing.code ?? ""}
            onApprove={onApprovePairing}
            onPushState={onPushState}
            {...(settings.pairing.expiresAt
              ? { expiresAt: settings.pairing.expiresAt }
              : {})}
          />
        )}
      </div>
    </section>
  );
}

function ManualPairFallback({
  className,
  onStartPairing
}: {
  className?: string;
  onStartPairing: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400",
        className
      )}
    >
      <span>Pairing without an agent?</span>
      <Button
        className="min-h-0 px-1 py-0 text-neutral-950 underline underline-offset-4 dark:text-neutral-50"
        tone="ghost"
        onClick={() => {
          onStartPairing();
          navigate("/setup/pair");
        }}
      >
        Generate a pairing code
      </Button>
    </div>
  );
}
