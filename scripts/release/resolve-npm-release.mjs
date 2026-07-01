import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const releaseLabels = new Map([
  ["release:none", "none"],
  ["release:patch", "patch"],
  ["release:minor", "minor"],
  ["release:major", "major"]
]);

export const publicPackageManifestPaths = [
  "packages/protocol/package.json",
  "packages/crypto/package.json",
  "packages/cli/package.json",
  "packages/mcp/package.json"
];

const releaseManifestPaths = ["package.json", ...publicPackageManifestPaths];
const semverPattern = /^[0-9]+\.[0-9]+\.[0-9]+$/u;

export function resolveNpmRelease({
  event = {},
  eventName,
  manifests,
  refName,
  refType
}) {
  if (eventName === "pull_request") {
    return resolvePullRequestRelease({ event, manifests });
  }

  if (eventName === "push") {
    return resolvePushRelease({ manifests, refName, refType });
  }

  if (eventName === "workflow_dispatch") {
    const version = validateReleaseManifestVersions(manifests).version;
    return disabledRelease({
      reason: "manual dispatch builds and dry-runs packages only",
      tag: `v${version}`,
      version
    });
  }

  return disabledRelease({
    reason: `${eventName || "unknown"} event runs CI only`
  });
}

export function releaseTypeFromLabels(labels) {
  const matches = labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter((name) => releaseLabels.has(name));

  if (matches.length !== 1) {
    const suffix =
      matches.length === 0 ? "No release label was found." : `Found: ${matches.join(", ")}.`;
    throw new Error(
      `Pull requests must have exactly one release label: ${[...releaseLabels.keys()].join(
        ", "
      )}. ${suffix}`
    );
  }

  return releaseLabels.get(matches[0]);
}

export function validateReleaseManifestVersions(manifests = readReleaseManifests()) {
  const entries = releaseManifestPaths.map((path) => {
    const manifest = manifests[path];
    if (!manifest) {
      throw new Error(`Missing release manifest: ${path}`);
    }
    const version = manifest.version;
    if (!semverPattern.test(version ?? "")) {
      throw new Error(`${path} must have an x.y.z release version; got ${version ?? "missing"}`);
    }
    return [path, version];
  });

  const expected = entries[0][1];
  const mismatched = entries.filter(([, version]) => version !== expected);
  if (mismatched.length > 0) {
    throw new Error(
      `Release manifest versions must match ${expected}: ${mismatched
        .map(([path, version]) => `${path}=${version}`)
        .join(", ")}`
    );
  }

  return {
    manifests: entries,
    version: expected
  };
}

function resolvePullRequestRelease({ event, manifests }) {
  const pullRequest = event.pull_request;
  const releaseType = releaseTypeFromLabels(pullRequest?.labels ?? []);

  if (event.action !== "closed" || pullRequest?.merged !== true) {
    return disabledRelease({
      reason: "pull request is not a merged close event",
      type: releaseType
    });
  }

  if (releaseType === "none") {
    return disabledRelease({
      reason: "merged pull request is labeled release:none",
      type: "none"
    });
  }

  const version = validateReleaseManifestVersions(manifests).version;
  return enabledRelease({
    reason: `merged pull request is labeled release:${releaseType}`,
    type: releaseType,
    version
  });
}

function resolvePushRelease({ manifests, refName, refType }) {
  if (refType !== "tag" || !refName?.startsWith("v")) {
    return disabledRelease({
      reason: "push event runs CI only"
    });
  }

  const version = refName.slice(1);
  if (!semverPattern.test(version)) {
    throw new Error(`Release tag must use vX.Y.Z format: ${refName}`);
  }

  const manifestVersion = validateReleaseManifestVersions(manifests).version;
  if (manifestVersion !== version) {
    throw new Error(
      `Release tag ${refName} does not match package manifest version ${manifestVersion}`
    );
  }

  return enabledRelease({
    reason: `release tag ${refName}`,
    type: "tag",
    version
  });
}

function enabledRelease({ reason, type, version }) {
  return {
    release_enabled: "true",
    release_reason: reason,
    release_type: type,
    tag: `v${version}`,
    version
  };
}

function disabledRelease({ reason, tag = "v0.0.0", type = "none", version = "0.0.0" }) {
  return {
    release_enabled: "false",
    release_reason: reason,
    release_type: type,
    tag,
    version
  };
}

function readReleaseManifests() {
  return Object.fromEntries(
    releaseManifestPaths.map((path) => [
      path,
      JSON.parse(readFileSync(resolve(path), "utf8"))
    ])
  );
}

function readGithubEvent() {
  if (!process.env.GITHUB_EVENT_PATH) return {};
  return JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
}

function writeOutputs(outputs) {
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  } else {
    console.log(lines.join("\n"));
  }
}

function main() {
  const outputs = resolveNpmRelease({
    event: readGithubEvent(),
    eventName: process.env.GITHUB_EVENT_NAME,
    refName: process.env.GITHUB_REF_NAME,
    refType: process.env.GITHUB_REF_TYPE
  });
  writeOutputs(outputs);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
