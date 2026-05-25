import {
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../../shared/string-coerce.js";

export type PluginsCommand =
  | { action: "list" }
  | { action: "inspect"; name?: string }
  | { action: "install"; spec: string }
  | { action: "update"; name?: string; all?: boolean; dryRun?: boolean }
  | { action: "enable"; name: string }
  | { action: "disable"; name: string }
  | { action: "error"; message: string };

export function parsePluginsCommand(raw: string): PluginsCommand | null {
  const match = raw.match(/^\/plugins?(?:\s+(.*))?$/i);
  if (!match) {
    return null;
  }

  const tail = normalizeOptionalString(match?.[1]) ?? "";
  if (!tail) {
    return { action: "list" };
  }

  const [rawAction, ...rest] = tail.split(/\s+/);
  const action = normalizeOptionalLowercaseString(rawAction);
  const name = rest.join(" ").trim();

  if (action === "list") {
    return name
      ? {
          action: "error",
          message: "Usage: /plugins list|inspect|show|get|enable|disable [plugin]",
        }
      : { action: "list" };
  }

  if (action === "inspect" || action === "show" || action === "get") {
    return { action: "inspect", name: name || undefined };
  }

  if (action === "install" || action === "add") {
    if (!name) {
      return {
        action: "error",
        message: "Usage: /plugins install <path|archive|npm-spec>",
      };
    }
    return { action: "install", spec: name };
  }

  if (action === "update" || action === "upgrade") {
    const args = rest.filter(Boolean);
    const dryRun = args.includes("--dry-run");
    const updateArgs = args.filter((arg) => arg !== "--dry-run");
    const all = updateArgs.includes("--all") || updateArgs.includes("all");
    const target = updateArgs.find((arg) => arg !== "--all" && arg !== "all");
    if (!all && !target) {
      return {
        action: "error",
        message: "Usage: /plugins update <plugin-id-or-npm-spec>|all [--dry-run]",
      };
    }
    return {
      action: "update",
      ...(target ? { name: target } : {}),
      ...(all ? { all: true } : {}),
      ...(dryRun ? { dryRun: true } : {}),
    };
  }

  if (action === "enable" || action === "disable") {
    if (!name) {
      return {
        action: "error",
        message: `Usage: /plugins ${action} <plugin-id-or-name>`,
      };
    }
    return { action, name };
  }

  return {
    action: "error",
    message: "Usage: /plugins list|inspect|show|get|install|update|enable|disable [plugin]",
  };
}
