import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const maxLines = Number.parseInt(process.env.MAX_FILE_LINES ?? "300", 10);

const ignoredDirectories = new Set([
  ".agents",
  ".codex",
  ".git",
  ".turbo",
  ".vite",
  ".wrangler",
  "build",
  "coverage",
  "dist",
  "node_modules"
]);

const ignoredFiles = new Set([
  "apps/web/worker-configuration.d.ts",
  "docs/product-spec.md",
  "pnpm-lock.yaml"
]);

const checkedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".md",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

type Violation = {
  path: string;
  lines: number;
};

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return ignoredDirectories.has(entry.name) ? [] : collectFiles(fullPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      const relativePath = toPosixPath(relative(root, fullPath));
      const shouldCheck =
        checkedExtensions.has(extname(entry.name)) &&
        !ignoredFiles.has(relativePath);

      return shouldCheck ? [fullPath] : [];
    })
  );

  return files.flat();
}

function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

async function countLines(path: string): Promise<number> {
  const contents = await readFile(path, "utf8");

  if (contents.length === 0) {
    return 0;
  }

  return contents.split(/\r\n|\r|\n/).length;
}

const files = await collectFiles(root);
const violations: Violation[] = [];

for (const file of files) {
  const lines = await countLines(file);

  if (lines > maxLines) {
    violations.push({
      path: toPosixPath(relative(root, file)),
      lines
    });
  }
}

if (violations.length > 0) {
  console.error(`Files over ${maxLines} lines:`);

  for (const violation of violations) {
    console.error(`- ${violation.path}: ${violation.lines}`);
  }

  process.exitCode = 1;
} else {
  console.log(`All checked files are ${maxLines} lines or fewer.`);
}
