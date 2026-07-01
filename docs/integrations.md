# Integrations

Agent Notifier should integrate with agents through local encryption boundaries. The normal path is local CLI or local stdio MCP, because the sender runtime must encrypt message content and sign requests before the hosted service sees them.

## Security Boundary

Safe connector rule:

- Plaintext notification content and sender private keys stay on the sender device.
- The Cloudflare service receives encrypted envelopes, public keys, signatures, routing metadata, queue state, and delivery state metadata.
- Duplicate suppression that depends on plaintext happens locally.
- A hosted "cloud connector" must not accept plaintext titles, bodies, replies, approval text, or sender private keys.

If a cloud connector cannot preserve those boundaries, it should not be built as a true hosted connector. The safe cloud shape is a local-encryption connector: a local CLI/MCP process performs setup, encryption, signing, duplicate suppression, and response decryption, while the hosted API stores and routes ciphertext.

## Codex

Codex should use the plugin in `packages/codex-plugin/agent-notifier`.
See [Codex Plugin](codex-plugin.md) for the plugin bundle and validation notes.
The current source package for the local MCP server is `packages/mcp`; it
implements stdio JSON-RPC tool handling locally. The published npm command below
is still the intended runtime shape until npm publication is completed.

For API details, prefer the typed integration surfaces first: local agents use
the MCP tools and `@agent-notifier/cli/client`, while live Worker transport
uses Hono's `hc` runtime through a package-local typed endpoint adapter. Use
`<worker-origin>/docs` for human-readable Scalar reference and
`<worker-origin>/openapi.json` for contract checks. Local development usually
serves those from `http://localhost:5173`.

The plugin bundle includes:

- A focused skill with notification, setup, approval, and sensitive-content policy.
- A plugin-provided stdio MCP server config in `.mcp.json`.
- No requirement for the user to hand-edit `config.toml` in the normal path.

Plugin-provided MCP command shape:

```bash
npx -y @agent-notifier/mcp@latest --stdio
```

Codex setup guidance:

1. Install the Agent Notifier plugin from the configured plugin marketplace.
2. Start a new Codex thread and ask to use Agent Notifier.
3. If unpaired, Codex recommends email pairing and asks before sending setup email unless setup was clearly delegated.
4. Pairing code remains the fallback.
5. Codex sends only meaningful alerts, reply requests, or approval requests.

Manual fallback for direct MCP setup after the MCP package is published:

```bash
codex mcp add agent-notifier -- npx -y @agent-notifier/mcp@latest --stdio
```

## Claude And Local MCP

Use the same local stdio MCP server. Current source lives in `packages/mcp`; the config below is the intended published-package shape:

```json
{
  "mcpServers": {
    "agent-notifier": {
      "command": "npx",
      "args": ["-y", "@agent-notifier/mcp@latest", "--stdio"]
    }
  }
}
```

For Claude Code, the equivalent command shape after package publication is:

```bash
claude mcp add agent-notifier -- npx -y @agent-notifier/mcp@latest --stdio
```

Agents should follow the MCP server instructions: no routine progress spam, no invented approval gates, ask before setup email unless delegated, and mark sensitive content conservatively.

## CI

CI should use the local CLI, not a remote connector with plaintext access. Current CLI source lives in `packages/cli`; the example below is the intended published-package shape:

```yaml
name: notify
on:
  workflow_dispatch:

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Notify result
        if: always()
        run: |
          npx -y @agent-notifier/cli@latest notify \
            --title "Release workflow finished" \
            --body "Status: ${{ job.status }}" \
            --non-sensitive \
            --wait-for accepted \
            --json
```

CI pairing should be done by a human-controlled setup step. Store only local sender private material or encrypted sender state in the CI secret store, never server-readable message content.

For hosted connector boundaries, see [Cloud Connector Boundary](cloud-connector.md).

When CI uses live API transport, set the Worker origin with
`AGENT_NOTIFIER_API_URL`. CI should call the CLI/client surface, not copied route
strings; use `<worker-origin>/docs` or `<worker-origin>/openapi.json` only to
inspect or check the generated API reference. CI must still use local CLI
encryption/signing and must not hand plaintext message content to a hosted
connector.

## Generic CLI

Implemented local CLI command shape:

```bash
agent-notifier setup
agent-notifier setup --email user@example.com
agent-notifier setup --code ABCD-1234
agent-notifier notify --title "Task complete" --body "The run finished." --wait-for delivered
agent-notifier reply --title "Need input" --body "Which option should I choose?" --wait
agent-notifier approve --title "Publish release?" --body "Approve publishing v1.2.3?" --wait
agent-notifier status msg_123
```

Use `--sensitive` for secrets, logs, security findings, private data, unreleased details, and any content that should not be shown in a phone preview. Use `--non-sensitive` only when the preview is safe.

Without a Worker API URL, CLI and MCP return `local_config` results for local
sender configuration only. With a configured Worker origin and paired sender,
live transport returns `http_api` results and still sends only signed encrypted
payloads. Do not present local-config results as delivered phone notifications.

## README Snippets

Short integration copy for the main README:

```md
## Integrations

Agent Notifier is designed for local CLI and local stdio MCP integrations so message content is encrypted before it reaches the hosted service.

- Codex: install the plugin from `packages/codex-plugin/agent-notifier`.
- Claude/local MCP: use the `packages/mcp` source package, eventually published as `@agent-notifier/mcp`.
- CI and generic agents: use the `packages/cli` source package, eventually published as `@agent-notifier/cli`.

See [Integrations](integrations.md) for setup details and cloud connector boundaries.
```
