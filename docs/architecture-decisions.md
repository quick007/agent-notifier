# Architecture Decision Records

Status: draft implementation guidance
Research date: 2026-07-01
Local source of truth: [product-spec.md](product-spec.md)

This document records the current architecture decisions for Agent Notifier. It is intentionally practical: each decision includes the default path, rejected alternatives, and instructions for sibling implementation threads.

## Decision Summary

- Build the hosted product as a Cloudflare Workers app in `apps/web`, using the Cloudflare Vite plugin, Workers Static Assets, and a lightweight Workers-native router.
- Use Hono for API routing unless the app scaffold proves a better Workers-native router is already in place.
- Use D1 as the v1 source of truth for account metadata, routing metadata, encrypted envelopes, pairing sessions, delivery state, and response state.
- Use Drizzle schema definitions and generated SQL migrations. Avoid raw SQL in application code.
- Default to D1-first delivery orchestration. Add Queues for push fanout/retry work and Cron Triggers for sweeps. Do not start v1 with Workflows or Durable Objects.
- Use Web Push with VAPID for PWA notifications. The push payload must be a wakeup, not readable message content.
- Use Resend for setup emails only. Email copy should be polished product copy, not debug copy.
- Use Tailwind CSS v4 through Vite, Base UI for unstyled accessible primitives, and Heroicons for iconography.
- Keep MCP and CLI sender-side encryption local. A remote MCP server must not receive plaintext message content or sender private keys.

## ADR 001: Cloudflare Workers Full-Stack App

Decision: create `apps/web` as a Cloudflare Workers full-stack app with the Cloudflare Vite plugin, Workers Static Assets, and Hono for `/api/*` routes.

Why:

- Cloudflare's Vite plugin runs Worker code inside `workerd` for local development, which keeps local behavior close to production.
- Workers Static Assets supports serving HTML, CSS, images, and other assets as part of the Worker, while Worker code can still handle API routes.
- The product needs a PWA, API, service worker, setup screens, and mobile inbox in one deployment surface.
- Hono is lightweight, Web-standards-based, supports Cloudflare Workers directly, and can export `fetch`, `scheduled`, and `queue` handlers from one module Worker.

Rejected:

- Cloudflare Pages as the primary app host. Workers Static Assets is the more direct match for the current Cloudflare Workers direction.
- Next.js or another heavy full-stack framework. The product spec asks for a Workers-native layer and there is no need for SSR complexity in v1.
- A pure backend Worker plus separately hosted static app. It splits CSP, service worker, PWA, and API origin concerns before the product needs that complexity.

Sibling instructions:

- Scaffold `apps/web` only after reading this doc and `docs/product-spec.md`.
- Keep `/api/*` clearly separated from PWA asset routes.
- Prefer a mobile-first React PWA unless an app scaffold decision record later chooses another Vite-compatible UI layer.
- Treat strict CSP and no inline script as architectural requirements because the PWA holds device private keys.
- If the app uses the Vite plugin, remember that it produces a generated deployment config during build. Do not assume pure `wrangler dev` semantics.

## ADR 002: Repository-Owned Cloudflare Configuration

Decision: `wrangler.jsonc` in the app is the configuration source of truth. Dashboard-created Workers or dashboard Git Builds are allowed only if the repo config stays authoritative.

Why:

- Cloudflare recommends treating Wrangler configuration as the source of truth when using Wrangler.
- Dashboard edits to routes, variables, and triggers can be overwritten on later Wrangler deploys.
- Cron Triggers for a Wrangler-managed Worker should be managed through the Wrangler configuration.
- Cloudflare Workers Git Builds can connect a new or existing Worker to a GitHub/GitLab repository, but that should not become a second source of config truth.

Rejected:

- Manually creating a dashboard Worker and evolving bindings/routes in the dashboard while also deploying from the repo.
- Keeping secrets or account-specific credentials in tracked config.
- Using dashboard-only Cron Trigger or route state for a Worker that is deployed from `wrangler.jsonc`.

Sibling instructions:

- If using the dashboard import flow, align the Worker name, routes, D1 bindings, Queue bindings, and Cron Triggers with `wrangler.jsonc` before first production deploy.
- Use `wrangler secret put` for `RESEND_API_KEY` and `VAPID_PRIVATE_KEY`.
- Keep public VAPID key and non-secret values as explicit typed vars only if they are safe to publish.
- With the Cloudflare Vite plugin, set Cloudflare environments at build time, for example `CLOUDFLARE_ENV=staging vite build`, rather than relying on `wrangler deploy --env`.

## ADR 003: D1 and Drizzle Data Model

Decision: use D1 plus Drizzle as the v1 metadata and encrypted-envelope store.

Why:

- D1 is the required Cloudflare-native relational store in the product spec.
- Drizzle supports Cloudflare D1 and the Workers environment.
- D1 migrations are tracked SQL files, and Cloudflare supports Drizzle-style nested migration layouts through `migrations_pattern`.
- D1 supports foreign key constraints, so the schema can preserve relational integrity while staying portable enough for a future Postgres move.

Portable schema rules:

- Use app-generated string IDs such as `rcp_`, `dev_`, `snd_`, `msg_`, `rsp_`.
- Use explicit ownership columns on every scoped table: `recipientId`, `senderId`, `deviceId`, or `messageId` as appropriate.
- Store API timestamps as ISO strings. Storage may use integer milliseconds for indexed range queries, but do not mix both forms in one column family.
- Keep encrypted content in opaque text/blob columns. Do not query encrypted JSON internals.
- Use JSON text only for non-critical settings snapshots. If the app must filter or join on a value, make it a real column.
- Avoid SQLite-only behavior in app logic: no `rowid` assumptions, no autoincrement identity strategy, no critical JSON extraction queries.
- Raw SQL is acceptable in generated or reviewed migrations only.

Rejected:

- KV as primary metadata storage. It is not a relational source of truth for pairings, devices, messages, and response state.
- Durable Object storage as the first database. It is useful for hot serialized state, but not the default metadata store.
- Server-visible plaintext hashes for duplicate detection. Duplicate suppression belongs in the local sender runtime where plaintext exists.

Sibling instructions:

- Put Drizzle schema near the Worker app, for example `apps/web/src/db/schema.ts`, and export typed table definitions for route code.
- Generate migration SQL from Drizzle, review it, and apply via Wrangler D1 migrations.
- Apply D1 migrations by database name rather than binding name to avoid accidentally targeting the wrong binding.
- Keep the product spec table names unless a sibling data thread documents a better normalized shape.

## ADR 004: Queues, Cron, Workflows, and Durable Objects

Decision: start D1-first. Add Queues for asynchronous push fanout/retry jobs and Cron Triggers for expiry sweeps and low-effort catch-up passes. Do not use Workflows or Durable Objects by default in v1.

Why:

- Queues are designed to offload work from requests, buffer or batch data, retry, delay, and improve delivery guarantees.
- Cron Triggers are the right first primitive for periodic maintenance such as expiry sweeps and push-subscription cleanup.
- Workflows are compelling for durable multi-step execution and human-in-the-loop approvals, but they would add orchestration state before the basic notify/reply/approval flow proves it needs that layer.
- Durable Objects are a good fit for strongly consistent per-entity coordination and live connections, but D1 row updates are enough until the app sees hot-recipient contention or live setup state needs.

Rejected for v1 default:

- Workflows for every notification. Notifications are store, wake, fetch, decrypt, report.
- Durable Objects for every recipient. This turns the data model into a sharded state system before contention exists.
- Cron-only push fanout. User-facing request latency should not wait for the next schedule tick.

Sibling instructions:

- Sender request path should persist the encrypted envelope in D1, enqueue push fanout, and return `accepted`.
- Queue consumer should send Web Push wakeups, write delivery events, and mark push failures without reading message plaintext.
- Cron should mark expired messages/responses, delete envelopes past the 14-day retention window, trim events, and perform low-effort catch-up retries.
- Revisit Workflows only if reply/approval waiting logic becomes materially simpler with durable pause/resume, retries, and observability.
- Revisit Durable Objects only if D1 writes for one recipient become a correctness or latency bottleneck, or if live setup state needs serialized coordination.

## ADR 005: Web Push and iOS PWA Constraints

Decision: use standards-based Web Push with VAPID. On iOS/iPadOS, guide users to add the PWA to the Home Screen before expecting push to work.

Why:

- The Push API requires an active service worker and creates subscriptions that include an endpoint and encryption key material needed by the application server.
- VAPID uses an application server P-256 public key and matching private key for push-service authentication.
- WebKit added Web Push for Home Screen web apps in iOS/iPadOS 16.4. The app can request permission only in response to direct user interaction.
- Apple states that standards-based Web Push on iOS/iPadOS does not require Apple Developer Program membership.

Security and UX rules:

- Push payloads should contain only wakeup metadata such as `messageId` and reason, or a tiny encrypted wakeup envelope if a future source proves size and support are reliable.
- The service worker fetches pending encrypted envelopes, decrypts locally, verifies sender signatures, stores in IndexedDB, evaluates preview policy, and then shows the notification.
- If permission is denied or unavailable, pairing may still complete as `paired_no_push`; sender status and UI should make the degraded path obvious.
- Do not build a native iOS app path for v1.

Rejected:

- Server-rendered plaintext push previews. It violates the product promise.
- Native iOS app in v1. It adds APNs, Apple Developer Program, app review, and a second client surface.
- Treating browser push endpoint URLs as harmless. They are capability URLs and should be stored and handled as sensitive routing metadata.

Sibling instructions:

- Add explicit iOS setup copy after manual device testing.
- Verify push behavior on actual iOS hardware before public launch.
- Do not assume an npm `web-push` package works in Workers. Prove Worker compatibility or implement a small Worker-compatible sender around WebCrypto and `fetch`.

## ADR 006: Resend Setup Email

Decision: use Resend for setup and recovery email. The email carries an opaque setup link, not private keys or plaintext message content.

Why:

- Resend supports sending email through an API with required `from`, `to`, `subject`, and HTML/text or template content.
- Resend supports an `Idempotency-Key` header, which fits retry-safe setup email delivery.
- Resend's design source publishes product UI, brand, and design-system references that are useful for polished email and setup-copy quality.

Rejected:

- SMTP-first setup. Resend API is simpler for the Cloudflare Worker path.
- Sending agent notification contents through email. Email is setup/recovery only.
- Copying Resend brand assets or making Agent Notifier look like Resend. Use the design source as a quality benchmark, not as this product's identity.

Sibling instructions:

- Require `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- Use a verified sending domain before production.
- Use both HTML and text email bodies.
- Include sender display name, expiration, setup CTA, Terms link, Privacy link, and a plain explanation that message contents are encrypted.
- Use a Resend idempotency key derived from the pairing session ID for retries.

## ADR 007: UI Tooling

Decision: use Tailwind CSS v4 through Vite, Base UI for accessible unstyled primitives, and Heroicons for icons.

Why:

- Tailwind v4 has a first-party Vite plugin, matching the Cloudflare Vite direction.
- Base UI is unstyled, tree-shakable, and provides components like dialog, popover, menu, field, switch, tabs, toast, and tooltip without forcing a visual theme.
- Heroicons comes from Tailwind Labs, has React support, and covers the product's likely notification, inbox, approval, settings, device, and status icons.

Rejected:

- A pre-styled component kit that makes the product feel generic or forces a design identity.
- One-off custom accessible primitives for common controls.
- Icon text where a familiar icon plus accessible label is clearer.

Sibling instructions:

- Build a small local design system on top of Base UI rather than importing Base UI raw at every screen.
- Keep the visual style polished and quiet: mobile-first, strong privacy/status states, no marketing-only first screen.
- Use icons for mode/status/action affordances, with accessible names and tooltips where needed.
- Do not import Resend fonts, logos, or brand tokens into Agent Notifier.

## ADR 008: Local MCP and CLI Key Boundary

Decision: sender-side plaintext handling, encryption, signing, duplicate suppression, and sender private keys stay in the local CLI/MCP runtime. Remote MCP is not a valid v1 path if it receives plaintext or sender private keys.

Why:

- The product promise is that the hosted service cannot read notification titles, bodies, replies, approval details, or sensitive flags.
- MCP supports both local stdio and Streamable HTTP transports. Stdio lets the client launch a local subprocess, which is the right place to hold sender keys.
- A remote MCP server that accepts plaintext and encrypts on behalf of the user becomes a server-visible plaintext processor.
- A remote MCP server that holds sender private keys becomes a hosted signing authority and revocation liability.

Allowed future remote shape:

- A remote MCP facade may operate only on ciphertext, public metadata, and routing state, or it may coordinate a local helper that performs encryption and signing.
- Any future remote connector must have a separate security review and an explicit decision record.

Rejected:

- Hosted remote MCP with plaintext title/body parameters.
- Hosted remote MCP with user sender private keys.
- Remote duplicate detection using plaintext hashes.

Sibling instructions:

- Keep `packages/mcp` local stdio first.
- Keep `packages/cli` and `packages/mcp` sharing `packages/protocol` and `packages/crypto`; do not reimplement crypto per integration.
- Tool outputs should be compact JSON so Codex, Claude, and CI do not scrape prose.

## Current Risks and Open Questions

- Product name, domain, and app/marketing origin split are unresolved.
- iOS PWA push copy must be verified on real devices.
- Worker-compatible Web Push sender package choice is not yet proven.
- D1 may need Durable Objects later if hot-recipient contention appears.
- Workflows may be worthwhile later for long approval/reply waits, but should not be a default dependency.
- Terms, Privacy, and Security pages are required before public launch.

## Sources Checked

- Cloudflare Workers Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Wrangler configuration source of truth: https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth
- Cloudflare Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare choosing Wrangler vs Vite: https://developers.cloudflare.com/workers/local-development/wrangler-vs-vite/
- Cloudflare Vite migration notes: https://developers.cloudflare.com/workers/vite-plugin/reference/migrating-from-wrangler-dev/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare D1 foreign keys: https://developers.cloudflare.com/d1/sql-api/foreign-keys/
- Drizzle Cloudflare D1 docs: https://orm.drizzle.team/docs/connect-cloudflare-d1
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Workflows: https://developers.cloudflare.com/workflows/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- MDN Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- MDN PushManager.subscribe: https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
- WebKit Web Push for iOS/iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Resend send email docs: https://resend.com/docs/api-reference/emails/send-email
- Resend design source: https://resend.com/design.md
- Resend design-system skill docs: https://github.com/resend/design-skills
- Tailwind CSS v4 with Vite: https://tailwindcss.com/docs/installation/using-vite
- Base UI quick start: https://base-ui.com/react/overview/quick-start
- Heroicons: https://heroicons.com/
- MCP transports specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
