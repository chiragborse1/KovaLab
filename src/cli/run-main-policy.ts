import type { KovaConfig } from "../config/types.kova.js";
import {
  resolveManifestCommandAliasOwnerInRegistry,
  type PluginManifestCommandAliasRecord,
  type PluginManifestCommandAliasRegistry,
} from "../plugins/manifest-command-aliases.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
} from "../shared/string-coerce.js";
import { resolveCliArgvInvocation } from "./argv-invocation.js";
import { resolveCliCommandPathPolicy } from "./command-path-policy.js";

export function rewriteUpdateFlagArgv(argv: string[]): string[] {
  const index = argv.indexOf("--update");
  if (index === -1) {
    return argv;
  }

  const next = [...argv];
  next.splice(index, 1, "update");
  return next;
}

export function shouldEnsureCliPath(argv: string[]): boolean {
  const invocation = resolveCliArgvInvocation(argv);
  if (invocation.hasHelpOrVersion) {
    return false;
  }
  return resolveCliCommandPathPolicy(invocation.commandPath).ensureCliPath;
}

export function shouldUseRootHelpFastPath(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const invocation = resolveCliArgvInvocation(argv);
  return (
    env.KOVA_DISABLE_CLI_STARTUP_HELP_FAST_PATH !== "1" &&
    (invocation.isRootHelpInvocation ||
      (invocation.commandPath.length === 1 &&
        invocation.commandPath[0] === "help" &&
        invocation.hasHelpOrVersion))
  );
}

export function shouldUseBrowserHelpFastPath(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.KOVA_DISABLE_CLI_STARTUP_HELP_FAST_PATH === "1") {
    return false;
  }
  const invocation = resolveCliArgvInvocation(argv);
  return (
    invocation.commandPath.length === 1 &&
    invocation.commandPath[0] === "browser" &&
    invocation.hasHelpOrVersion
  );
}

export function shouldStartLocalChatForBareRoot(argv: string[]): boolean {
  const invocation = resolveCliArgvInvocation(argv);
  return invocation.commandPath.length === 0 && !invocation.hasHelpOrVersion;
}

export function rewriteBareRootArgvToLocalChat(argv: string[]): string[] {
  if (!shouldStartLocalChatForBareRoot(argv)) {
    return argv;
  }
  return [...argv, "chat"];
}

export function resolveMissingPluginCommandMessage(
  pluginId: string,
  config?: KovaConfig,
  options?: {
    registry?: PluginManifestCommandAliasRegistry;
    resolveCommandAliasOwner?: (params: {
      command: string | undefined;
      config?: KovaConfig;
      registry?: PluginManifestCommandAliasRegistry;
    }) => PluginManifestCommandAliasRecord | undefined;
  },
): string | null {
  const normalizedPluginId = normalizeLowercaseStringOrEmpty(pluginId);
  if (!normalizedPluginId) {
    return null;
  }
  if (normalizedPluginId === "dashboard") {
    return (
      "The `kova dashboard` command has been removed. Use `kova chat` for terminal chat, " +
      "or `kova control-ui` for the optional browser Control UI."
    );
  }
  const allow =
    Array.isArray(config?.plugins?.allow) && config.plugins.allow.length > 0
      ? config.plugins.allow
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => normalizeOptionalLowercaseString(entry))
          .filter(Boolean)
      : [];
  const commandAlias = options?.registry
    ? resolveManifestCommandAliasOwnerInRegistry({
        command: normalizedPluginId,
        registry: options.registry,
      })
    : options?.resolveCommandAliasOwner?.({
        command: normalizedPluginId,
        config,
        ...(options?.registry ? { registry: options.registry } : {}),
      });
  const parentPluginId = commandAlias?.pluginId;
  if (parentPluginId) {
    if (allow.length > 0 && !allow.includes(parentPluginId)) {
      return (
        `"${normalizedPluginId}" is not a plugin; it is a command provided by the ` +
        `"${parentPluginId}" plugin. Add "${parentPluginId}" to \`plugins.allow\` ` +
        `instead of "${normalizedPluginId}".`
      );
    }
    if (config?.plugins?.entries?.[parentPluginId]?.enabled === false) {
      return (
        `The \`kova ${normalizedPluginId}\` command is unavailable because ` +
        `\`plugins.entries.${parentPluginId}.enabled=false\`. Re-enable that entry if you want ` +
        "the bundled plugin command surface."
      );
    }
    if (commandAlias.kind === "runtime-slash") {
      const cliHint = commandAlias.cliCommand
        ? `Use \`kova ${commandAlias.cliCommand}\` for related CLI operations, or `
        : "Use ";
      return (
        `"${normalizedPluginId}" is a runtime slash command (/${normalizedPluginId}), not a CLI command. ` +
        `It is provided by the "${parentPluginId}" plugin. ` +
        `${cliHint}\`/${normalizedPluginId}\` in a chat session.`
      );
    }
  }

  if (allow.length > 0 && !allow.includes(normalizedPluginId)) {
    if (parentPluginId && allow.includes(parentPluginId)) {
      return null;
    }
    return (
      `The \`kova ${normalizedPluginId}\` command is unavailable because ` +
      `\`plugins.allow\` excludes "${normalizedPluginId}". Add "${normalizedPluginId}" to ` +
      `\`plugins.allow\` if you want that bundled plugin CLI surface.`
    );
  }
  if (config?.plugins?.entries?.[normalizedPluginId]?.enabled === false) {
    return (
      `The \`kova ${normalizedPluginId}\` command is unavailable because ` +
      `\`plugins.entries.${normalizedPluginId}.enabled=false\`. Re-enable that entry if you want ` +
      "the bundled plugin CLI surface."
    );
  }
  return null;
}
