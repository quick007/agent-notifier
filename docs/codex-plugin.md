# Codex Plugin

Status: plugin bundle scaffolded with supported repo-local marketplace wiring;
`packages/mcp` exposes an implemented local stdio MCP server with Agent
Notifier tools. Live CLI/browser E2EE transport has been verified against the
deployed Worker, but the published `@agent-notifier/mcp` package and end-to-end
plugin launch path are not verified yet.

## Bundle

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

The repo-local marketplace file is:

```text
packages/codex-plugin/.agents/plugins/marketplace.json
```

It exposes the existing plugin bundle through a local source path of
`./plugins/agent-notifier`. Do not duplicate the plugin bundle for marketplace
installation.

It contains:

- `.codex-plugin/plugin.json`: Codex plugin metadata, skill registration, and MCP pointer.
- `.mcp.json`: plugin-provided local stdio MCP server configuration.
- `skills/agent-notifier/SKILL.md`: usage policy for notifications, replies, approvals, setup, and sensitive content.

Codex plugin docs say plugins can bundle skills and MCP servers, and plugin-provided MCP servers are launched from the plugin while user config controls enablement and tool policy. The normal install path should therefore avoid manual `config.toml` edits.

## Local MCP Command

The current plugin MCP command uses the published-package shape:

```bash
npx -y @agent-notifier/mcp@latest --stdio
```

Until the MCP package is published, this command is a wiring contract with the
CLI/MCP lane, not a validated npm install path. The local MCP implementation
currently delegates to the CLI client. Without an API URL it returns
`local_config` results and does not simulate remote notification delivery; with
a paired sender it uses the live API/E2EE transport. Do not reimplement MCP behavior in
`packages/codex-plugin`; consume the `packages/mcp` entrypoint.

Do not replace this with a hosted plaintext connector. Sender private keys, plaintext notification content, duplicate suppression, signing, and response decryption belong in the local MCP or CLI runtime.

## API Reference

When a Worker origin is available, point Codex users and implementers to the
generated API reference:

- Human-readable Scalar docs: `<worker-origin>/docs`
- Machine-readable OpenAPI snapshot: `<worker-origin>/openapi.json`
- Legacy docs redirect: `<worker-origin>/api/docs`

For local development, the typical origin is `http://localhost:5173`. Treat
these endpoints as generated references from the backend API surface, not as
schemas to copy into plugin docs or tool code. Codex plugin code should call the
local MCP server, which consumes the typed `@agent-notifier/cli/client` surface.
The CLI live transport uses Hono's `hc` runtime through a package-local typed
adapter so the published package avoids private Worker imports.

Do not use API docs as permission to send plaintext titles, bodies, replies,
approval text, sensitivity flags, or sender private keys to any hosted
connector. The local CLI/MCP runtime still performs encryption and signing.

## Skill Policy

The bundled skill must stay concise and must tell Codex to:

- Use Agent Notifier only for meaningful notifications, user-requested alerts, blocks, and required approvals.
- Avoid routine progress updates unless the user asked for them.
- Never invent approval gates just because notification tools exist.
- Ask before sending setup email unless setup was clearly delegated.
- Mark sensitive content conservatively.

## Validation

Use the system plugin validator against the plugin root:

```bash
python C:\Users\luseu\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py packages\codex-plugin\plugins\agent-notifier
```

Use the system skill validator against the bundled skill:

```bash
python C:\Users\luseu\.codex\skills\.system\skill-creator\scripts\quick_validate.py packages\codex-plugin\plugins\agent-notifier\skills\agent-notifier
```
