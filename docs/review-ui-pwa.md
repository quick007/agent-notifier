# UI/PWA Visual QA Review

Date: 2026-07-01

## Scope

- Reviewed visible app/PWA routes in `apps/web/src`, `apps/web/public`, and the current Worker-served `/docs` Scalar API reference.
- Checked setup, pairing demo path, inbox, approval detail, legal/settings surfaces, PWA manifest/service worker files, and Hono `/docs` + `/openapi.json`.
- Inspected frontend API usage for direct backend calls or duplicated API contracts.

## Visual QA Results

- Fresh device opens to setup, not a marketing page.
- Pairing demo path reaches the local inbox.
- Inbox, approval detail, and Scalar docs render on mobile `390x844` and desktop `1280x800` without horizontal overflow.
- Sensitive demo message shows `Hidden preview`; privacy copy avoids "no data" and discloses delivery metadata.
- Hono Scalar docs render visibly on desktop and mobile and point at `/openapi.json`.
- Screenshots and metrics were captured under `.codex-screenshots/ui-pwa-qa-20260701-current/`.

## API Usage Review

- The React/PWA client currently does not call backend `/api/*` routes.
- No typed Hono client is needed yet for frontend code.
- Current backend exposes `AppType` from `apps/web/src/server/router.ts`; use that for a typed Hono client or small typed adapter when the PWA starts calling backend APIs.
- Client-side hash route strings remain for app navigation; these are not backend API calls.

## Findings

- P2: Scalar docs mobile controls include some 32px third-party buttons. The page is usable and has no overflow, but this is below the app shell's preferred touch target size.
- P3: `pnpm check:file-length` currently fails on `packages/cli/src/client.ts` at 304 lines. This is outside the reviewed UI/PWA files.

## Checks

- `pnpm --filter @agent-notifier/web typecheck` passed.
- `pnpm --filter @agent-notifier/web test` passed, 3 files and 11 tests.
- `pnpm check:file-length` failed only on `packages/cli/src/client.ts:304`.
