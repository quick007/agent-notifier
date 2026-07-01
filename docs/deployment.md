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

Deployment is not complete or live-verified.

- `wrangler.jsonc` declares D1 binding `DB` for database `agent-notifier` with
  id `c1c7a3ff-9456-48db-8f6c-e7c9fd3d472d`.
- The personal Cloudflare target is the Lukas account. Keep the account ID out
  of tracked config and pass it locally, for example with
  `CLOUDFLARE_ACCOUNT_ID`, when Wrangler needs account selection.
- Migrations live in `apps/web/migrations`, starting with
  `0001_initial.sql`.
- Remote D1 is created and baselined for that target. The initial schema already
  existed, `0001_initial.sql` was recorded in `d1_migrations`, and Wrangler now
  reports no remote migrations to apply.
- No Queue or Durable Object binding is currently configured.
- Worker secrets still need to be configured.
- Cloudflare deploy, route/custom domain, and live smoke tests are pending.
- npm packages have not been publicly published or provenance-verified.
- Codex plugin installation readiness is not verified.

## Local Checks

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm check:file-length
pnpm check:packages
pnpm check
```

Run these checks before release work and preserve the terminal logs or CI links
with the release notes. Passing local checks do not prove live deployment.

## Deploy Flow

This app uses the Cloudflare Vite plugin. `apps/web/wrangler.jsonc` is the input
configuration, not the final deploy configuration. It intentionally omits
`assets.directory`; `vite build` generates the deployable Worker config at:

```text
apps/web/dist/agent_notifier_web/wrangler.json
```

Do not deploy with the source config directly:

```bash
pnpm exec wrangler deploy --config apps/web/wrangler.jsonc
```

That command cannot work for this Vite Static Assets setup because the source
config does not contain the generated assets directory. Use the scripted flow:

```bash
pnpm deploy:web:dry-run
pnpm deploy:web
```

These scripts build first, then call Wrangler with the generated config.

## Bindings And Secrets

Current Cloudflare config:

- D1 binding: `DB`
- D1 database: `agent-notifier`
- Cloudflare account: Lukas; account ID is local operator configuration, not
  tracked repo config.
- Cron: `17 * * * *`
- Static assets: SPA fallback, with API and docs paths running the Worker first.

Runtime values read by the Worker:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_PUBLIC_URL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Use Cloudflare secret storage for secret values. Keep `.dev.vars`, `.env`, and
similar local secret files untracked.

`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `APP_PUBLIC_URL` are required for
email pairing. Missing VAPID values do not reject message creation, but push
attempts are recorded as `vapid_not_configured`.

## Resend And Push

Email rendering, backend route code, and the Resend adapter exist. Do not claim
email pairing is live until real Resend credentials, D1 migrations, deployment,
and setup flow are tested end to end.

Web Push wakeup code exists and uses VAPID settings. Do not claim phone delivery
until push subscriptions, wakeup delivery, local decrypt/store, and delivery
reporting are tested on real browser devices.

## Packages

Package CI and tag-driven npm publish workflow files exist under
`.github/workflows`. Manual dispatch is for dry-run verification.
`pnpm check:packages` builds and dry-runs publishable packages.

Do not claim npm publication, trusted publisher setup, provenance, or install
readiness until a real release succeeds.

## External Setup

Cloudflare dashboard or account steps still required:

- Confirm the D1 database ID in `apps/web/wrangler.jsonc` still points at the
  baselined `agent-notifier` database in the Lukas account before deployment.
- Re-run `pnpm --filter @agent-notifier/web d1:migrate:remote` after any new
  migration files are added. D1 migrations use the source Wrangler config
  because migrations operate from `apps/web/migrations`, not the generated Vite
  deploy output.
- Set Worker secrets and variables for Resend, app URL, and VAPID.
- Configure the production route or custom domain.
- Confirm the deployed Worker has the `17 * * * *` cron trigger.
- Run a live `/api/health` smoke test against the deployed URL.
- Open `/docs` and confirm it links to the Hono-derived API contract.
- Fetch `/openapi.json` and confirm it is the same contract used by CLI/MCP
  typed-client generation.

Resend dashboard steps still required:

- Verify the sending domain or approved sender address.
- Create the production API key.
- Confirm `RESEND_FROM_EMAIL` matches the verified sender.
- Send a real setup email through the deployed Worker before claiming email
  pairing is production-ready.

## Release Checklist

Before any public deployment claim, verify:

- `pnpm install --frozen-lockfile`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm check:file-length`
- `pnpm check:packages`
- `pnpm check`
- D1 migrations applied to the configured database
- Worker secrets set in Cloudflare
- Worker deploy through `pnpm deploy:web`, which uses the generated Vite Worker
  config
- Resend setup email with real credentials
- Web Push wakeup behavior with real VAPID keys
- PWA fetch/decrypt/deliver/report flow on a real browser device
- Cloudflare deploy and live `/api/health` smoke test
- Live `/docs` reference and Hono-derived `/openapi.json` smoke tests
- Custom domain or route configuration
- npm trusted publishing/provenance release if packages are public
