# Agent Notifier

Agent Notifier is an encrypted notification and lightweight approval product for AI agents.

It is for the moments when Codex, Claude, CI, or another local agent needs to say:
"the task is done", "I am blocked", or "please approve or reject this action".
It is not remote control, multi-turn chat, or a cloud-readable inbox.

## Recommended Agent Setup

Email pairing is the recommended setup flow. Copy one of these commands into an
agent or terminal when the npm packages are published:

```bash
npx -y @agent-notifier/cli@latest setup
npx -y @agent-notifier/cli@latest setup --email user@example.com
npx -y @agent-notifier/cli@latest setup --code ABCD-1234
```

After pairing, agents should send only meaningful notifications, reply
requests, or approval requests:

```bash
npx -y @agent-notifier/cli@latest notify \
  --title "Task complete" \
  --body "The run finished." \
  --non-sensitive \
  --wait-for delivered \
  --json
```

These commands are the intended copy-paste interface, but npm publication is
still pending. Package records currently return E404, and package bootstrap and
trusted publisher setup are blocked on user-present npm 2FA verification.

## Current Status

This repository now has source foundations across the Worker app, PWA shell,
backend services, local CLI, local MCP server, protocol, crypto, email rendering,
and Codex plugin bundle. The Worker is deployed, but the product is not yet
production-ready and the npm packages are not published.

Public source repository:
[github.com/quick007/agent-notifier](https://github.com/quick007/agent-notifier).

- `apps/web` is a Vite, React, Tailwind, and Cloudflare Worker app.
- The Worker API contract is owned by Hono/OpenAPIHono routes for health,
  pairing, devices, senders, and API documentation.
- Hono/Scalar API reference routes are served at `/docs`, backed by the
  Hono-derived OpenAPI 3.1 document at `/openapi.json`.
- Drizzle D1 schema and an initial migration exist under `apps/web`.
- Backend modules cover pairing, devices, encrypted message envelopes, response
  storage, retention, Resend setup email, and Web Push wakeups.
- The PWA has setup, inbox, saved, sender, settings, push troubleshooting,
  legal screens, a web app manifest, a service worker, and app icons.
- `packages/protocol` and `packages/crypto` contain canonicalization, signing,
  key, encryption, envelope, and test-vector helpers.
- `packages/cli` and `packages/mcp` have dist-oriented package manifests and
  command/tool implementations. Without an API URL they return `local_config`
  results for local sender setup only; with a configured Worker origin they use
  `http_api` for live setup/status and encrypted send flow.
- The Codex plugin bundle source exists at
  `packages/codex-plugin/agent-notifier` and points at the local MCP package
  shape.
- The Worker is live at `https://agent-notify.seufert.sh` and
  `https://agent-notifier-web.seufert.workers.dev`.
- The custom domain is live; `/api/health`, `/docs`, and `/openapi.json`
  returned 200 from `https://agent-notify.seufert.sh`.
- Remote D1 migrations are clean with no pending migrations.
- Worker secrets are configured for Resend and VAPID.
- Resend setup email smoke tests delivered.
- Real browser Web Push, decrypt, local store, and delivery-report device QA are
  not complete.
- The npm scope `@agent-notifier` exists, but package records still return
  E404. Bootstrap and trusted publisher setup are blocked on user-present npm
  2FA verification, and Codex plugin install through the published MCP package
  is not verified.

## Trust Boundary

Agent Notifier sends phone-visible notifications and lightweight approval or
reply requests without giving the hosted service readable message content.

The intended trust boundary is:

- Local CLI or local stdio MCP encrypts and signs message content before it calls
  the hosted API.
- The Cloudflare service stores and routes encrypted envelopes.
- The phone/PWA decrypts messages locally and owns inbox history.
- Approval and reply responses are signed by the device and encrypted back to the
  sender.

The server still sees operational metadata: email addresses, recipient IDs,
sender IDs, device IDs, timestamps, push subscription metadata, queue state,
delivery state, rate-limit counters, and aggregate counters. It must not see
message titles, bodies, sensitive flags, replies, approval text, or approval
decision details except as encrypted blobs.

See [Security](docs/security.md), [Privacy](docs/privacy.md), and
[Terms](docs/terms.md). API reference is available at `/docs`, with the raw
Hono/OpenAPIHono OpenAPI 3.1 document at `/openapi.json`.

## User Flows

Email pairing is the recommended setup flow. The agent should ask before sending
a setup email unless the user clearly delegated setup. The phone opens the setup
link, creates or loads device keys, asks for push permission, and shows the
sender before the user approves pairing.

Pairing codes are the fallback when email is not wanted or is awkward. The phone
shows a short expiring code, the user gives it to the agent, and the phone still
approves the sender before pairing completes.

PWA push should be useful but not brittle. If notification permission is denied
or unsupported, pairing can still complete in a degraded state and the app can
fetch pending messages when opened. iPhone users may need to add the PWA to the
Home Screen before reliable Web Push is available.

## Agent Usage

Exact policy for agents:

- Send meaningful notifications only.
- Send user-requested alerts.
- Send when blocked and human input is needed.
- Request approval only when approval is already required by the surrounding
  workflow.
- Do not send routine progress spam unless the user asked for it.
- Do not invent approval gates just because this tool exists.

The local CLI implements the intended command shape with JSON output. The
recommended copy-paste commands are at the top of this README. Local
configuration mode does not send setup email, store plaintext messages, or
simulate remote delivery; live delivery requires a Worker API URL and paired
sender. The `npx` examples depend on npm publication, so use them as intended
command shape until the first release.

## MCP And Agent Integrations

The blessed integration path is local stdio MCP or CLI, because plaintext and
sender private keys need to stay on the sender machine. Live CLI/MCP HTTP
transport should use a typed client generated from the Hono/OpenAPIHono
contract, not duplicated hand-written route types.

A hosted cloud connector remains intentionally not approved for plaintext
message, reply, approval, or sender-private-key flows.

Local MCP source exists in `packages/mcp` and exposes the stdio command:

```bash
npx -y @agent-notifier/mcp@latest --stdio
```

Codex plugin source lives in:

```text
packages/codex-plugin/agent-notifier
```

The plugin bundle currently includes metadata, a local MCP server config, and a
Codex skill with usage policy. The MCP package implementation exists locally,
but the `@agent-notifier/mcp@latest` package is not published, package records
currently return E404, package bootstrap is blocked on user-present npm 2FA,
and plugin installation through the published MCP package is not verified yet.

Claude, Claude Code, CI, and generic agents should use the same local MCP server
or CLI package once available. See [Integrations](docs/integrations.md) for the
shared boundary and examples.

## Local Encryption Model

The local runtime owns sender private keys, duplicate suppression that depends
on plaintext, message encryption, request signing, and response decryption.
CLI/MCP local-config mode stores only local sender configuration and key
material. Live `http_api` transport should send only signed requests, public
keys, encrypted envelopes, key wraps, routing metadata, and delivery metadata.

The phone/PWA owns device private keys and local inbox history. If a device is
lost, the server-side encrypted queue can help deliver pending envelopes to
other paired devices, but it is not a readable cloud inbox and does not restore
the lost device's decrypted history.

## Cloudflare And Resend

The web app is designed for Cloudflare Workers:

- Worker entrypoint: `apps/web/worker/index.ts`
- Wrangler config: `apps/web/wrangler.jsonc`
- Worker name: `agent-notifier-web`
- Compatibility date: `2026-07-01`
- First hosted deployment account: Lukas, pinned in Wrangler config with
  account ID `a95007cb065e2bfced646f55bfc5dd35`.
- Live custom domain: `https://agent-notify.seufert.sh`
- Live workers.dev URL: `https://agent-notifier-web.seufert.workers.dev`
- Assets use single-page app fallback, with `/api/*` routed through the Worker.
- `wrangler.jsonc` declares the `DB` D1 binding for the `agent-notifier`
  database and an hourly retention cron at `17 * * * *`.
- The personal Cloudflare D1 target for `agent-notifier` is created and
  baselined, and remote migrations currently report no pending migrations.
- The deployed custom domain returned 200 for `/api/health`, `/docs`, and
  `/openapi.json`.
- `APP_PUBLIC_URL` is intentionally not configured; setup links derive their
  origin from the incoming Worker request.

Runtime values read by the Worker for deployed email and push:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Those Worker secrets are configured in Cloudflare. Resend setup email smoke
tests delivered. Full phone Web Push, decrypt, local store, and delivery-report
QA is still pending.

Cloudflare account IDs are not secrets, but they are account-specific. This
repo pins the Lukas account ID in Wrangler config for the first hosted
deployment. Do not commit secrets, private keys, API tokens, or private
Cloudflare credentials.

Deployment notes live in [Deployment](docs/deployment.md). They describe this
repo's own Cloudflare operation path, not a public self-hosting feature.

## Development

Requirements from the root manifest:

- Node.js `>=24.0.0`
- pnpm `>=11.0.0`
- Vite+ CLI `vp`

Common commands:

```bash
vp install
vp run -w dev
vp run -w build
vp run -w typecheck
vp run -w test
vp run -w check:packages
vp run -w check
```

`vp run -w dev` starts the Vite+/Cloudflare app. `vp run -w check` runs
typecheck, tests, the repository file-length check, and package verification.

## Supply Chain

The target package posture is trusted publishing or OIDC, npm provenance, no
long-lived npm tokens, no install lifecycle scripts in published packages, and
small package contents allowlisted by manifest.

Current status: npm publication and provenance are not verified. The
`@agent-notifier` npm org/scope exists as a free public-package org, but
`@agent-notifier/protocol`, `@agent-notifier/crypto`,
`@agent-notifier/cli`, and `@agent-notifier/mcp` still return E404. Protocol,
crypto, CLI, and MCP have publish-shaped manifests; emails and the Codex plugin
package remain private. Package bootstrap and trusted publisher setup are
blocked on user-present npm 2FA security-key/password verification, and
package-driven Codex plugin install is not verified. Package CI and tag-driven
publish workflows exist, with manual dispatch kept for dry-run verification. Do
not claim public package provenance until GitHub/npm trusted publishing is
configured and a real release succeeds.

The local package guard is:

```bash
node scripts/verify-packages.mjs
```

It builds and dry-runs publishable packages, checks packed entrypoints, skips
private packages, and enforces a files allowlist, banned install lifecycle hooks,
and no external runtime dependencies.

More package detail:

- [CLI and local MCP](docs/cli-mcp.md)
- [npm supply chain](docs/npm-supply-chain.md)

## License

MIT. See [LICENSE](LICENSE).

## Repository Map

- [Product spec](docs/product-spec.md): product, protocol, data, API, and roadmap
  source of truth.
- [Security](docs/security.md): threat model, metadata boundary, crypto posture,
  and reporting channel.
- [Privacy](docs/privacy.md): user-facing data and retention explanation.
- [Terms](docs/terms.md): concise launch terms draft.
- [Deployment](docs/deployment.md): Cloudflare and Resend operator notes.
- [Integrations](docs/integrations.md): local CLI/MCP, Codex, Claude, CI, and
  connector boundaries.
- [API and delivery backend plan](docs/api-delivery-plan.md): backend lane
  details for D1, Drizzle, pairing, delivery, retention, email, and push.
- [UI product direction](docs/ui-product-direction.md): PWA, inbox, setup, and
  visual guidance.
