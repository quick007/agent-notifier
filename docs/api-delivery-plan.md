# API and Delivery Backend

Status: current backend design and deployment notes. The Worker scaffold, Hono
contract-first router, D1 schema, initial migration, service modules, generated
API docs, and live Worker deployment exist. Backend API work should keep typed
clients and API docs on the same route source of truth.

## Owned Surface

Backend-owned paths:

- `apps/web/worker/index.ts`
- `apps/web/src/server/**`
- `apps/web/src/db/**`
- `apps/web/migrations/**`
- `packages/emails/**`
- backend-focused Worker tests

Do not put browser crypto, local IndexedDB inbox behavior, CLI/MCP key storage,
or product UI state in this lane.

## Current Worker Shape

`apps/web/worker/index.ts` exports:

- `fetch`: routes `/api/*` to `handleApiRequest`.
- `scheduled`: calls `runRetention`.

`apps/web/src/server/router.ts` owns the current Hono/OpenAPIHono routing.
New API contract work should add route definitions there or in its route
modules instead of adding detached manual OpenAPI schemas.

Hono contract boundary:

- Keep the shared route contract in a publishable shared package, preferably an
  `@agent-notifier/protocol` subpath, so web, CLI, and MCP do not copy route
  strings or schema shapes.
- The Worker app should import and implement that contract; it should not be
  the only place that exports client-facing `AppType`.
- The CLI should use Hono's typed client against the shared app type for live
  transport. MCP should continue to consume the CLI/client surface.
- If the shared contract package or CLI needs Hono/Zod runtime dependencies,
  keep them narrow and intentionally approved in the package verifier.

Current route families:

- Health: `GET /api/health`.
- Pairing: email start, code start/claim, approve, status.
- Devices: register, push subscription, pending messages, delivered, respond,
  sender list, sender revoke.
- Senders: submit message, status, events, response.

## Verified Live Status

- Worker deployed at `https://agent-notify.seufert.sh` and
  `https://agent-notifier-web.seufert.workers.dev`.
- The custom domain is live; `/api/health`, `/docs`, and `/openapi.json`
  returned 200 from `https://agent-notify.seufert.sh`.
- Hono/Scalar docs are generated from the route/schema layer, with
  `/openapi.json` as the Hono-derived OpenAPI 3.1 contract.
- Remote D1 migrations are clean with no pending migrations.
- Worker secrets `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are configured.
- `APP_PUBLIC_URL` was removed; setup links derive from the incoming Worker
  request origin.
- Resend setup email smoke tests delivered.

## Implemented Backend Modules

- `db/schema.ts`: Drizzle D1 schema for recipients, emails, devices, senders,
  pairing sessions, encrypted messages, key wraps, encrypted responses, delivery
  events, rate-limit buckets, auth nonces, and aggregate counters.
- `migrations/0001_initial.sql`: initial D1 migration.
- `auth.ts`: signed request verification for sender/device requests, timestamp
  freshness, request-body hash, ECDSA P-256 verification, and nonce replay
  recording.
- `schemas.ts` and `validation.ts`: Hono/Zod request and response schemas,
  JSON parsing helpers, and rejection of plaintext content fields in
  encrypted-message APIs.
- `pairing-service.ts`: email and code pairing session creation, code claim,
  approval, and status.
- `device-service.ts`: device registration, push subscription update, pending
  envelope reads, delivery report, response acceptance, sender listing, and
  revocation.
- `message-service.ts`: encrypted message persistence, key-wrap persistence,
  push wakeup scheduling through `ctx.waitUntil`, sender-visible status/events,
  encrypted response storage, and response fetch.
- `resend-service.ts`: setup email delivery through Resend.
- `push-service.ts`: VAPID Web Push wakeups using `@block65/webcrypto-web-push`.
- `retention-service.ts`: expiry and retention sweep.

## Data And Privacy Rules

- Use Drizzle for application data access. Raw SQL belongs in reviewed
  migrations only.
- Store opaque encrypted payload fields for message and response content.
- Do not store readable title, body, sensitive flag, reply text, approval text,
  or approval decision details in D1, queue jobs, logs, or delivery events.
- Duplicate suppression that needs plaintext stays in the local sender runtime.
- Server rate limits and replay checks use metadata, sender/device identity, and
  nonce records, not plaintext hashes.

## Delivery Flow

1. Local sender builds and signs an encrypted message envelope.
2. `POST /api/senders/messages` verifies sender request headers, validates the
   encrypted envelope shape, stores the envelope and per-device key wraps, and
   records `accepted`.
3. Push wakeups are attempted through `ctx.waitUntil`; there is no Queue binding
   yet.
4. Device fetches pending envelopes with `GET /api/devices/messages/pending`.
5. Device decrypts and verifies locally, stores local inbox state, then reports
   delivery with `POST /api/devices/messages/:messageId/delivered`.
6. Reply/approval responses are submitted as encrypted response envelopes and
   relayed back to the sender.

## Current Gaps

- D1 migrations must still be applied whenever schema changes land.
- No Queue binding is configured; push fanout currently runs through
  `ctx.waitUntil`.
- Real browser push, service-worker fetch/decrypt/store, and delivery reporting
  still need end-to-end device QA.
- The npm scope `@agent-notifier` exists as a free public-package org, but
  `@agent-notifier/protocol`, `@agent-notifier/crypto`,
  `@agent-notifier/cli`, and `@agent-notifier/mcp` still return E404.
- npm package bootstrap and trusted publisher setup are blocked on
  user-present npm 2FA security-key/password verification.
- Codex plugin install through the published MCP package is not verified.
- A hosted cloud connector remains intentionally not approved for plaintext
  message, reply, approval, or sender-private-key flows.
- Broaden route tests around pairing, signatures, plaintext rejection, message
  persistence, response first-wins behavior, push failures, and retention.

## Validation

Relevant checks:

```bash
vp run @agent-notifier/web#typecheck
vp run @agent-notifier/web#test
vp run -w build
vp run -w check
```

These checks are local verification only. They do not prove live Cloudflare
deployment health, Resend delivery, Web Push delivery, npm publication, or
plugin install readiness unless those live checks are run separately for the
current release.
