import type { PluginCommandContext, PluginCommandResult } from "getkova/plugin-sdk/plugin-entry";
import { formatCodexDisplayText } from "./command-formatters.js";

export type CodexPluginConfigEntry = {
  enabled?: boolean;
  marketplaceName?: string;
  pluginName?: string;
  allow_destructive_actions?: boolean;
};

export type CodexPluginsConfigBlock = {
  enabled?: boolean;
  plugins?: Record<string, CodexPluginConfigEntry>;
};

export type CodexPluginsManagementIO = {
  readConfig: () => Promise<CodexPluginsConfigBlock>;
  mutate: (update: (block: CodexPluginsConfigBlock) => void) => Promise<void>;
};

const POLICY_REFRESH_HINT =
  "New Codex conversations pick this up automatically. Use /new or /reset to refresh the current one.";

export async function handleCodexPluginsSubcommand(
  ctx: PluginCommandContext,
  rest: string[],
  io: CodexPluginsManagementIO,
): Promise<PluginCommandResult> {
  const [verb = "list", ...args] = rest;
  const normalized = verb.toLowerCase();

  if (normalized === "list") {
    if (args.length > 0) {
      return { text: "Usage: /codex plugins list" };
    }
    const current = await io.readConfig();
    return {
      text: formatPluginList(current.plugins ?? {}, { globalEnabled: current.enabled === true }),
    };
  }

  if (normalized === "enable" || normalized === "disable") {
    const target = args[0];
    if (!target || args.length > 1) {
      return { text: `Usage: /codex plugins ${normalized} <name>` };
    }
    if (!canMutateCodexPlugins(ctx)) {
      return {
        text: `Only an authorized Kova owner or operator.admin gateway client can run /codex plugins ${normalized}.`,
      };
    }
    const wantEnabled = normalized === "enable";
    const current = (await io.readConfig()).plugins ?? {};
    if (!current[target]) {
      return {
        text: `Codex sub-plugin '${formatCodexDisplayText(target)}' is not configured. Run '/codex plugins list' to see configured plugins.`,
      };
    }
    await io.mutate((block) => {
      if (wantEnabled) {
        block.enabled = true;
      }
      block.plugins ??= {};
      block.plugins[target] = { ...block.plugins[target], enabled: wantEnabled };
    });
    return {
      text: `${formatCodexDisplayText(target)}: ${wantEnabled ? "enabled" : "disabled"} in kova.json. ${POLICY_REFRESH_HINT}`,
    };
  }

  return {
    text: `Unknown /codex plugins subcommand: ${formatCodexDisplayText(verb)}\n\n${buildPluginsHelp()}`,
  };
}

function canMutateCodexPlugins(ctx: PluginCommandContext): boolean {
  if (ctx.isAuthorizedSender === true) {
    return true;
  }
  return ctx.gatewayClientScopes?.includes("operator.admin") === true;
}

export function buildPluginsHelp(): string {
  return [
    "Codex sub-plugin management (writes only to ~/.kova/kova.json, never to ~/.codex/config.toml):",
    "- /codex plugins                  (alias for list)",
    "- /codex plugins list             show all configured Codex sub-plugins",
    "- /codex plugins enable <name>    enable a configured sub-plugin",
    "- /codex plugins disable <name>   disable a configured sub-plugin",
  ].join("\n");
}

export function formatPluginList(
  plugins: Record<string, CodexPluginConfigEntry>,
  options: { globalEnabled?: boolean } = {},
): string {
  const globalEnabled = options.globalEnabled === true;
  const keys = Object.keys(plugins).toSorted();
  if (keys.length === 0) {
    return "No Codex sub-plugins configured under plugins.entries.codex.config.codexPlugins.plugins";
  }
  const rows = keys.map((key) => {
    const entry = plugins[key] ?? {};
    const state = globalEnabled && entry.enabled !== false ? "ON " : "OFF";
    const displayKey = formatCodexDisplayText(key);
    const pluginName = formatCodexDisplayText(entry.pluginName ?? key);
    const marketplace = formatCodexDisplayText(entry.marketplaceName ?? "?");
    return { displayKey, state, pluginName, marketplace };
  });
  const keyWidth = Math.max(...rows.map((row) => row.displayKey.length));
  const pluginWidth = Math.max(...rows.map((row) => row.pluginName.length));
  return [
    "Codex sub-plugins in Kova config (~/.kova/kova.json):",
    "",
    ...rows.map(
      (row) =>
        `  ${row.state}  ${row.displayKey.padEnd(keyWidth)}  ${row.pluginName.padEnd(pluginWidth)}  [${row.marketplace}]`,
    ),
    "",
    ...(globalEnabled
      ? []
      : ["Global codexPlugins.enabled is off; configured sub-plugins are inactive.", ""]),
    "New Codex conversations pick up policy changes automatically; /new or /reset to refresh the current one.",
  ].join("\n");
}
