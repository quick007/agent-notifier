# Cloudflare Stack Notes

Status: current Cloudflare implementation notes. Earlier pre-scaffold Hono,
Queue, and skeleton guidance has been superseded by the current Worker/Vite
shape in this repository.

## Current App Shape

The Cloudflare app lives in `apps/web`:

- `worker/index.ts`: Worker module entrypoint with `fetch` and `scheduled`.
- `src/server/router.ts`: Hono/OpenAPIHono API router and local API
  reference for `/api/*`, `/openapi.json`, and `/docs`.
- `src/server/services/**`: pairing, device, message, push, Resend, retention.
- `src/db/schema.ts`: Drizzle D1 schema.
- `migrations/0001_initial.sql`: initial migration.
- `src/**`: React PWA shell and local browser state.
- `public/sw.js`: service worker for test notification and push wakeup display.
- `wrangler.jsonc`: Worker, assets, D1 binding, observability, and cron config.

The app currently uses Hono/OpenAPIHono for contract-first API routing. Keep
new API routes in that stack so the Worker implementation, typed client
surface, and OpenAPI document stay aligned.

## Wrangler Configuration

Current tracked config:

- Worker name: `agent-notifier-web`.
- Main: `./worker/index.ts`.
- Compatibility date: `2026-07-01`.
- Static assets: SPA fallback, with `/api/*` running the Worker first.
- D1 binding: `DB`.
- D1 database: `agent-notifier`.
- Cron trigger: `17 * * * *`.
- Observability enabled.

No Queue or Durable Object binding is configured. Push fanout currently happens
inside `ctx.waitUntil`; add a Queue only if retry isolation or backpressure
requires it.

Do not commit Cloudflare account IDs, API tokens, private keys, or local secret
files. The database ID is tracked because Wrangler requires it for the bound D1
resource.

## Runtime Values

The Worker reads:

- `DB`: D1 binding.
- `RESEND_API_KEY`.
- `RESEND_FROM_EMAIL`.
- `VAPID_PUBLIC_KEY`.
- `VAPID_PRIVATE_KEY`.
- `VAPID_SUBJECT`.

Missing Resend values cause email setup to fail with a service error. Email
links are derived from the incoming Worker request origin. Missing VAPID values
make push attempts record `vapid_not_configured`.

## D1 And Drizzle

Source of truth:

- Drizzle schema: `apps/web/src/db/schema.ts`.
- Migration SQL: `apps/web/migrations`.
- Drizzle config: `apps/web/drizzle.config.ts`.

Use Drizzle query builders in application code. Raw SQL is acceptable for
generated or reviewed migrations.

Remote D1 migration commands should target the database name:

```bash
wrangler d1 migrations apply agent-notifier --remote
```

Review generated SQL before applying it remotely.

## Delivery Pipeline

Sender path:

1. Verify sender signed request headers.
2. Reject plaintext content fields in API JSON.
3. Persist encrypted envelope and key wraps in D1.
4. Record delivery events without plaintext content.
5. Attempt Web Push wakeups through `ctx.waitUntil`.

Device path:

1. Verify device signed request headers.
2. Return pending encrypted envelopes and this device's key wrap.
3. Accept delivered reports after local decrypt/store.
4. Accept encrypted reply/approval responses.

Scheduled path:

1. Mark expired messages.
2. Delete old encrypted queue rows and response rows.
3. Trim delivery events.

## Validation

Local checks:

```bash
pnpm install --frozen-lockfile
pnpm --filter @agent-notifier/web typecheck
pnpm --filter @agent-notifier/web test
pnpm build
pnpm check
```

Before public launch, still verify Cloudflare deployment, D1 migrations, Resend
email, Web Push on real devices, PWA fetch/decrypt/store/report behavior, and
live `/api/health`.

## Guardrails

- No remote-control product features.
- No multi-turn chat.
- No server-readable message content.
- No server-visible plaintext duplicate hashes.
- No third-party marketing scripts on the app origin.
- No self-hosting-first docs or positioning.
- No raw dashboard drift from tracked Wrangler config.
