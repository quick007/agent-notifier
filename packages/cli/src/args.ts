export interface ParsedArgs {
  command: string[];
  flags: Record<string, string | boolean>;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  const command: string[] = [];
  let commandDone = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === "--") {
      positional.push(...argv.slice(index + 1));
      break;
    }

    if (arg.startsWith("--")) {
      const [rawName, inlineValue] = arg.slice(2).split("=", 2);
      if (!rawName) {
        continue;
      }
      const name = rawName.trim();
      if (inlineValue !== undefined) {
        flags[name] = inlineValue;
        continue;
      }

      const next = argv[index + 1];
      if (next && !next.startsWith("-")) {
        flags[name] = next;
        index += 1;
      } else {
        flags[name] = true;
      }
      commandDone = true;
      continue;
    }

    if (!commandDone && command.length < 2) {
      command.push(arg);
    } else {
      positional.push(arg);
    }
  }

  return { command, flags, positional };
}

export function flagString(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

export function flagBoolean(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true;
}
