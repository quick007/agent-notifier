import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyNpmViewResult,
  findPackageArtifact,
  planNpmPublishes,
  publicPackages,
  validateArtifactAllowlist
} from "./publish-npm-artifacts.mjs";

test("stages existing packages with provenance", () => {
  const plans = planNpmPublishes({
    artifacts: artifactsForVersion("0.1.1"),
    releaseVersion: "0.1.1",
    viewPackage: () => ({ exists: true })
  });

  assert.equal(plans.length, publicPackages.length);
  assert.deepEqual(
    plans.map((plan) => plan.mode),
    ["stage", "stage", "stage", "stage"]
  );
  assert.deepEqual(plans[0].args, [
    "stage",
    "publish",
    "npm-artifacts/agent-notifier-protocol-0.1.1.tgz",
    "--access",
    "public",
    "--provenance",
    "--ignore-scripts"
  ]);
});

test("refuses to publish missing packages from CI", () => {
  assert.throws(
    () =>
      planNpmPublishes({
        artifacts: artifactsForVersion("0.1.0"),
        releaseVersion: "0.1.0",
        viewPackage: () => ({ missing: true })
      }),
    /Bootstrap package records first with user-present npm maintainer auth\/2FA/u
  );
});

test("fails closed when npm view fails without E404", () => {
  assert.throws(
    () =>
      planNpmPublishes({
        artifacts: artifactsForVersion("0.1.0"),
        releaseVersion: "0.1.0",
        viewPackage: () => ({ error: "npm view failed without E404" })
      }),
    /npm view failed without E404/u
  );
});

test("classifies only E404 npm view failures as missing", () => {
  assert.deepEqual(
    classifyNpmViewResult({ status: 0, stdout: '"0.1.0"\n', stderr: "" }, "@scope/pkg"),
    { exists: true }
  );
  assert.deepEqual(
    classifyNpmViewResult({ status: 1, stdout: "", stderr: "npm ERR! code E404" }, "@scope/pkg"),
    { missing: true }
  );
  assert.deepEqual(
    classifyNpmViewResult({ status: 1, stdout: "", stderr: "npm ERR! code E401" }, "@scope/pkg"),
    { error: "npm view @scope/pkg failed without E404; refusing to publish" }
  );
});

test("requires exactly one allowlisted artifact for the release version", () => {
  assert.equal(
    findPackageArtifact({
      artifacts: artifactsForVersion("0.1.0"),
      packageInfo: publicPackages[0],
      releaseVersion: "0.1.0"
    }),
    "npm-artifacts/agent-notifier-protocol-0.1.0.tgz"
  );

  assert.throws(
    () =>
      findPackageArtifact({
        artifacts: artifactsForVersion("0.1.1"),
        packageInfo: publicPackages[0],
        releaseVersion: "0.1.0"
      }),
    /Expected exactly one agent-notifier-protocol-0\.1\.0\.tgz/u
  );
});

test("rejects unexpected artifacts outside the package allowlist", () => {
  assert.doesNotThrow(() =>
    validateArtifactAllowlist({
      artifacts: artifactsForVersion("0.1.0"),
      releaseVersion: "0.1.0"
    })
  );

  assert.throws(
    () =>
      validateArtifactAllowlist({
        artifacts: [
          ...artifactsForVersion("0.1.0"),
          { name: "agent-notifier-web-0.1.0.tgz", path: "npm-artifacts/web.tgz" }
        ],
        releaseVersion: "0.1.0"
      }),
    /Unexpected npm artifacts: agent-notifier-web-0\.1\.0\.tgz/u
  );
});

function artifactsForVersion(version) {
  return publicPackages.map((packageInfo) => ({
    name: `${packageInfo.artifactBase}-${version}.tgz`,
    path: `npm-artifacts/${packageInfo.artifactBase}-${version}.tgz`
  }));
}
