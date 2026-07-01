# @agent-notifier/mcp

Local stdio MCP server for Agent Notifier.

This server is intentionally local so sender-side encryption, signing, setup state, and duplicate suppression can stay on the user's machine.

## API Reference

When live API transport is enabled, set `AGENT_NOTIFIER_API_URL` to the Worker
origin. The Worker serves:

- `<worker-origin>/docs` for human-readable API reference.
- `<worker-origin>/openapi.json` for generated-reference and contract checks.

The MCP server consumes the CLI/client transport and the shared protocol and
crypto packages. The CLI live path uses Hono's `hc` runtime through a
package-local typed endpoint adapter rather than copying API routes into MCP
tools. Do not move plaintext message content, sender private keys, encryption,
signing, duplicate suppression, or response decryption into a hosted connector.
