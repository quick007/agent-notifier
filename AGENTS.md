# Agent Notifier

Agent Notifier is an encrypted notification and lightweight approval product for AI agents. It should feel like a polished product, not a dev preview.

## Core Direction

- Build for Cloudflare Workers.
- Use a Cloudflare Workers-native app/router layer. Prefer the repo's eventual scaffold and avoid substituting a heavy framework without a reason.
- Use Drizzle for data access. Avoid raw SQL in application code. Raw SQL is acceptable for generated or hand-reviewed migrations when Drizzle cannot express the DDL cleanly.
- Design D1 schemas as if Postgres may come later: app-generated IDs, portable timestamps, explicit ownership/scoping, and no SQLite-only tricks unless they are isolated.
- Use Vite+ commands for project work. Prefer `vp install`, `vp run <script>`, `vp exec <binary>`, and `vp dlx <package>` over direct package-manager commands.
- Vite+ built-ins such as `vp dev`, `vp build`, and `vp test` run Vite+ tools, not same-named package scripts. Use `vp run <script>` when you need a package script with a built-in name.
- Do not install wrapped tools such as Vitest, Oxlint, Oxfmt, or tsdown directly just to upgrade them; use the repo's Vite+ wrapper commands.

## Product Priorities

1. User trust: message content is end-to-end encrypted and the server cannot read it.
2. Low-friction setup: email pairing should be the recommended flow, with pairing codes as fallback.
3. Agent ergonomics: Codex, Claude, CI, and generic agents should get clean MCP/CLI primitives.
4. Mobile-first usefulness: phone notifications must show useful previews by default when the agent marks a message non-sensitive.
5. Product polish: setup, settings, revocation, failure states, and privacy copy are first-class.

## Non-Negotiables

- Do not make this a remote-control product.
- Do not add multi-turn chat.
- Do not store readable message content on the server.
- Do not use server-visible plaintext hashes for duplicate detection.
- Do not add self-hosting docs in the first implementation unless explicitly requested.

Read [docs/product-spec.md](docs/product-spec.md) before making product or architecture decisions.
