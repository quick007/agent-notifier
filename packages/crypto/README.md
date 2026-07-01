# @agent-notifier/crypto

Small WebCrypto-oriented helpers for Agent Notifier.

This package intentionally avoids custom cryptographic primitives. Protocol-level encryption and signing must use platform WebCrypto and reviewed wrappers.

Build before package verification or publishing:

```bash
vp run @agent-notifier/crypto#build
vp run @agent-notifier/crypto#pack:dry-run
```

The npm package publishes `dist` JavaScript and declarations, not raw TypeScript source. Do not add `prepare`, `prepack`, or install lifecycle scripts.
