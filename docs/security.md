# Security

This page describes Agent Notifier's security model, trust boundary, and
reporting channel.

## Promise

Agent Notifier is designed so the hosted service cannot read notification
titles, message bodies, replies, approval notes, or approval decisions.

The service temporarily stores encrypted envelopes so recipient devices can
receive them. The server does not need plaintext content to route, queue,
deliver, expire, or rate-limit messages.

## What The Server Can See

The server can see operational metadata needed to run the product:

| Category | Examples |
| --- | --- |
| Account metadata | Email addresses, recipient IDs, sender IDs, device IDs |
| Routing metadata | Sender-recipient relationships, queue state, delivery state |
| Timing metadata | Created, delivered, responded, expired, and last-seen times |
| Push metadata | Push subscription data and provider errors |
| Abuse controls | Rate-limit counters, pairing attempts, aggregate counters |

The server must not see readable message titles, bodies, sensitive flags,
reply text, approval text, or approval decision details. Those fields belong in
encrypted content.

## Local Encryption Boundary

Sender-side encryption happens in the local CLI or local stdio MCP server before
the hosted API receives a message. Sender private keys and plaintext content
must stay on the sender machine.

Device-side decryption happens in the PWA. Device private keys and decrypted
inbox history stay on the device. The local inbox is not a server-readable cloud
mailbox.

## Protocol Posture

The protocol is expected to use WebCrypto-compatible primitives:

- ECDH P-256 for key agreement.
- ECDSA P-256 with SHA-256 for signatures.
- AES-256-GCM for content encryption.
- HKDF-SHA-256 for key derivation.
- Deterministic canonical JSON for signed payloads.

The repository currently includes protocol and crypto package code for
canonicalization, signing domains, P-256 keys, AES-GCM helpers, HKDF helpers,
base64url encoding, hashing, envelope sealing, and signatures. It also includes
backend modules for encrypted envelope storage, pairing, response storage,
retention, Resend setup email, and Web Push wakeups, plus local CLI/MCP source.
Live encrypted code pairing, PWA inbox decrypt/store, delivered reporting, CLI
status polling, and CLI reply/approval response decryption are verified against
the deployed Worker. Real phone/browser Web Push permission and wakeup delivery
still need device verification.

## Approval Boundary

Agent Notifier does not execute actions. For approval requests, the service
returns signed human intent to the local sender. The local agent or surrounding
workflow remains responsible for its own approval policy and for deciding what
to do after approval, rejection, or expiry.

Agents must not create new approval gates just because Agent Notifier exists.

## Browser And PWA Risk

The PWA holds device private keys, so app-origin XSS is a security boundary.
The app should keep a strict Content Security Policy, avoid inline scripts, avoid
third-party marketing scripts on the app origin, and treat service worker and
IndexedDB code as security-sensitive.

The current Worker adds security headers, including CSP, `nosniff`,
`no-referrer`, and frame blocking. Those headers should be kept strict as the UI
and routes grow.

## Supply Chain

Published packages should use npm trusted publishing or OIDC, publish with
provenance, avoid long-lived npm tokens, avoid install lifecycle scripts, and
allowlist package contents.

This repository includes `scripts/verify-packages.mjs` to check publishable
packages for allowlisted files, banned install lifecycle hooks, external runtime
dependencies, declared entrypoints, and dry-run pack contents. Public package
provenance is not established yet.

## Report A Security Issue

Please report suspected vulnerabilities to `agent-notify@seufert.sh`.

Good reports include a concise description, affected component or route, impact,
reproduction steps, and whether any accounts, devices, or message envelopes may
be affected. Please avoid public issue reports for sensitive vulnerabilities
until we have had time to investigate and fix them.

In scope:

- Message encryption, signing, verification, and key handling.
- Pairing, sender/device authorization, revocation, and delivery APIs.
- PWA/service worker behavior that could expose private keys or decrypted data.
- Server handling of encrypted envelopes, metadata, retention, and rate limits.
- Package supply-chain or release issues affecting Agent Notifier packages.

We aim to acknowledge security reports within 3 business days and provide an
initial assessment or follow-up questions within 10 business days.
