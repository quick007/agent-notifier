# Security/API Review

Date: 2026-06-30

Scope: server/API/D1/Resend/Web Push/protocol boundaries, with the course correction focused on Hono/OpenAPI drift, duplicated contracts, plaintext acceptance, signed auth, and docs posture.

## Findings

### P1 - Remaining: Rate limits are modeled but not enforced

The product spec requires server-side metadata rate limits for sender, recipient, IP/install fingerprint, email pairing, and pairing-code claim flows (`docs/product-spec.md:641`). The schema has `rateLimitBuckets` (`apps/web/src/db/schema.ts:158`) and pairing sessions track `attemptCount` (`apps/web/src/db/schema.ts:82`), but current service code only increments `attemptCount` after a matching code claim (`apps/web/src/server/services/pairing-service.ts:96`) and no API route calls a rate-limit helper before email start, code start/claim, or sender message creation.

Impact: online pairing-code guessing, setup email abuse, and sender spam are not bounded by the server yet.

Recommendation: add a small Drizzle-backed metadata rate-limit helper and apply it in Hono middleware/service entry points before expensive side effects.

### P1 - Fixed: Hono validation could accept plaintext unknown fields

Hono/Zod validation can strip unknown object keys. Without a pre-validation guard, a request containing `title`, `body`, `reply`, `approvalText`, `duplicateHash`, etc. could be accepted even if not persisted.

Fix: `plaintextJsonGuard` now parses JSON mutation bodies and calls `rejectPlaintextContent` before route validation (`apps/web/src/server/hono.ts:48`, `apps/web/src/server/router.ts:15`). Regression coverage rejects plaintext before Hono can strip unknown keys (`apps/web/worker/index.test.ts:106`).

### P1 - Fixed: Hono message intake preserves signed metadata `createdAt`

`metadata.createdAt` is part of the sender-visible metadata signed/AAD boundary. The Hono schema requires it and `toMessageSubmission` copies it through to the service input (`apps/web/src/server/schemas.ts:102`, `apps/web/src/server/schemas.ts:251`), and `createMessage` stores `input.createdAt` instead of minting a server timestamp for the envelope (`apps/web/src/server/services/message-service.ts:40`).

Regression coverage now requires and preserves the sender-provided timestamp (`apps/web/src/server/schemas.test.ts:6`).

### P1 - Fixed: Public device registration could bind to an existing recipient without proof

The public device registration contract previously allowed a caller-provided `recipientId`, which risked unauthenticated attachment to an existing recipient boundary.

Fix: caller-provided `recipientId` is only accepted with `pairingSessionId` and `pairingSecret` (`apps/web/src/server/schemas.ts:68`), and `registerDevice` verifies the session belongs to that recipient and matches the stored magic-link secret before inserting the device (`apps/web/src/server/services/device-service.ts:18`, `apps/web/src/server/services/device-service.ts:43`). Regression coverage rejects existing-recipient binding without pairing proof (`apps/web/worker/index.test.ts:119`).

### P2 - Fixed: Generated OpenAPI did not document signed auth

Authenticated Hono routes enforced sender/device signatures, but the generated OpenAPI contract did not advertise the security schemes or per-route security requirements.

Fix: Hono now registers sender/device signed-request security schemes (`apps/web/src/server/hono.ts:27`) and applies route security metadata (`apps/web/src/server/routes/senders.ts:38`, `apps/web/src/server/routes/devices.ts:53`, `apps/web/src/server/routes/pairing.ts:67`). Regression coverage asserts the generated document includes the schemes and secured routes (`apps/web/worker/index.test.ts:65`).

### P2 - Fixed: Signed auth header names were duplicated outside protocol

The request-signing header names are part of the protocol boundary. The current tree now exposes `SIGNED_REQUEST_HEADERS` from `@agent-notifier/protocol` (`packages/protocol/src/request-signing.ts:8`) and uses it in server auth, generated OpenAPI security schemes, CLI signed fetch, and tests (`apps/web/src/server/auth.ts:25`, `apps/web/src/server/hono.ts:30`, `packages/cli/src/transport.ts:54`).

### P2 - Fixed: Local duplicated protocol types remained in the web app

The web DB schema imported local protocol aliases instead of the shared protocol package. That left one duplicated schema/type island.

Fix: `apps/web/src/db/schema.ts:3` now imports `DeliveryState`, `MessageMode`, `ResponseKind`, and `SenderKind` from `@agent-notifier/protocol`; the local `apps/web/src/server/protocol-types.ts` file was removed. The Hono schemas already import protocol tuple constants (`apps/web/src/server/schemas.ts:2`).

## Docs And API Contract Posture

- `/openapi.json` is generated from the Hono/OpenAPIHono app contract (`apps/web/src/server/router.ts:17`), not a detached hand-written route inventory.
- `/docs` uses the Hono Scalar integration against `/openapi.json` with an exact-pinned Scalar browser script, nonce CSP, disabled Scalar agent, and hidden test request button (`apps/web/src/server/router.ts:10`, `apps/web/src/server/router.ts:60`, `apps/web/src/server/router.ts:70`).
- The stale `/docs/scalar-frame` test reference was removed; docs route parsing now treats `/docs`, `/api/docs`, and `/openapi.json` as non-app routes (`apps/web/src/lib/routes.test.ts:32`).
- Reviewed docs/search hits did not find docs implying server-readable plaintext content, plaintext duplicate hashes, remote control, or multi-turn chat as allowed behavior.

## Changes Made

- Added `plaintextJsonGuard` and wired it before `/api/*` Hono validation.
- Preserved sender-signed/AAD `metadata.createdAt` through Hono validation and message persistence.
- Moved signed request header names into `@agent-notifier/protocol` and reused them from server/OpenAPI/CLI paths.
- Added generated OpenAPI signed-request security schemes and route security metadata.
- Required pairing proof before public device registration can bind a device to an existing email-scoped recipient.
- Folded the remaining web protocol type aliases into `@agent-notifier/protocol`.
- Updated regression tests for generated auth docs, plaintext rejection, public device registration scoping, typed Hono client export, and stale docs route handling.
- Updated `docs/cloud-connector.md` wording from the old sandboxed-frame docs implementation to the current Hono-generated Scalar docs.

## Checks

- `pnpm --filter @agent-notifier/protocol test` - pass, 10 tests
- `pnpm --filter @agent-notifier/web typecheck` - pass
- `pnpm --filter @agent-notifier/web test` - pass, 4 files / 16 tests
- `pnpm --filter @agent-notifier/cli typecheck` - pass
- `pnpm --filter @agent-notifier/cli test` - pass, 2 files / 5 tests
- `pnpm check:file-length` - pass
- `pnpm check:packages` - pass
- `pnpm typecheck` - pass
- `pnpm test` - pass
- `pnpm build` - pass
- `pnpm check` - pass
