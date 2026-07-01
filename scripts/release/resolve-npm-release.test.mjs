import assert from "node:assert/strict";
import test from "node:test";

import {
  publicPackageManifestPaths,
  releaseTypeFromLabels,
  resolveNpmRelease,
  validateReleaseManifestVersions
} from "./resolve-npm-release.mjs";

test("requires exactly one release label", () => {
  assert.equal(releaseTypeFromLabels([{ name: "release:patch" }]), "patch");
  assert.equal(releaseTypeFromLabels(["release:minor"]), "minor");
  assert.throws(
    () => releaseTypeFromLabels([]),
    /Pull requests must have exactly one release label/u
  );
  assert.throws(
    () => releaseTypeFromLabels([{ name: "release:patch" }, { name: "release:minor" }]),
    /Found: release:patch, release:minor/u
  );
});

test("merged release pull request uses the manifest version", () => {
  const release = resolveNpmRelease({
    event: pullRequestEvent({ action: "closed", label: "release:patch", merged: true }),
    eventName: "pull_request",
    manifests: manifestsWithVersion("1.2.3")
  });

  assert.equal(release.release_enabled, "true");
  assert.equal(release.release_type, "patch");
  assert.equal(release.version, "1.2.3");
  assert.equal(release.tag, "v1.2.3");
});

test("merged release:none pull request does not stage packages", () => {
  const release = resolveNpmRelease({
    event: pullRequestEvent({ action: "closed", label: "release:none", merged: true }),
    eventName: "pull_request",
    manifests: manifestsWithVersion("1.2.3")
  });

  assert.equal(release.release_enabled, "false");
  assert.equal(release.release_type, "none");
  assert.equal(release.version, "0.0.0");
});

test("non-merged pull request event stays disabled but validates labels", () => {
  const release = resolveNpmRelease({
    event: pullRequestEvent({ action: "closed", label: "release:minor", merged: false }),
    eventName: "pull_request",
    manifests: manifestsWithVersion("1.2.3")
  });

  assert.equal(release.release_enabled, "false");
  assert.equal(release.release_type, "minor");
});

test("tag push releases only when tag matches the manifest version", () => {
  const release = resolveNpmRelease({
    eventName: "push",
    manifests: manifestsWithVersion("1.2.3"),
    refName: "v1.2.3",
    refType: "tag"
  });

  assert.equal(release.release_enabled, "true");
  assert.equal(release.release_type, "tag");
  assert.equal(release.version, "1.2.3");
});

test("tag push rejects package version drift", () => {
  assert.throws(
    () =>
      resolveNpmRelease({
        eventName: "push",
        manifests: manifestsWithVersion("1.2.4"),
        refName: "v1.2.3",
        refType: "tag"
      }),
    /does not match package manifest version 1\.2\.4/u
  );
});

test("manual dispatch is dry-run only", () => {
  const release = resolveNpmRelease({
    eventName: "workflow_dispatch",
    manifests: manifestsWithVersion("1.2.3")
  });

  assert.equal(release.release_enabled, "false");
  assert.equal(release.release_type, "none");
  assert.equal(release.version, "1.2.3");
});

test("all release manifest versions must match", () => {
  const manifests = manifestsWithVersion("1.2.3");
  manifests["packages/cli/package.json"] = { version: "1.2.4" };

  assert.throws(
    () => validateReleaseManifestVersions(manifests),
    /packages\/cli\/package\.json=1\.2\.4/u
  );
});

function manifestsWithVersion(version) {
  return Object.fromEntries(
    ["package.json", ...publicPackageManifestPaths].map((path) => [path, { version }])
  );
}

function pullRequestEvent({ action, label, merged }) {
  return {
    action,
    pull_request: {
      labels: [{ name: label }],
      merged
    }
  };
}
