import path from "node:path";

export const DEFAULT_CLI_NAME = "kova";
export const LEGACY_CLI_NAME = "openclaw";

const KNOWN_CLI_NAMES = new Set([DEFAULT_CLI_NAME, LEGACY_CLI_NAME]);
const CLI_PREFIX_RE = /^(?:((?:pnpm|npm|bunx|npx)\s+))?(?:openclaw|kova)\b/;

export function resolveCliName(argv: string[] = process.argv): string {
  const argv1 = argv[1];
  if (!argv1) {
    return DEFAULT_CLI_NAME;
  }
  const base = path.basename(argv1).trim();
  const stem = path.parse(base).name.trim();
  if (KNOWN_CLI_NAMES.has(base)) {
    return base;
  }
  if (KNOWN_CLI_NAMES.has(stem)) {
    return stem;
  }
  return DEFAULT_CLI_NAME;
}

export function resolveDisplayCliName(): string {
  return DEFAULT_CLI_NAME;
}

export function replaceCliName(command: string, cliName = resolveDisplayCliName()): string {
  if (!command.trim()) {
    return command;
  }
  if (!CLI_PREFIX_RE.test(command)) {
    return command;
  }
  return command.replace(CLI_PREFIX_RE, (_match, runner: string | undefined) => {
    return `${runner ?? ""}${cliName}`;
  });
}
