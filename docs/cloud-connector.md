# Cloud Connector Boundary

Status: no true hosted cloud connector is approved for message send/reply/approval flows. The current supported equivalent is local CLI or local stdio MCP plus the Cloudflare API.

## Allowed Hosted Scope

A hosted connector may be considered only for setup, status, or admin surfaces that do not require plaintext message content or sender private keys. Examples:

- Pairing session status using public identifiers.
- Sender/device status and revocation metadata.
- Documentation or setup guidance.
- Aggregate service health that does not expose message content.

Email pairing still requires local sender key generation. Codex must ask before sending setup email unless the user clearly delegated setup.

## Disallowed Hosted Scope

A hosted connector must not receive or store:

- Sender encryption or signing private keys.
- Plaintext titles, bodies, reply text, approval text, or approval decisions.
- Server-visible plaintext hashes or duplicate-detection fingerprints.
- Logs, diffs, or stack traces that the agent has not encrypted locally.

It also must not execute user actions. Agent Notifier returns signed human intent; the local agent applies its own approval policy afterward.

## Secure Future Shape

A future cloud connector is acceptable only if it preserves local encryption. The safe model is:

1. Local CLI/MCP performs setup, encryption, signing, duplicate suppression, and response decryption.
2. Cloudflare stores and routes encrypted envelopes plus public metadata.
3. Hosted connector surfaces only setup/status/admin operations, or relays ciphertext it cannot decrypt.

If that model is unavailable, keep Codex, Claude, CI, and generic agents on local CLI/MCP.

## API Reference

Connector authors should not copy route tables or request schemas into connector
docs. Prefer the typed client surfaces:

- Local agent integrations should use CLI/MCP, backed by
  `@agent-notifier/cli/client`.
- Live Worker transport uses Hono's `hc` runtime through the CLI's
  package-local typed endpoint adapter.
- `<worker-origin>/docs` is the Hono-generated Scalar API reference for human review.
- `<worker-origin>/openapi.json` is a generated snapshot for contract checks.
- `<worker-origin>/api/docs` redirects to `/docs`.

These docs describe the Cloudflare routing and metadata contract. They do not
change the connector boundary: any hosted connector must operate on public
metadata, setup/status/admin data, or ciphertext it cannot decrypt. Message
content encryption, request signing, local duplicate suppression, and response
decryption stay in local CLI/MCP.

## Open Risks

- Published npm install of the MCP package is not yet validated because the
  package has not had its first trusted-publishing release.
- Plugin marketplace wiring is present at
  `packages/codex-plugin/.agents/plugins/marketplace.json`, but the
  end-to-end plugin launch path still depends on the unverified published MCP
  package.
- Any future connector UX must avoid implying remote control, multi-turn chat, or a cloud-readable inbox.
