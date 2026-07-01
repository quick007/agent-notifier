# @agent-notifier/protocol

Shared wire types, canonical JSON helpers, and validation utilities for Agent Notifier.

This package must stay dependency-light because CLI, local MCP, browser, and Worker code all rely on the same signed payload shapes.

Build before package verification or publishing:

```bash
pnpm --filter @agent-notifier/protocol build
pnpm --filter @agent-notifier/protocol pack:dry-run
```

The npm package publishes `dist` JavaScript and declarations, not raw TypeScript source. Do not add `prepare`, `prepack`, or install lifecycle scripts.
