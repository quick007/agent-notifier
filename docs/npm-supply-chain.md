# npm Supply Chain

Agent Notifier packages are part of the product trust boundary. CLI and MCP run
on developer machines and will eventually hold plaintext and sender private
material locally, so publishing must be tokenless, reproducible, and narrow.

## Required Posture

- Stage releases with npm trusted publishing from GitHub Actions OIDC.
- Stage with provenance enabled, then require maintainer approval before the
  package becomes public.
- Do not use long-lived `NPM_TOKEN` secrets for package publish.
- Require npm account 2FA, disallow token publishing for public packages, and
  use least-privilege package/org ownership.
- Use package `files` allowlists; publish `dist`, `README.md`, and
  `package.json` only for runtime packages.
- Build before every pack check and publish because `dist` is generated and
  ignored by git.
- Do not add `preinstall`, `install`, `postinstall`, `prepare`, `prepack`,
  `postpack`, `prepublish`, `prepublishOnly`, `publish`, or `postpublish`
  lifecycle scripts to published packages.
- Run `vp run -w check:packages` so package builds use Vite+ and pack
  verification still matches the release tarball path and workspace dependency
  rewrite.
- Keep runtime dependencies zero or near-zero; document every external runtime
  dependency before adding it. The CLI currently uses `hono` only for its
  typed `hc` client proxy; encryption/signing still comes from local workspace
  packages.

## pnpm Workspace Rules

Local package edges use `workspace:*` so validation never fetches unpublished
workspace packages from npm. `pnpm pack` rewrites workspace dependencies in the
tarball manifest, so coordinated same-version package publishing is required.
For example, `@agent-notifier/mcp` depends on `@agent-notifier/cli`.

Publish order:

1. Build protocol and crypto.
2. Build CLI.
3. Build MCP.
4. Verify packed contents.
5. Stage all public packages in one release batch, then approve staged packages
   only after review.

The initial public package version is `0.1.0` across `@agent-notifier/protocol`,
`@agent-notifier/crypto`, `@agent-notifier/cli`, and `@agent-notifier/mcp`.
Every public package manifest and the root manifest must carry the same release
version before staging. Release tags use the matching `v0.x.x` form. A pushed
`v*.*.*` tag triggers the npm staging workflow; manual dispatch remains
available for dry-run verification.

## Release Labels

Merged pull requests to `main` may also drive npm staging when they have exactly
one release label:

| Label           | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `release:none`  | Merge without staging npm packages. Use for docs, tests, and CI-only work. |
| `release:patch` | Stage the manifest version as a patch release. Use for fixes and polish. |
| `release:minor` | Stage the manifest version as a minor release. Use for new capabilities. |
| `release:major` | Stage the manifest version as a major release. Use for breaking changes. |

The PR label authorizes staging; CI does not bump package manifests. For a PR
release, update the root and public package manifest versions in the merged
commit before applying a non-`none` release label. The resolver fails if a
merged PR has zero or multiple release labels, if public package versions drift,
or if a tag does not match the manifest version.

Public package manifests use `https://github.com/quick007/agent-notifier` for
repository, homepage, and issue tracker metadata.

Current npm status: the `@agent-notifier` organization/scope was created
successfully as a free public-package org, but `@agent-notifier/protocol`,
`@agent-notifier/crypto`, `@agent-notifier/cli`, and `@agent-notifier/mcp`
still return E404. Package bootstrap and trusted publisher setup are blocked on
user-present npm two-factor security-key/password verification.

The release workflow installs and checks through Vite+, then packs with
`vp pm pack` and stages the generated tarballs with `npm stage publish`. This
keeps pnpm's workspace dependency rewrite while using npm CLI OIDC and
provenance support for registry staging. The tag path and merged-PR path both
stage through the protected `npm-publish` GitHub Environment. The manual
workflow dispatch path builds, checks, packs, and runs `npm publish --dry-run`
only; it does not receive OIDC permissions.

The build/pack job does not receive OIDC. Only the staging job has
`id-token: write`, downloads already-built tarballs, and runs
`npm stage publish`.
Both jobs install `npm@11.18.0` before publish-related commands because staged
publishing requires npm 11.15.0 or newer.
Normal pushes to `main` remain CI-only through `package-ci.yml`; the npm publish
workflow listens only for release tags, merged pull request close events, and
manual dry-run dispatches. For merged pull requests, the workflow checks out the
trusted merged commit on `main`, not the PR head.

The PR staging path intentionally does not create a GitHub tag or GitHub
Release. Staged packages are still pending maintainer approval in npm, and the
existing `v*.*.*` tag path remains the deliberate way to create a permanent
source marker for a package version after maintainers decide to use one.

Staged publishing cannot create a brand-new npm package record. Before the first
`v0.1.0` tag is pushed, each public package must already exist under the final
scope and have trusted publishing configured. If npm cannot pre-create the
package records through account settings, the bootstrap release needs a
maintainer-approved one-time direct publish path; after that, switch trusted
publisher permissions to stage-only and disallow traditional tokens.

GitHub Actions are intentionally not SHA-pinned for the initial `0.x` release
lane while the workflow is still changing. The deliberate exception is limited
to maintained first-party GitHub actions and `voidzero-dev/setup-vp` floating at
major versions. Review workflow diffs before tagging, and pin by SHA before a
broader public or 1.0 release.

## Build Script Approval

pnpm 11 blocks dependency lifecycle scripts unless reviewed. Repo tooling may
need native build artifacts, but published Agent Notifier packages must not add
their own lifecycle hooks.

Workspace installs quarantine newly published dependency versions for 24 hours
with `minimumReleaseAge: 1440`; exclusions are version-pinned and should stay
narrow.

Current reviewed dev-tool exceptions live in `pnpm-workspace.yaml`:

- `esbuild`: Vite and TypeScript tooling.
- `sharp`: Miniflare/Workers image/runtime dependency path.
- `workerd`: Cloudflare Workers local runtime.

Any new `allowBuilds` entry must include a short rationale and lockfile review.
Do not broaden this policy to arbitrary dependency scripts.

## Hono Contract Dependencies

The Worker API can use Hono/OpenAPIHono for contract-first routing. Keep these
dependencies exact-pinned in `apps/web/package.json` and reviewed in the
lockfile:

- `hono@4.12.27`
- `@hono/zod-openapi@1.4.0`
- `zod@4.4.3`
- `@scalar/hono-api-reference@0.11.6`

`@scalar/hono-api-reference` is the allowed Scalar integration for Hono routes.
Its renderer uses `@scalar/api-reference` in the browser, so configure an
exact-pinned CDN URL or a self-hosted bundle; never use Scalar's unversioned
default CDN URL. The current Worker docs route pins the browser renderer to
`@scalar/api-reference@1.62.1`.

As of this review, `@scalar/hono-api-reference@0.11.7` is the latest npm
release, but it and its `@scalar/client-side-rendering@0.3.0` transitive
dependency are newer than the workspace 24-hour release-age policy. Wait for
the quarantine to expire rather than adding a broad exception.

Published packages must not depend on private `@agent-notifier/web` exports.
The CLI uses Hono's `hc` runtime with a package-local typed endpoint adapter so
the published package does not import Worker services, D1 code, or Worker
globals. Move Hono route contracts into a publish-safe generated package before
replacing that adapter with a shared `AppType`.

## Attack Patterns Covered

Recent npm incidents show recurring patterns:

- Maintainer phishing and account takeover.
- Compromised publish tokens.
- Malicious install scripts that exfiltrate secrets from developer machines or
  CI.
- Typosquatting and dependency confusion.
- Malicious dependency updates in trusted-looking transitive packages.
- CI secret exfiltration through unsafe pull request workflows.

Mitigations in this repo:

- Trusted publishing/OIDC removes stored publish tokens.
- Staged publishing requires maintainer approval with 2FA before staged
  packages become publicly available.
- Provenance ties packages to the release workflow.
- `pull_request_target` must not run untrusted code.
- Frozen installs and lockfile review reduce dependency confusion risk.
- `files` allowlists and pack dry-runs keep secrets/tests/source clutter out of
  tarballs.
- No lifecycle scripts in published packages removes install-time execution
  from Agent Notifier packages.

## Coordinator Setup Tasks

- Bootstrap the individual npm packages under the existing `@agent-notifier`
  scope and enable trusted publishing for
  `https://github.com/quick007/agent-notifier`,
  `.github/workflows/npm-publish.yml`, and the `npm-publish` environment. This
  requires user-present npm 2FA security-key/password verification. Configure
  the trusted publisher allowed action as `npm stage publish` only, not direct
  `npm publish`.
- Confirm the package records already exist before relying on staged publishing.
  Npm does not allow `npm stage publish` to create brand-new packages.
- Protect the GitHub `npm-publish` environment with required reviewers.
- Restrict npm package publishing access to require 2FA and disallow tokens.
- Confirm package names, scope ownership, 2FA policy, and first public version.
- Confirm repository, homepage, and bugs URLs in public package manifests before
  pushing `v0.1.0`.
- After the tag or merged-PR workflow stages packages, review and approve each
  staged package through npmjs.com or `npm stage approve` using maintainer 2FA.
- Decide whether the documented SHA-pinning exception is acceptable for the
  first `0.x` tag.

## References

- npm trusted publishing and OIDC:
  https://docs.npmjs.com/trusted-publishers/
- npm provenance:
  https://docs.npmjs.com/generating-provenance-statements/
- npm staged publishing:
  https://docs.npmjs.com/staged-publishing/
- npm stage CLI:
  https://docs.npmjs.com/cli/v11/commands/npm-stage/
- pnpm publish and pack behavior:
  https://pnpm.io/cli/publish
- pnpm approved build scripts:
  https://pnpm.io/cli/approve-builds
- GitHub Actions secure use:
  https://docs.github.com/en/actions/reference/security/secure-use
- Nx s1ngularity postmortem:
  https://nx.dev/blog/s1ngularity-postmortem
- npm debug/chalk compromise writeup:
  https://www.aikido.dev/blog/npm-debug-and-chalk-packages-compromised
- Shai-Hulud analysis:
  https://securitylabs.datadoghq.com/articles/shai-hulud-2.0-npm-worm/
