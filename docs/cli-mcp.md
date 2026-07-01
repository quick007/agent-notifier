# CLI and Local MCP

Status: local runtime with live Worker setup/status, encrypted send support,
and encrypted response fetch/decryption for responded messages. The Worker API
contract belongs to Hono/OpenAPIHono routes, with the Hono-derived OpenAPI
document at `/openapi.json` and Scalar docs at `/docs`. CLI/MCP can call live
pairing endpoints when an API URL is configured, fetch sender-authorized target
device keys, encrypt locally, and submit only signed encrypted envelopes.

## CLI Commands

All commands print a single JSON object. Results use `"transport":
`"local_config"` and `serverAccepted: false` when no Worker API URL is
configured or when `--local-only` / `AGENT_NOTIFIER_TRANSPORT=local` is set.
Local-config mode can create sender config and key material, but it does not
pretend to deliver notifications or store plaintext message records.

```bash
agent-notifier setup
agent-notifier setup email --email user@example.com --api-url https://example.com
agent-notifier setup code --code ABCD-1234 --secret SECRET --api-url https://example.com
agent-notifier notify --title "Done" --body "The task finished." --non-sensitive
agent-notifier reply --title "Need input" --body "Which option?" --prompt "A or B?"
agent-notifier approve --title "Publish?" --body "Approve release?" --action-label "Publish"
agent-notifier status msg_local_...
agent-notifier senders list
agent-notifier senders revoke snd_local_...
```

Flags:

- `--sensitive` / `--non-sensitive`; default is sensitive.
- `--wait` or `--wait-for accepted|delivered|responded|expired`.
- `--expires-in 30m`, `--timeout 30s`, `--idempotency-key KEY`.
- `--sender-name NAME`, `--sender-kind codex|claude|ci|generic`.
- `--api-url URL` or `AGENT_NOTIFIER_API_URL` for live Worker setup/status.
- `--local-only` for local configuration/key state only; it does not deliver
  notifications.

Local state is stored at `AGENT_NOTIFIER_STATE_FILE` when set, otherwise under
the user's home directory at `.agent-notifier/state.json`. The file fallback
stores sender private key material with strict permissions where the platform
supports it and returns a warning because OS keychain storage is not wired yet.

## MCP Server

The local server is `agent-notifier-mcp` and speaks JSON-RPC over stdio. It
implements MCP `initialize`, `tools/list`, and `tools/call`.

Tools:

- `setup_notifier`: optional `email`, `code`, `senderName`, `senderKind`.
- `send_notification`: required `title`, `body`; optional `sensitive`,
  `senderName`, `idempotencyKey`.
- `request_reply`: required `title`, `body`; optional `prompt`, `sensitive`,
  `senderName`, `idempotencyKey`.
- `request_approval`: required `title`, `body`; optional `actionLabel`, `risk`,
  `sensitive`, `senderName`, `idempotencyKey`.
- `get_message_status`: required `messageId`.
- `wait_for_message_state`: required `messageId`, `state`; optional
  `timeoutMs`, `intervalMs`.
- `list_senders`: no arguments.
- `explain_usage_policy`: no arguments.

These are local tool-input schemas, not copies of the Worker API schemas. They
convert into the typed CLI client surface. The Worker API contract remains the
Hono/OpenAPIHono app contract. The CLI uses Hono's `hc` runtime through a
package-local typed adapter for the sender endpoints it consumes. It does not
import `@agent-notifier/web` at runtime or in published declarations, because
that private app export pulls Worker services, D1 code, and Worker globals into
CLI compilation. A future shared generated contract package can replace the
adapter once it is publish-safe.

Smoke test:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}',
'{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' |
  node packages\mcp\dist\index.js
```

## Usage Policy

Agents must use notifications sparingly:

- Use only for meaningful notifications, user-requested alerts, blocked work,
  or approvals already required by the task.
- Do not send routine progress spam unless the user asked for it.
- Do not invent approval gates because this tool exists.
- Ask before sending setup email unless setup was clearly delegated.
- Mark messages sensitive for secrets, credentials, tokens, private personal
  data, unreleased details, or logs likely to contain credentials.

## Trust Boundary

The blessed path is local CLI or local stdio MCP. Plaintext notification
content, sender private keys, duplicate suppression, request signing, and
response decryption belong on the sender machine. The hosted API should receive
only signed requests, routing metadata, encrypted envelopes, key wraps, and
delivery metadata.

Live setup consumes `/api/pairing/email/start` and `/api/pairing/code/claim`.
`status pair_...` can persist server-assigned `senderId` and `recipientId`.
Live notify/reply/approval signs `/api/senders/targets`, builds E2EE key wraps
for every active device, signs the canonical envelope, and posts
`/api/senders/messages`. When status or wait polling sees `responded`, the
runtime fetches `/api/senders/messages/:messageId/response`, verifies the
device signature, decrypts the reply or approval with the local sender
encryption key, and returns `responseRef` plus the decrypted `response` JSON.
If the response endpoint is not fetchable or decryptable yet, the status still
returns `responded` with a warning.
