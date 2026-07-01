import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const bannedScripts = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepack",
  "postpack",
  "prepublish",
  "prepublishOnly",
  "publish",
  "postpublish"
]);

const packageRoot = "packages";
const packageOrder = ["protocol", "crypto", "cli", "mcp"];
const publicRepositoryUrl = "git+https://github.com/quick007/agent-notifier.git";
const publicHomepageUrl = "https://github.com/quick007/agent-notifier#readme";
const publicBugsUrl = "https://github.com/quick007/agent-notifier/issues";
const approvedExternalRuntimeDeps = new Map([
  [
    "@agent-notifier/protocol",
    new Set(["@hono/zod-openapi", "hono", "zod"])
  ],
  [
    "@agent-notifier/cli",
    new Set(["hono"])
  ]
]);

const packageDirs = readdirSync(packageRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packageRoot, entry.name))
  .filter((packageDir) => existsSync(join(packageDir, "package.json")))
  .sort((left, right) => packageRank(left) - packageRank(right) || left.localeCompare(right));
const privateWorkspacePackages = new Set(packageDirs
  .map((packageDir) => JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")))
  .filter((manifest) => manifest.private === true)
  .map((manifest) => manifest.name));

const alwaysAllowed = new Set(["LICENSE", "README.md", "package.json"]);
function allowlistAllows(filesAllowlist, packedPath) {
  if (alwaysAllowed.has(packedPath)) {
    return true;
  }

  return filesAllowlist.some((entry) => {
    const normalized = entry.replaceAll("\\", "/").replace(/^\.\//, "");
    const prefix = normalized.endsWith("/") ? normalized : `${normalized}/`;

    return packedPath === normalized || packedPath.startsWith(prefix);
  });
}

function collectEntrypoints(manifest) {
  const entrypoints = new Set();

  addStringEntrypoint(entrypoints, manifest.main);
  addStringEntrypoint(entrypoints, manifest.types);
  addStringEntrypoint(entrypoints, manifest.typings);

  if (manifest.bin) {
    if (typeof manifest.bin === "string") {
      addStringEntrypoint(entrypoints, manifest.bin);
    } else {
      for (const target of Object.values(manifest.bin)) {
        addStringEntrypoint(entrypoints, target);
      }
    }
  }

  collectExportEntrypoints(entrypoints, manifest.exports);

  return [...entrypoints].sort();
}

function addStringEntrypoint(entrypoints, target) {
  if (typeof target !== "string") {
    return;
  }

  const normalized = target.replaceAll("\\", "/").replace(/^\.\//, "");

  if (normalized.length > 0 && !normalized.startsWith("#")) {
    entrypoints.add(normalized);
  }
}

function collectExportEntrypoints(entrypoints, value) {
  if (typeof value === "string") {
    addStringEntrypoint(entrypoints, value);
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const child of Object.values(value)) {
    collectExportEntrypoints(entrypoints, child);
  }
}

function packageRank(packageDir) {
  const name = packageDir.replaceAll("\\", "/").split("/").pop();
  const index = packageOrder.indexOf(name);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function runVp(args, packageName) {
  const result = spawnSync(resolveVpCommand(), args, {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    const details = [
      result.error?.message,
      result.stderr?.trim(),
      result.stdout?.trim()
    ].filter(Boolean).join("\n");
    throw new Error(`vp failed for ${packageName}: ${args.join(" ")}${details ? `\n${details}` : ""}`);
  }

  return result;
}

function resolveVpCommand() {
  if (process.platform !== "win32") {
    return "vp";
  }

  const vitePlusHome = process.env.VITE_PLUS_HOME
    ?? (process.env.USERPROFILE ? join(process.env.USERPROFILE, ".vite-plus") : undefined);
  const vpExe = vitePlusHome ? join(vitePlusHome, "current", "bin", "vp.exe") : undefined;

  return vpExe && existsSync(vpExe) ? vpExe : "vp";
}

for (const packageDir of packageDirs) {
  const manifestPath = join(packageDir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (manifest.private === true) {
    console.log(`${manifest.name}: skipped private package`);
    continue;
  }

  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const privateDeps = Object.keys(manifest[field] ?? {}).filter((name) => privateWorkspacePackages.has(name));
    if (privateDeps.length > 0) {
      throw new Error(`${manifest.name} must not reference private workspace packages in ${field}: ${privateDeps.join(", ")}`);
    }
  }

  if (manifest.version === "0.0.0") {
    throw new Error(`${manifest.name} must set a public release version`);
  }

  if (typeof manifest.description !== "string" || manifest.description.trim().length === 0) {
    throw new Error(`${manifest.name} must define description`);
  }

  if (manifest.license !== "MIT") {
    throw new Error(`${manifest.name} must declare the MIT license`);
  }

  if (!Array.isArray(manifest.keywords) || manifest.keywords.length === 0) {
    throw new Error(`${manifest.name} must define package keywords`);
  }

  if (manifest.repository?.type !== "git" || manifest.repository?.url !== publicRepositoryUrl) {
    throw new Error(`${manifest.name} must define the public Git repository URL`);
  }

  if (typeof manifest.repository.directory !== "string" || manifest.repository.directory !== packageDir.replaceAll("\\", "/")) {
    throw new Error(`${manifest.name} must define its repository directory`);
  }

  if (manifest.homepage !== publicHomepageUrl) {
    throw new Error(`${manifest.name} must define the public package homepage`);
  }

  if (manifest.bugs?.url !== publicBugsUrl) {
    throw new Error(`${manifest.name} must define the public issue tracker`);
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error(`${manifest.name} must define a package files allowlist`);
  }

  if (!manifest.files.includes("LICENSE")) {
    throw new Error(`${manifest.name} must include LICENSE in its files allowlist`);
  }

  for (const scriptName of Object.keys(manifest.scripts ?? {})) {
    if (bannedScripts.has(scriptName)) {
      throw new Error(`${manifest.name} must not define ${scriptName}`);
    }
  }

  const runtimeDeps = Object.keys(manifest.dependencies ?? {});
  const approvedExternalDeps = approvedExternalRuntimeDeps.get(manifest.name) ?? new Set();
  const externalDeps = runtimeDeps.filter((name) => !name.startsWith("@agent-notifier/") && !approvedExternalDeps.has(name));
  if (externalDeps.length > 0) {
    throw new Error(`${manifest.name} has external runtime deps: ${externalDeps.join(", ")}`);
  }

  if (manifest.scripts?.build) {
    runVp(["run", `${manifest.name}#build`], manifest.name);
  }

  const packTempDir = mkdtempSync(join(tmpdir(), "agent-notifier-pack-"));
  try {
    const result = runVp(
      ["pm", "pack", "--filter", manifest.name, "--json", "--pack-destination", packTempDir],
      manifest.name
    );
    const parsed = JSON.parse(result.stdout);
    const pack = Array.isArray(parsed) ? parsed[0] : parsed;
    const packedFiles = new Set(pack.files?.map((file) => file.path.replaceAll("\\", "/")) ?? []);

    if (!packedFiles.has("LICENSE")) {
      throw new Error(`${manifest.name} does not pack LICENSE`);
    }

    for (const file of pack.files ?? []) {
      const path = file.path.replaceAll("\\", "/");

      if (!allowlistAllows(manifest.files, path)) {
        throw new Error(`${manifest.name} packs unexpected file: ${path}`);
      }
    }

    for (const entrypoint of collectEntrypoints(manifest)) {
      if (!packedFiles.has(entrypoint)) {
        throw new Error(`${manifest.name} does not pack declared entrypoint: ${entrypoint}`);
      }
    }

    const size = typeof pack.size === "number" ? pack.size : statSync(pack.filename).size;
    console.log(`${manifest.name}: ${pack.files.length} files, ${size} bytes`);
  } finally {
    rmSync(packTempDir, { recursive: true, force: true });
  }
}
