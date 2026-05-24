import fs from "node:fs";
import { buildNpmInstallRecordFields } from "../../cli/npm-resolution.js";
import {
  buildPreferredKovaHubSpec,
  createPluginInstallLogger,
  decidePreferredKovaHubFallback,
  resolveFileNpmSpecToLocalPath,
} from "../../cli/plugins-command-helpers.js";
import { persistPluginInstall } from "../../cli/plugins-install-persist.js";
import type { ConfigSnapshotForInstallPersist } from "../../cli/plugins-install-persist.js";
import { commitPluginInstallRecordsWithConfig } from "../../cli/plugins-install-record-commit.js";
import { refreshPluginRegistryAfterConfigMutation } from "../../cli/plugins-registry-refresh.js";
import { resolvePluginUpdateSelection } from "../../cli/plugins-update-selection.js";
import {
  readConfigFileSnapshot,
  replaceConfigFile,
  validateConfigObjectWithPlugins,
} from "../../config/config.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { PluginInstallRecord } from "../../config/types.plugins.js";
import { resolveArchiveKind } from "../../infra/archive.js";
import { parseKovaHubPluginSpec } from "../../infra/kovahub.js";
import { installPluginFromNpmSpec, installPluginFromPath } from "../../plugins/install.js";
import {
  loadInstalledPluginIndexInstallRecords,
  withoutPluginInstallRecords,
  withPluginInstallRecords,
} from "../../plugins/installed-plugin-index-records.js";
import { installPluginFromKovaHub } from "../../plugins/kovahub.js";
import { clearPluginManifestRegistryCache } from "../../plugins/manifest-registry.js";
import type { PluginRecord } from "../../plugins/registry.js";
import {
  buildAllPluginInspectReports,
  buildPluginDiagnosticsReport,
  buildPluginInspectReport,
  buildPluginRegistrySnapshotReport,
  formatPluginCompatibilityNotice,
  type PluginStatusReport,
} from "../../plugins/status.js";
import { setPluginEnabledInConfig } from "../../plugins/toggle-config.js";
import { updateNpmInstalledPlugins } from "../../plugins/update.js";
import { normalizeOptionalLowercaseString } from "../../shared/string-coerce.js";
import { resolveUserPath } from "../../utils.js";
import { isInternalMessageChannel } from "../../utils/message-channel.js";
import {
  rejectNonOwnerCommand,
  rejectUnauthorizedCommand,
  requireCommandFlagEnabled,
  requireGatewayClientScope,
} from "./command-gates.js";
import type { CommandHandler } from "./commands-types.js";
import { parsePluginsCommand } from "./plugins-commands.js";

function renderJsonBlock(label: string, value: unknown): string {
  return `${label}\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function buildPluginInspectJson(params: {
  id: string;
  config: KovaConfig;
  installRecords: Record<string, PluginInstallRecord>;
  report: PluginStatusReport;
}): {
  inspect: NonNullable<ReturnType<typeof buildPluginInspectReport>>;
  compatibilityWarnings: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
  install: PluginInstallRecord | null;
} | null {
  const inspect = buildPluginInspectReport({
    id: params.id,
    config: params.config,
    report: params.report,
  });
  if (!inspect) {
    return null;
  }
  return {
    inspect,
    compatibilityWarnings: inspect.compatibility.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: formatPluginCompatibilityNotice(warning),
    })),
    install: params.installRecords[inspect.plugin.id] ?? null,
  };
}

function buildAllPluginInspectJson(params: {
  config: KovaConfig;
  installRecords: Record<string, PluginInstallRecord>;
  report: PluginStatusReport;
}): Array<{
  inspect: ReturnType<typeof buildAllPluginInspectReports>[number];
  compatibilityWarnings: Array<{
    code: string;
    severity: string;
    message: string;
  }>;
  install: PluginInstallRecord | null;
}> {
  return buildAllPluginInspectReports({
    config: params.config,
    report: params.report,
  }).map((inspect) => ({
    inspect,
    compatibilityWarnings: inspect.compatibility.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: formatPluginCompatibilityNotice(warning),
    })),
    install: params.installRecords[inspect.plugin.id] ?? null,
  }));
}

function formatPluginLabel(plugin: PluginRecord): string {
  if (!plugin.name || plugin.name === plugin.id) {
    return plugin.id;
  }
  return `${plugin.name} (${plugin.id})`;
}

function formatPluginsList(report: PluginStatusReport): string {
  if (report.plugins.length === 0) {
    return `🔌 No plugins found for workspace ${report.workspaceDir ?? "(unknown workspace)"}.`;
  }

  const loaded = report.plugins.filter((plugin) => plugin.status === "loaded").length;
  const lines = [
    `🔌 Plugins (${loaded}/${report.plugins.length} loaded)`,
    ...report.plugins.map((plugin) => {
      const format = plugin.bundleFormat
        ? `${plugin.format ?? "kova"}/${plugin.bundleFormat}`
        : (plugin.format ?? "kova");
      return `- ${formatPluginLabel(plugin)} [${plugin.status}] ${format}`;
    }),
  ];
  return lines.join("\n");
}

function findPlugin(report: PluginStatusReport, rawName: string): PluginRecord | undefined {
  const target = normalizeOptionalLowercaseString(rawName);
  if (!target) {
    return undefined;
  }
  return report.plugins.find(
    (plugin) =>
      normalizeOptionalLowercaseString(plugin.id) === target ||
      normalizeOptionalLowercaseString(plugin.name) === target,
  );
}

function looksLikeLocalPluginInstallSpec(raw: string): boolean {
  return (
    raw.startsWith(".") ||
    raw.startsWith("~") ||
    raw.startsWith("/") ||
    raw.endsWith(".ts") ||
    raw.endsWith(".js") ||
    raw.endsWith(".mjs") ||
    raw.endsWith(".cjs") ||
    raw.endsWith(".tgz") ||
    raw.endsWith(".tar.gz") ||
    raw.endsWith(".tar") ||
    raw.endsWith(".zip")
  );
}

async function installPluginFromPluginsCommand(params: {
  raw: string;
  snapshot: ConfigSnapshotForInstallPersist;
}): Promise<{ ok: true; pluginId: string } | { ok: false; error: string }> {
  const fileSpec = resolveFileNpmSpecToLocalPath(params.raw);
  if (fileSpec && !fileSpec.ok) {
    return { ok: false, error: fileSpec.error };
  }
  const normalized = fileSpec && fileSpec.ok ? fileSpec.path : params.raw;
  const resolved = resolveUserPath(normalized);

  if (fs.existsSync(resolved)) {
    const result = await installPluginFromPath({
      path: resolved,
      logger: createPluginInstallLogger(),
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    clearPluginManifestRegistryCache();
    const source: "archive" | "path" = resolveArchiveKind(resolved) ? "archive" : "path";
    await persistPluginInstall({
      snapshot: params.snapshot,
      pluginId: result.pluginId,
      install: {
        source,
        sourcePath: resolved,
        installPath: result.targetDir,
        version: result.version,
      },
    });
    return { ok: true, pluginId: result.pluginId };
  }

  if (looksLikeLocalPluginInstallSpec(params.raw)) {
    return { ok: false, error: `Path not found: ${resolved}` };
  }

  const kovahubSpec = parseKovaHubPluginSpec(params.raw);
  if (kovahubSpec) {
    const result = await installPluginFromKovaHub({
      spec: params.raw,
      logger: createPluginInstallLogger(),
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    clearPluginManifestRegistryCache();
    await persistPluginInstall({
      snapshot: params.snapshot,
      pluginId: result.pluginId,
      install: {
        source: "kovahub",
        spec: params.raw,
        installPath: result.targetDir,
        version: result.version,
        integrity: result.kovahub.integrity,
        resolvedAt: result.kovahub.resolvedAt,
        kovahubUrl: result.kovahub.kovahubUrl,
        kovahubPackage: result.kovahub.kovahubPackage,
        kovahubFamily: result.kovahub.kovahubFamily,
        kovahubChannel: result.kovahub.kovahubChannel,
      },
    });
    return { ok: true, pluginId: result.pluginId };
  }

  const preferredKovaHubSpec = buildPreferredKovaHubSpec(params.raw);
  if (preferredKovaHubSpec) {
    const kovahubResult = await installPluginFromKovaHub({
      spec: preferredKovaHubSpec,
      logger: createPluginInstallLogger(),
    });
    if (kovahubResult.ok) {
      clearPluginManifestRegistryCache();
      await persistPluginInstall({
        snapshot: params.snapshot,
        pluginId: kovahubResult.pluginId,
        install: {
          source: "kovahub",
          spec: preferredKovaHubSpec,
          installPath: kovahubResult.targetDir,
          version: kovahubResult.version,
          integrity: kovahubResult.kovahub.integrity,
          resolvedAt: kovahubResult.kovahub.resolvedAt,
          kovahubUrl: kovahubResult.kovahub.kovahubUrl,
          kovahubPackage: kovahubResult.kovahub.kovahubPackage,
          kovahubFamily: kovahubResult.kovahub.kovahubFamily,
          kovahubChannel: kovahubResult.kovahub.kovahubChannel,
        },
      });
      return { ok: true, pluginId: kovahubResult.pluginId };
    }
    if (decidePreferredKovaHubFallback(kovahubResult) !== "fallback_to_npm") {
      return { ok: false, error: kovahubResult.error };
    }
  }

  const result = await installPluginFromNpmSpec({
    spec: params.raw,
    logger: createPluginInstallLogger(),
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  clearPluginManifestRegistryCache();
  const installRecord = buildNpmInstallRecordFields({
    spec: params.raw,
    installPath: result.targetDir,
    version: result.version,
    resolution: result.npmResolution,
  });
  await persistPluginInstall({
    snapshot: params.snapshot,
    pluginId: result.pluginId,
    install: installRecord,
  });
  return { ok: true, pluginId: result.pluginId };
}

async function updatePluginsFromPluginsCommand(params: {
  id?: string;
  all?: boolean;
  dryRun?: boolean;
  snapshot: ConfigSnapshotForInstallPersist;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const installRecords = await loadInstalledPluginIndexInstallRecords();
  const selection = resolvePluginUpdateSelection({
    installs: installRecords,
    rawId: params.id,
    all: params.all,
  });
  if (selection.pluginIds.length === 0) {
    return {
      ok: false,
      error: params.all
        ? "No tracked plugins to update."
        : "Provide a plugin id, npm spec, or use `all`.",
    };
  }

  const logs: string[] = [];
  const updateResult = await updateNpmInstalledPlugins({
    config: withPluginInstallRecords(structuredClone(params.snapshot.config), installRecords),
    pluginIds: selection.pluginIds,
    specOverrides: selection.specOverrides,
    dryRun: params.dryRun,
    logger: {
      info: (message) => logs.push(message),
      warn: (message) => logs.push(`Warning: ${message}`),
      error: (message) => logs.push(`Error: ${message}`),
    },
    onIntegrityDrift: () => false,
  });

  let hasErrors = false;
  const outcomeLines = updateResult.outcomes.map((outcome) => {
    if (outcome.status === "error") {
      hasErrors = true;
    }
    return outcome.message;
  });

  if (!params.dryRun && updateResult.changed) {
    const nextInstallRecords = updateResult.config.plugins?.installs ?? {};
    const nextConfig = withoutPluginInstallRecords(updateResult.config);
    await commitPluginInstallRecordsWithConfig({
      previousInstallRecords: installRecords,
      nextInstallRecords,
      nextConfig,
      baseHash: params.snapshot.baseHash,
    });
    await refreshPluginRegistryAfterConfigMutation({
      config: nextConfig,
      reason: "source-changed",
      installRecords: nextInstallRecords,
      logger: {
        warn: (message) => logs.push(`Warning: ${message}`),
      },
    });
    outcomeLines.push("Restart the gateway to load updated plugins.");
  }

  const title = params.dryRun ? "🔌 Plugin update dry run" : "🔌 Plugin update";
  const body = [...logs, ...outcomeLines].filter(Boolean).join("\n");
  if (hasErrors) {
    return { ok: false, error: body || "Plugin update failed." };
  }
  return { ok: true, text: body ? `${title}\n${body}` : `${title}\nNo plugin update output.` };
}

async function loadPluginCommandState(
  workspaceDir: string,
  options?: { loadModules?: boolean },
): Promise<
  | {
      ok: true;
      path: string;
      config: KovaConfig;
      report: PluginStatusReport;
    }
  | { ok: false; path: string; error: string }
> {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    return {
      ok: false,
      path: snapshot.path,
      error: "Config file is invalid; fix it before using /plugins.",
    };
  }
  const config = structuredClone(snapshot.resolved);
  return {
    ok: true,
    path: snapshot.path,
    config,
    report:
      options?.loadModules === true
        ? buildPluginDiagnosticsReport({ config, workspaceDir })
        : buildPluginRegistrySnapshotReport({ config, workspaceDir }),
  };
}

async function loadPluginCommandConfig(): Promise<
  | { ok: true; path: string; snapshot: ConfigSnapshotForInstallPersist }
  | { ok: false; path: string; error: string }
> {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    return {
      ok: false,
      path: snapshot.path,
      error: "Config file is invalid; fix it before using /plugins.",
    };
  }
  return {
    ok: true,
    path: snapshot.path,
    snapshot: {
      config: structuredClone(snapshot.sourceConfig),
      baseHash: snapshot.hash,
    },
  };
}

export const handlePluginsCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const pluginsCommand = parsePluginsCommand(params.command.commandBodyNormalized);
  if (!pluginsCommand) {
    return null;
  }
  const unauthorized = rejectUnauthorizedCommand(params, "/plugins");
  if (unauthorized) {
    return unauthorized;
  }
  const allowInternalReadOnly =
    (pluginsCommand.action === "list" || pluginsCommand.action === "inspect") &&
    isInternalMessageChannel(params.command.channel);
  const nonOwner = allowInternalReadOnly ? null : rejectNonOwnerCommand(params, "/plugins");
  if (nonOwner) {
    return nonOwner;
  }
  const disabled = requireCommandFlagEnabled(params.cfg, {
    label: "/plugins",
    configKey: "plugins",
  });
  if (disabled) {
    return disabled;
  }
  if (pluginsCommand.action === "error") {
    return {
      shouldContinue: false,
      reply: { text: `⚠️ ${pluginsCommand.message}` },
    };
  }

  if (
    pluginsCommand.action === "install" ||
    pluginsCommand.action === "update" ||
    pluginsCommand.action === "enable" ||
    pluginsCommand.action === "disable"
  ) {
    const missingAdminScope = requireGatewayClientScope(params, {
      label: "/plugins write",
      allowedScopes: ["operator.admin"],
      missingText:
        "❌ /plugins install|update|enable|disable requires operator.admin for gateway clients.",
    });
    if (missingAdminScope) {
      return missingAdminScope;
    }
  }

  if (pluginsCommand.action === "install") {
    const loadedConfig = await loadPluginCommandConfig();
    if (!loadedConfig.ok) {
      return {
        shouldContinue: false,
        reply: { text: `⚠️ ${loadedConfig.error}` },
      };
    }
    const installed = await installPluginFromPluginsCommand({
      raw: pluginsCommand.spec,
      snapshot: loadedConfig.snapshot,
    });
    if (!installed.ok) {
      return {
        shouldContinue: false,
        reply: { text: `⚠️ ${installed.error}` },
      };
    }
    return {
      shouldContinue: false,
      reply: {
        text: `🔌 Installed plugin "${installed.pluginId}". Restart the gateway to load plugins.`,
      },
    };
  }

  if (pluginsCommand.action === "update") {
    const loadedConfig = await loadPluginCommandConfig();
    if (!loadedConfig.ok) {
      return {
        shouldContinue: false,
        reply: { text: `⚠️ ${loadedConfig.error}` },
      };
    }
    const updated = await updatePluginsFromPluginsCommand({
      id: pluginsCommand.name,
      all: pluginsCommand.all,
      dryRun: pluginsCommand.dryRun,
      snapshot: loadedConfig.snapshot,
    });
    if (!updated.ok) {
      return {
        shouldContinue: false,
        reply: { text: `⚠️ ${updated.error}` },
      };
    }
    return {
      shouldContinue: false,
      reply: {
        text: updated.text,
      },
    };
  }

  const loaded = await loadPluginCommandState(params.workspaceDir, {
    loadModules: pluginsCommand.action === "inspect",
  });
  if (!loaded.ok) {
    return {
      shouldContinue: false,
      reply: { text: `⚠️ ${loaded.error}` },
    };
  }

  if (pluginsCommand.action === "list") {
    return {
      shouldContinue: false,
      reply: { text: formatPluginsList(loaded.report) },
    };
  }

  if (pluginsCommand.action === "inspect") {
    const installRecords = await loadInstalledPluginIndexInstallRecords();
    if (!pluginsCommand.name) {
      return {
        shouldContinue: false,
        reply: { text: formatPluginsList(loaded.report) },
      };
    }
    if (normalizeOptionalLowercaseString(pluginsCommand.name) === "all") {
      return {
        shouldContinue: false,
        reply: {
          text: renderJsonBlock(
            "🔌 Plugins",
            buildAllPluginInspectJson({ ...loaded, installRecords }),
          ),
        },
      };
    }
    const payload = buildPluginInspectJson({
      id: pluginsCommand.name,
      config: loaded.config,
      installRecords,
      report: loaded.report,
    });
    if (!payload) {
      return {
        shouldContinue: false,
        reply: { text: `🔌 No plugin named "${pluginsCommand.name}" found.` },
      };
    }
    return {
      shouldContinue: false,
      reply: {
        text: renderJsonBlock(`🔌 Plugin "${payload.inspect.plugin.id}"`, {
          ...payload.inspect,
          compatibilityWarnings: payload.compatibilityWarnings,
          install: payload.install,
        }),
      },
    };
  }

  const plugin = findPlugin(loaded.report, pluginsCommand.name);
  if (!plugin) {
    return {
      shouldContinue: false,
      reply: { text: `🔌 No plugin named "${pluginsCommand.name}" found.` },
    };
  }

  const next = setPluginEnabledInConfig(
    structuredClone(loaded.config),
    plugin.id,
    pluginsCommand.action === "enable",
  );
  const validated = validateConfigObjectWithPlugins(next);
  if (!validated.ok) {
    const issue = validated.issues[0];
    return {
      shouldContinue: false,
      reply: {
        text: `⚠️ Config invalid after /plugins ${pluginsCommand.action} (${issue.path}: ${issue.message}).`,
      },
    };
  }
  await replaceConfigFile({
    nextConfig: validated.config,
    afterWrite: { mode: "auto" },
  });
  let registryWarning: string | undefined;
  await refreshPluginRegistryAfterConfigMutation({
    config: validated.config,
    reason: "policy-changed",
    logger: {
      warn: (message) => {
        registryWarning = message;
      },
    },
  });

  return {
    shouldContinue: false,
    reply: {
      text:
        `🔌 Plugin "${plugin.id}" ${pluginsCommand.action}d in ${loaded.path}. Restart the gateway to apply.` +
        (registryWarning ? `\n${registryWarning}` : ""),
    },
  };
};
