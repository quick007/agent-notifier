# Agent Notifier Codex Plugin

This package contains the Codex plugin bundle source for Agent Notifier.

The marketplace root is:

```text
packages/codex-plugin
```

Add it to Codex with:

```bash
codex plugin marketplace add packages/codex-plugin
```

The installable plugin bundle source is:

```text
packages/codex-plugin/plugins/agent-notifier
```

Repo-local marketplace wiring lives at:

```text
packages/codex-plugin/.agents/plugins/marketplace.json
```

The marketplace entry points at the existing bundle with source path
`./plugins/agent-notifier`. Do not duplicate the plugin bundle for marketplace
installation.

The bundle includes:

- `.codex-plugin/plugin.json` for Codex plugin metadata.
- `.mcp.json` for the plugin-provided local stdio MCP server.
- `skills/agent-notifier/SKILL.md` for Codex usage policy and setup guidance.

## Local MCP Shape

The plugin starts the MCP server through the published package command:

```bash
npx -y @agent-notifier/mcp@latest --stdio
```

That command is intentionally local. Sender private keys and plaintext message content must stay on the sender machine so the MCP server can encrypt and sign before calling the Cloudflare API.

The current MCP source package is `packages/mcp`; this plugin consumes the
published MCP entrypoint rather than reimplementing MCP behavior.

The hosted service should only receive encrypted envelopes, public keys, signatures, routing metadata, and delivery state metadata.

See `docs/codex-plugin.md` and `docs/cloud-connector.md` for the Codex install path and hosted connector boundary.

## API Reference

When the Worker is running, API reference docs are served from the Worker origin:

- `<worker-origin>/docs`
- `<worker-origin>/openapi.json`

Use those endpoints to inspect the generated backend reference. Plugin and MCP
code should consume the local MCP tools and `@agent-notifier/cli/client`; do not
copy API schemas or route strings into the plugin bundle. The API reference does
not change the trust boundary:
this plugin must keep plaintext content and sender private keys in local CLI/MCP
code.

## Development Notes

- Keep the plugin root folder name and `plugin.json` name aligned as `agent-notifier`.
- Keep `.agents/plugins/marketplace.json` pointing at
  `./plugins/agent-notifier`.
- Do not add a remote MCP connector that receives plaintext message content or sender private keys.
- If a future cloud connector is added, it must orchestrate local encryption or operate only on ciphertext and public metadata.
