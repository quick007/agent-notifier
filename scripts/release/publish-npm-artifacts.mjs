import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const publicPackages = [
  { name: "@agent-notifier/protocol", artifactBase: "agent-notifier-protocol" },
  { name: "@agent-notifier/crypto", artifactBase: "agent-notifier-crypto" },
  { name: "@agent-notifier/cli", artifactBase: "agent-notifier-cli" },
  { name: "@agent-notifier/mcp", artifactBase: "agent-notifier-mcp" }
];

export function planNpmPublishes({
  artifacts,
  packages = publicPackages,
  releaseVersion,
  viewPackage
}) {
  if (!releaseVersion) {
    throw new Error("Missing release version");
  }
  validateArtifactAllowlist({ artifacts, packages, releaseVersion });

  return packages.map((packageInfo) => {
    const tgz = findPackageArtifact({ artifacts, packageInfo, releaseVersion });
    const status = viewPackage(packageInfo.name);

    if (status.exists) {
      return stagePublishPlan(packageInfo.name, tgz);
    }

    if (status.missing) {
      throw new Error(
        `${packageInfo.name} does not exist on npm. Bootstrap package records first with user-present npm maintainer auth/2FA, then configure trusted publishing before staging from CI.`
      );
    }

    throw new Error(status.error ?? `Could not determine npm status for ${packageInfo.name}`);
  });
}

export function validateArtifactAllowlist({ artifacts, packages = publicPackages, releaseVersion }) {
  const expected = new Set(
    packages.map((packageInfo) => `${packageInfo.artifactBase}-${releaseVersion}.tgz`)
  );
  const unexpected = artifacts
    .map((artifact) => artifact.name)
    .filter((name) => !expected.has(name));

  if (unexpected.length > 0) {
    throw new Error(`Unexpected npm artifacts: ${unexpected.join(", ")}`);
  }
}

export function findPackageArtifact({ artifacts, packageInfo, releaseVersion }) {
  const expectedName = `${packageInfo.artifactBase}-${releaseVersion}.tgz`;
  const matches = artifacts.filter((artifact) => artifact.name === expectedName);

  if (matches.length !== 1) {
    const matchingNames = artifacts
      .map((artifact) => artifact.name)
      .filter((name) => name.startsWith(`${packageInfo.artifactBase}-`));
    throw new Error(
      `Expected exactly one ${expectedName} artifact for ${packageInfo.name}; found ${
        matchingNames.length === 0 ? "none" : matchingNames.join(", ")
      }`
    );
  }

  return matches[0].path;
}

export function classifyNpmViewResult(result, packageName) {
  if (result.status === 0) {
    return { exists: true };
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (/\bE404\b/u.test(output)) {
    return { missing: true };
  }

  return {
    error: `npm view ${packageName} failed without E404; refusing to publish`
  };
}

function stagePublishPlan(packageName, tgz) {
  return {
    args: ["stage", "publish", tgz, "--access", "public", "--provenance", "--ignore-scripts"],
    command: "npm",
    mode: "stage",
    packageName,
    tgz
  };
}

function readArtifacts(artifactDir) {
  return readdirSync(artifactDir)
    .filter((name) => name.endsWith(".tgz"))
    .map((name) => ({ name, path: join(artifactDir, name) }));
}

function runNpm(args) {
  return spawnSync("npm", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function viewPackage(packageName) {
  const result = runNpm(["view", packageName, "version", "--json"]);
  return classifyNpmViewResult(result, packageName);
}

function publish(plan) {
  console.log(`Staging ${plan.packageName} from ${plan.tgz}`);

  const result = spawnSync(plan.command, plan.args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${plan.command} ${plan.args.join(" ")} failed with status ${result.status}`);
  }
}

function main() {
  const artifactDir = process.argv[2] ?? "npm-artifacts";
  const releaseVersion = process.env.RELEASE_VERSION ?? process.argv[3];
  const plans = planNpmPublishes({
    artifacts: readArtifacts(artifactDir),
    releaseVersion,
    viewPackage
  });

  for (const plan of plans) {
    publish(plan);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
