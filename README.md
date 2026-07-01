# Agent Notifier

THIS IS VERY WIP! USE AT YOUR OWN RISK!

Agent Notifier is an encrypted notification and lightweight approval product for
AI agents.

It is for the moments when Codex, Claude, CI, or another local agent needs to say:
"the task is done", "I am blocked", or "please approve or reject this action".
It is not remote control, multi-turn chat, or a cloud-readable inbox.

## Current Status

This repository now has source foundations across the Worker app, PWA shell,
backend services, local CLI, local MCP server, protocol, crypto, email rendering,
and Codex plugin bundle. It is not yet a production deployment or published npm
release.

Public source repository:
[github.com/quick007/agent-notifier](https://github.com/quick007/agent-notifier).

- `apps/web` is a Vite, React, Tailwind, and Cloudflare Worker app.
- The Worker API contract should be owned by Hono/OpenAPIHono routes for
  health, pairing, devices, senders, and API documentation.
- Scalar API reference routes are served at `/docs`, backed by the Hono-derived
  OpenAPI 3.1 document at `/openapi.json`.
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
- End-to-end setup, push, decrypt, reply/approval, npm publication, production
  deployment, and plugin install readiness are not verified from this checkout.

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

More detail:

- [Security](docs/security.md)
- [Privacy](docs/privacy.md)
- [Terms](docs/terms.md)
- API reference: `/docs`, or `/openapi.json` for the raw OpenAPI 3.1 document
  generated from the Hono/OpenAPIHono route contract.

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

The local CLI implements the intended command shape with JSON output. Local
configuration mode does not send setup email, store plaintext messages, or fake
delivery; live delivery requires a Worker API URL and paired sender:

```bash
npx -y @agent-notifier/cli@latest setup
npx -y @agent-notifier/cli@latest setup --email user@example.com
npx -y @agent-notifier/cli@latest setup --code ABCD-1234
npx -y @agent-notifier/cli@latest notify \
  --title "Task complete" \
  --body "The run finished." \
  --non-sensitive \
  --wait-for delivered \
  --json
```

These `npx` examples depend on npm publication, which is not verified yet.

## MCP And Agent Integrations

The blessed integration path is local stdio MCP or CLI, because plaintext and
sender private keys need to stay on the sender machine. Live CLI/MCP HTTP
transport should use a typed client generated from the Hono/OpenAPIHono
contract, not duplicated hand-written route types.

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
but the `@agent-notifier/mcp@latest` package, plugin installation path, and
end-to-end Codex launch flow are not verified yet.

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
- Assets use single-page app fallback, with `/api/*` routed through the Worker.
- `wrangler.jsonc` declares the `DB` D1 binding for the `agent-notifier`
  database and an hourly retention cron at `17 * * * *`.
- The personal Cloudflare D1 target for `agent-notifier` is created and
  baselined. Worker secrets, deployment, custom domain, and live smoke tests
  still need environment-specific verification. For a fresh Cloudflare target,
  create or verify the `agent-notifier` D1 database and make sure
  `database_id` in `wrangler.jsonc` matches it before applying migrations or
  deploying.

Runtime values read by the Worker for deployed email and push:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Do not commit secrets or private Cloudflare credentials.
Keep the Cloudflare account ID out of tracked config; set it locally, for
example through `CLOUDFLARE_ACCOUNT_ID`, when Wrangler needs account selection.

Deployment notes live in [Deployment](docs/deployment.md). They describe this
repo's own Cloudflare operation path, not a public self-hosting feature.

## Development

Requirements from the root manifest:

- Node.js `>=24.0.0`
- pnpm `>=11.0.0`

Common commands:

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm check:packages
pnpm check
```

`pnpm dev` starts the Vite/Cloudflare app. `pnpm check` runs typecheck, tests,
the repository file-length check, and package verification.

## Supply Chain

The target package posture is trusted publishing or OIDC, npm provenance, no
long-lived npm tokens, no install lifecycle scripts in published packages, and
small package contents allowlisted by manifest.

Current status: npm publication and provenance are not verified. Protocol,
crypto, CLI, and MCP have publish-shaped manifests; emails and the Codex plugin
package remain private. Package CI and tag-driven publish workflows exist, with
manual dispatch kept for dry-run verification. Do not claim public package
provenance until GitHub/npm trusted publishing is configured and a real release
succeeds.

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
