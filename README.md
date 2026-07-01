# Agent Notifier

Agent Notifier is an encrypted notification and lightweight approval product
for AI agents.

Use it when Codex, Claude, CI, or another local agent needs to say "the task is
done", "I am blocked", or "please approve or reject this action" without
turning your phone into a remote-control surface or a full chat client.

The hosted service routes encrypted envelopes. Local CLI/MCP runtimes encrypt
and sign message content before it reaches Cloudflare, and the phone/PWA
decrypts messages locally.

## Install

Email pairing is the recommended setup flow. These are the intended copy-paste
commands once the npm packages are published:

```bash
npx -y @agent-notifier/cli@latest setup
npx -y @agent-notifier/cli@latest setup --email user@example.com
npx -y @agent-notifier/cli@latest setup --code ABCD-1234
```

After pairing, agents should send only meaningful notifications, reply requests,
or approval requests:

```bash
npx -y @agent-notifier/cli@latest notify \
  --title "Task complete" \
  --body "The run finished." \
  --non-sensitive \
  --wait-for delivered \
  --json
```

Package publication is pending. The `@agent-notifier` npm scope exists, but
`@agent-notifier/protocol`, `@agent-notifier/crypto`,
`@agent-notifier/cli`, and `@agent-notifier/mcp` currently return E404.
Package bootstrap and trusted publisher setup are blocked on user-present npm
2FA verification, so do not treat `npx` install or package provenance as
complete yet.

## What Exists Today

This repository contains the Cloudflare Worker/PWA app, D1/Drizzle schema,
protocol and crypto packages, local CLI, local MCP server, email templates, and
Codex plugin bundle source.

The hosted Worker is live at:

- `https://agent-notify.seufert.sh`
- `https://agent-notifier-web.seufert.workers.dev`

The app exposes the Hono/OpenAPIHono API reference at `/docs` and the generated
OpenAPI 3.1 document at `/openapi.json`. Remote D1 migrations are clean, Worker
secrets are configured for Resend and VAPID, and setup-email smoke tests have
delivered. Live browser/CLI encrypted delivery, browser decrypt/local
store/render, and reply/approval response paths have been verified against the
deployed Worker. Real Web Push wakeup and phone notification delivery remain
pending.

Public source repository:
[github.com/quick007/agent-notifier](https://github.com/quick007/agent-notifier).

## Product Boundary

Agent Notifier is for phone-visible notifications, short replies, and explicit
approve/reject decisions.

It is not:

- Remote control.
- Multi-turn chat.
- A cloud-readable inbox.
- A hosted plaintext connector.

A hosted connector must not receive plaintext message content, approval details,
reply text, sender private keys, or server-visible plaintext hashes. The safe
path is local CLI or local stdio MCP plus the Cloudflare API.

## Trust Boundary

The server still sees operational metadata: email addresses, recipient IDs,
sender IDs, device IDs, timestamps, push subscription metadata, queue state,
delivery state, rate-limit counters, and aggregate counters.

The server must not see message titles, bodies, sensitive flags, replies,
approval text, or approval decision details except as encrypted blobs.

See [Security](docs/security.md), [Privacy](docs/privacy.md), and
[Terms](docs/terms.md). API reference is available at `/docs`, with the raw
OpenAPI document at `/openapi.json`.

## User Flows

Email pairing is the recommended setup flow. The agent should ask before sending
a setup email unless the user clearly delegated setup. The phone opens the setup
link, creates or loads device keys, asks for push permission, and shows the
sender before the user approves pairing.

Pairing codes are the fallback when email is not wanted or is awkward. The phone
shows a short expiring code, the user gives it to the agent, and the phone still
approves the sender before pairing completes.

If notification permission is denied or unsupported, pairing can still complete
in a degraded state and the app can fetch pending messages when opened. iPhone
users may need to add the PWA to the Home Screen before reliable Web Push is
available.

## Agent Usage Policy

Agents should use Agent Notifier sparingly:

- Send meaningful notifications only.
- Send user-requested alerts.
- Send when blocked and human input is needed.
- Request approval only when approval is already required by the surrounding
  workflow.
- Do not send routine progress spam unless the user asked for it.
- Do not invent approval gates just because this tool exists.

## Integrations

The blessed integration path is local stdio MCP or CLI, because plaintext and
sender private keys need to stay on the sender machine.

Local MCP source exists in `packages/mcp` and exposes the intended stdio command:

```bash
npx -y @agent-notifier/mcp@latest --stdio
```

That package is not published yet. The source implementation exists locally, but
package records currently return E404 and Codex plugin installation through the
published MCP package is not verified.

Codex plugin marketplace root lives in:

```text
packages/codex-plugin
```

It can be added with:

```bash
codex plugin marketplace add packages/codex-plugin
```

The plugin bundle source lives in:

```text
packages/codex-plugin/plugins/agent-notifier
```

Claude, Claude Code, CI, and generic agents should use the same local MCP server
or CLI package once available. See [Integrations](docs/integrations.md) for
connector boundaries and examples.

## Cloudflare And Resend

The web app is designed for Cloudflare Workers:

- Worker entrypoint: `apps/web/worker/index.ts`
- Wrangler config: `apps/web/wrangler.jsonc`
- Worker name: `agent-notifier-web`
- Compatibility date: `2026-07-01`
- Live custom domain: `https://agent-notify.seufert.sh`
- Live workers.dev URL: `https://agent-notifier-web.seufert.workers.dev`
- Assets use single-page app fallback, with `/api/*` routed through the Worker.
- `wrangler.jsonc` declares the `DB` D1 binding for the `agent-notifier`
  database and an hourly retention cron at `17 * * * *`.
- `APP_PUBLIC_URL` is intentionally not configured; setup links derive their
  origin from the incoming Worker request.

Runtime values read by the Worker:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Do not commit secrets, private keys, API tokens, or private Cloudflare
credentials. Deployment notes live in [Deployment](docs/deployment.md); they
describe this repo's Cloudflare operation path, not a public self-hosting
feature.

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

`vp run -w check` runs typecheck, tests, the repository file-length check, and
package verification.

## Supply Chain

The target package posture is trusted publishing or OIDC, npm provenance, no
long-lived npm tokens, no install lifecycle scripts in published packages, and
small package contents allowlisted by manifest.

Current npm status: package publication and provenance are not verified. The
`@agent-notifier` npm org/scope exists as a free public-package org, but the
public package records still return E404. Protocol, crypto, CLI, and MCP have
publish-shaped manifests; emails and the Codex plugin package remain private.
Package CI and tag-driven publish workflows exist, with manual dispatch kept
for dry-run verification. Do not claim public package provenance until
GitHub/npm trusted publishing is configured and a real release succeeds.

The local package guard is:

```bash
node scripts/verify-packages.mjs
```

More package detail:

- [CLI and local MCP](docs/cli-mcp.md)
- [npm supply chain](docs/npm-supply-chain.md)

## License

MIT. See [LICENSE](LICENSE).

## Repository Map

- [Product spec](docs/product-spec.md): product, protocol, data, API, and
  roadmap source of truth.
- [Security](docs/security.md): threat model, metadata boundary, crypto posture,
  and reporting channel.
- [Privacy](docs/privacy.md): user-facing data and retention explanation.
- [Terms](docs/terms.md): concise service terms.
- [Deployment](docs/deployment.md): Cloudflare and Resend operator notes.
- [Integrations](docs/integrations.md): local CLI/MCP, Codex, Claude, CI, and
  connector boundaries.
- [API and delivery backend plan](docs/api-delivery-plan.md): backend lane
  details for D1, Drizzle, pairing, delivery, retention, email, and push.
- [UI product direction](docs/ui-product-direction.md): PWA, inbox, setup, and
  visual guidance.
