# Deployment

Status: operator notes for this repository. This is not a self-hosting guide or
a product feature promise.

## Current Shape

The web app is a Vite, React, Tailwind, and Cloudflare Worker app with routed
API modules and a local-first PWA shell.

- Public source repository:
  `https://github.com/quick007/agent-notifier`.
- Worker entrypoint: `apps/web/worker/index.ts`.
- Wrangler config: `apps/web/wrangler.jsonc`.
- Worker name: `agent-notifier-web`.
- Compatibility date: `2026-07-01`.
- `/api/*` should be routed through the Hono/OpenAPIHono backend contract.
- `/docs` serves the Scalar API reference, `/openapi.json` serves the
  Hono-derived OpenAPI 3.1 contract, and `/api/docs` redirects to `/docs`.
- The Worker exports `scheduled` and calls `runRetention`.
- `wrangler.jsonc` declares cron trigger `17 * * * *`.
- The PWA includes setup, inbox, saved, senders, settings, push
  troubleshooting, and legal screens backed by local browser state.

Backend source exists for D1/Drizzle schema, initial migration SQL, pairing,
devices, encrypted envelopes, responses, retention, Resend setup email, and Web
Push wakeups. CLI and local MCP implementations also exist.

## API Contract

Do not maintain a detached route inventory in deployment docs. The source of
truth is the Hono/OpenAPIHono route contract exposed by the Worker:

- Human reference: `GET /docs`
- Machine contract: `GET /openapi.json`
- Compatibility redirect: `GET /api/docs`

Device and sender routes use signed request headers. Pairing email start calls
Resend, and message creation records Web Push attempts through `ctx.waitUntil`.
CLI/MCP live transport should generate or validate typed clients from the
Hono-derived OpenAPI document instead of duplicating route contracts.

## Deployment Status

The Worker deployment is live. Product readiness is still incomplete because
package publication, plugin install through the published MCP package, and real
Web Push wakeup/phone notification delivery are not verified. Live browser/CLI
encrypted delivery, browser decrypt/local store/render, and reply/approval
response paths have been verified against the deployed Worker.

- `wrangler.jsonc` declares D1 binding `DB` for database `agent-notifier` with
  id `c1c7a3ff-9456-48db-8f6c-e7c9fd3d472d`.
- Live custom domain: `https://agent-notify.seufert.sh`.
- Live workers.dev URL: `https://agent-notifier-web.seufert.workers.dev`.
- The custom domain is live; `/api/health`, `/docs`, and `/openapi.json`
  returned 200 from `https://agent-notify.seufert.sh`.
- The first hosted deployment targets the Lukas Cloudflare account, pinned in
  Wrangler config with account ID `a95007cb065e2bfced646f55bfc5dd35`.
  Cloudflare account IDs are not secrets, but they are account-specific.
- Migrations live in `apps/web/migrations`, starting with
  `0001_initial.sql`.
- Remote D1 is created and baselined for that target. The initial schema already
  existed, `0001_initial.sql` was recorded in `d1_migrations`, and Wrangler now
  reports no remote migrations to apply.
- No Queue or Durable Object binding is currently configured.
- Worker secrets `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are configured.
- `APP_PUBLIC_URL` was removed; setup links derive from the incoming Worker
  request origin.
- Resend setup email smoke tests delivered.
- The npm scope `@agent-notifier` exists as a free public-package org, but
  `@agent-notifier/protocol`, `@agent-notifier/crypto`,
  `@agent-notifier/cli`, and `@agent-notifier/mcp` still return E404.
- npm package bootstrap and trusted publisher setup are blocked on
  user-present npm 2FA security-key/password verification.
- Codex plugin installation through the published MCP package is not verified.

## Local Checks

From the repository root:

```bash
vp install
vp run -w build
vp run -w typecheck
vp run -w test
vp run -w check:file-length
vp run -w check:packages
vp run -w check
```

Run these checks before release work and preserve the terminal logs or CI links
with the release notes. Passing local checks do not prove live deployment.

## Deploy Flow

This app uses the Cloudflare Vite plugin. `apps/web/wrangler.jsonc` is the input
configuration, not the final deploy configuration. It intentionally omits
`assets.directory`; `vp build` generates the deployable Worker config at:

```text
apps/web/dist/agent_notifier_web/wrangler.json
```

Do not deploy with the source config directly:

```bash
vp exec wrangler deploy --config apps/web/wrangler.jsonc
```

That command cannot work for this Vite Static Assets setup because the source
config does not contain the generated assets directory. Use the scripted flow:

```bash
vp run -w deploy:web:dry-run
vp run -w deploy:web
```

These scripts build first, then call Wrangler with the generated config.

## Bindings And Secrets

Current Cloudflare config:

- D1 binding: `DB`
- D1 database: `agent-notifier`
- Cloudflare account: Lukas; account ID
  `a95007cb065e2bfced646f55bfc5dd35` is pinned in Wrangler config for the
  first hosted deployment.
- Cron: `17 * * * *`
- Static assets: SPA fallback, with API and docs paths running the Worker first.

Runtime values read by the Worker:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

These values are configured as Worker secrets in Cloudflare. Use Cloudflare
secret storage for secret values and keep `.dev.vars`, `.env`, and similar
local secret files untracked.
Cloudflare account IDs are not secrets, but they are account-specific. Keep
secrets, private keys, API tokens, and private Cloudflare credentials out of
git.

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are required for email pairing. Email
links are derived from the incoming Worker request origin. Missing VAPID values
do not reject message creation, but push attempts are recorded as
`vapid_not_configured`.

## Resend And Push

Email rendering, backend route code, and the Resend adapter exist. Worker
secrets are configured, remote D1 migrations are clean, the Worker is deployed,
and Resend setup email smoke tests delivered. Live browser/CLI encrypted
delivery, browser decrypt/local store/render, and reply/approval response paths
have been verified against the deployed Worker.

Web Push wakeup code exists and uses VAPID settings. Do not claim phone
notification delivery until real Web Push wakeup and notification display are
tested on phone devices.

## Packages

Package CI and npm publish workflow files exist under `.github/workflows`.
Normal pushes to `main` are CI-only. Npm staging can be driven by a matching
`v*.*.*` tag or by a merged PR with exactly one release label. Manual dispatch
is for dry-run verification. `vp run -w check:packages` builds and dry-runs
publishable packages.

Do not claim npm publication, trusted publisher setup, provenance, or install
readiness until a real release succeeds. The `@agent-notifier` npm scope exists,
but the package records still return E404; package bootstrap and trusted
publisher setup are blocked on user-present npm 2FA security-key/password
verification. Codex plugin installation through the published MCP package is not
verified.

## External Setup

Cloudflare dashboard or account checks for future changes:

- Confirm the D1 database ID in `apps/web/wrangler.jsonc` still points at the
  baselined `agent-notifier` database in the Lukas account before new
  deployments.
- Re-run `vp run @agent-notifier/web#d1:migrate:remote` after any new
  migration files are added. D1 migrations use the source Wrangler config
  because migrations operate from `apps/web/migrations`, not the generated Vite
  deploy output.
- Confirm Worker secrets remain set for Resend and VAPID.
- Do not add `APP_PUBLIC_URL`; links derive from request origin.
- Confirm the production route or custom domain only if routing changes.
- Confirm the deployed Worker has the `17 * * * *` cron trigger.
- Re-run live `/api/health`, `/docs`, and `/openapi.json` smoke tests after
  deployments or route changes.

Resend dashboard checks for future changes:

- Confirm the sending domain or approved sender address.
- Confirm the production API key is still valid.
- Confirm `RESEND_FROM_EMAIL` matches the verified sender.
- Keep a delivered setup-email smoke test with release notes before claiming
  email pairing is production-ready.

## Release Checklist

Before any production-ready or public-package claim, verify:

- `vp install`
- `vp run -w build`
- `vp run -w typecheck`
- `vp run -w test`
- `vp run -w check:file-length`
- `vp run -w check:packages`
- `vp run -w check`
- D1 migrations applied to the configured database
- Worker secrets set in Cloudflare
- Worker deploy through `vp run -w deploy:web`, which uses the generated Vite+ Worker
  config
- Resend setup email with real credentials
- Browser/CLI encrypted delivery, local decrypt/store/render, and
  reply/approval response flow against the deployed Worker
- Real Web Push wakeup and phone notification delivery with real VAPID keys
- Cloudflare deploy and live `/api/health` smoke test
- Live `/docs` reference and Hono-derived `/openapi.json` smoke tests
- Custom domain or route configuration
- npm package records no longer return E404
- npm package bootstrap and trusted publisher setup complete after
  user-present npm 2FA verification
- exactly one release label is present on merged PR package releases
- npm trusted publishing/provenance release if packages are public
- Codex plugin install through the published MCP package
