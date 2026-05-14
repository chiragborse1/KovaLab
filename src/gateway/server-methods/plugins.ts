import { formatCliCommand } from "../../cli/command-format.js";
import {
  applySlotSelectionForPlugin,
  buildPreferredClawHubSpec,
  parseNpmPrefixSpec,
} from "../../cli/plugins-command-helpers.js";
import { commitPluginInstallRecordsWithConfig } from "../../cli/plugins-install-record-commit.js";
import { refreshPluginRegistryAfterConfigMutation } from "../../cli/plugins-registry-refresh.js";
import { readConfigFileSnapshot, replaceConfigFile } from "../../config/config.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { parseClawHubPluginSpec } from "../../infra/clawhub.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { installPluginFromClawHub } from "../../plugins/clawhub.js";
import { enablePluginInConfig } from "../../plugins/enable.js";
import { installPluginFromNpmSpec, type InstallPluginResult } from "../../plugins/install.js";
import {
  loadInstalledPluginIndexInstallRecords,
  removePluginInstallRecordFromRecords,
  withoutPluginInstallRecords,
  withPluginInstallRecords,
} from "../../plugins/installed-plugin-index-records.js";
import { buildNpmResolutionInstallFields, recordPluginInstall } from "../../plugins/installs.js";
import type { PluginDiagnostic } from "../../plugins/manifest-types.js";
import { resolveOfficialExternalPluginNpmSpec } from "../../plugins/official-external-plugin-catalog.js";
import type { PluginRegistrySnapshotDiagnostic } from "../../plugins/plugin-registry.js";
import type { PluginRecord } from "../../plugins/registry.js";
import { buildPluginRegistrySnapshotReport } from "../../plugins/status.js";
import { setPluginEnabledInConfig } from "../../plugins/toggle-config.js";
import {
  applyPluginUninstallDirectoryRemoval,
  planPluginUninstall,
} from "../../plugins/uninstall.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validatePluginsInstallParams,
  validatePluginsSetEnabledParams,
  validatePluginsStatusParams,
  validatePluginsUninstallParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export type PluginStatusSummary = {
  id: string;
  name: string;
  enabled: boolean;
  status: "loaded" | "disabled" | "error";
  origin: string;
  format: string;
  bundleFormat?: string;
  kind?: string;
  version?: string;
  description?: string;
  channelIds: string[];
  providerIds: string[];
  toolNames: string[];
  gatewayMethods: string[];
  services: string[];
  commands: string[];
  configSchema: boolean;
  installed: boolean;
  configured: boolean;
  removable: boolean;
  error?: string;
};

export type PluginStatusDiagnostic = {
  level: "info" | "warn" | "error";
  message: string;
  code?: string;
  pluginId?: string;
  source?: string;
};

export type PluginsStatusResult = {
  registrySource: "provided" | "persisted" | "derived";
  plugins: PluginStatusSummary[];
  diagnostics: PluginStatusDiagnostic[];
  totals: {
    total: number;
    enabled: number;
    disabled: number;
    errors: number;
    channels: number;
    providers: number;
  };
};

export type PluginsMutationResult = {
  ok: true;
  pluginId: string;
  message: string;
  restartRequired: true;
  warnings: string[];
  status: PluginsStatusResult;
};

export type PluginsInstallResult = {
  ok: true;
  pluginId: string;
  message: string;
  restartRequired: true;
  logs: string[];
  status: PluginsStatusResult;
};

function sortStrings(values: readonly string[] | undefined): string[] {
  return [...(values ?? [])].sort((a, b) => a.localeCompare(b));
}

function summarizePlugin(plugin: PluginRecord, config: OpenClawConfig): PluginStatusSummary {
  const installed = Object.hasOwn(config.plugins?.installs ?? {}, plugin.id);
  const configured = Object.hasOwn(config.plugins?.entries ?? {}, plugin.id);
  return {
    id: plugin.id,
    name: plugin.name,
    enabled: plugin.enabled,
    status: plugin.status,
    origin: plugin.origin,
    format: plugin.format,
    ...(plugin.bundleFormat ? { bundleFormat: plugin.bundleFormat } : {}),
    ...(plugin.kind ? { kind: plugin.kind } : {}),
    ...(plugin.version ? { version: plugin.version } : {}),
    ...(plugin.description ? { description: plugin.description } : {}),
    channelIds: sortStrings(plugin.channelIds),
    providerIds: sortStrings(plugin.providerIds),
    toolNames: sortStrings(plugin.toolNames),
    gatewayMethods: sortStrings(plugin.gatewayMethods),
    services: sortStrings(plugin.services),
    commands: sortStrings(plugin.commands),
    configSchema: plugin.configSchema,
    installed,
    configured,
    removable: installed || configured,
    ...(plugin.error ? { error: plugin.error } : {}),
  };
}

function summarizeDiagnostics(params: {
  diagnostics: readonly PluginDiagnostic[];
  registryDiagnostics: readonly PluginRegistrySnapshotDiagnostic[];
}): PluginStatusDiagnostic[] {
  return [
    ...params.registryDiagnostics.map(
      (entry): PluginStatusDiagnostic => ({
        level: entry.level,
        code: entry.code,
        message: entry.message,
      }),
    ),
    ...params.diagnostics.map(
      (entry): PluginStatusDiagnostic => ({
        level: entry.level,
        message: entry.message,
        ...(entry.pluginId ? { pluginId: entry.pluginId } : {}),
        ...(entry.source ? { source: entry.source } : {}),
      }),
    ),
  ];
}

export function createPluginsStatusResult(config: OpenClawConfig): PluginsStatusResult {
  const report = buildPluginRegistrySnapshotReport({ config });
  const plugins = report.plugins
    .map((plugin) => summarizePlugin(plugin, config))
    .sort((a, b) => a.id.localeCompare(b.id));
  const totals = plugins.reduce<PluginsStatusResult["totals"]>(
    (acc, plugin) => {
      acc.total += 1;
      if (plugin.enabled) {
        acc.enabled += 1;
      } else {
        acc.disabled += 1;
      }
      if (plugin.status === "error") {
        acc.errors += 1;
      }
      if (plugin.channelIds.length > 0) {
        acc.channels += 1;
      }
      if (plugin.providerIds.length > 0) {
        acc.providers += 1;
      }
      return acc;
    },
    {
      total: 0,
      enabled: 0,
      disabled: 0,
      errors: 0,
      channels: 0,
      providers: 0,
    },
  );
  return {
    registrySource: report.registrySource,
    plugins,
    diagnostics: summarizeDiagnostics({
      diagnostics: report.diagnostics,
      registryDiagnostics: report.registryDiagnostics,
    }),
    totals,
  };
}

async function persistPluginEnablement(params: {
  config: OpenClawConfig;
  pluginId: string;
  enabled: boolean;
}): Promise<{ config: OpenClawConfig; enabled: boolean; warnings: string[]; reason?: string }> {
  if (params.enabled) {
    const enableResult = enablePluginInConfig(params.config, params.pluginId);
    const slotResult = applySlotSelectionForPlugin(enableResult.config, params.pluginId);
    await replaceConfigFile({ nextConfig: slotResult.config });
    await refreshPluginRegistryAfterConfigMutation({
      config: slotResult.config,
      reason: "policy-changed",
    });
    return {
      config: slotResult.config,
      enabled: enableResult.enabled,
      warnings: slotResult.warnings,
      ...(enableResult.reason ? { reason: enableResult.reason } : {}),
    };
  }

  const next = setPluginEnabledInConfig(params.config, params.pluginId, false);
  await replaceConfigFile({ nextConfig: next });
  await refreshPluginRegistryAfterConfigMutation({
    config: next,
    reason: "policy-changed",
  });
  return { config: next, enabled: false, warnings: [] };
}

function normalizeInstallSpec(raw: string): string {
  const trimmed = raw.trim();
  const npmPrefix = parseNpmPrefixSpec(trimmed);
  if (npmPrefix !== null) {
    return npmPrefix;
  }
  return resolveOfficialExternalPluginNpmSpec(trimmed) ?? trimmed;
}

function createPluginInstallLogger(logs: string[]): {
  info: (message: string) => void;
  warn: (message: string) => void;
} {
  return {
    info: (message) => logs.push(message),
    warn: (message) => logs.push(`Warning: ${message}`),
  };
}

function resolveInstallRecord(params: {
  spec: string;
  targetDir: string;
  version?: string;
  npmResolution?: Extract<InstallPluginResult, { ok: true }>["npmResolution"];
  pin?: boolean;
}) {
  const resolved = buildNpmResolutionInstallFields(params.npmResolution);
  const spec =
    params.pin && resolved.resolvedSpec ? resolved.resolvedSpec : params.npmResolution?.rawSpec;
  return {
    source: "npm" as const,
    spec: spec ?? params.spec,
    installPath: params.targetDir,
    ...(params.version ? { version: params.version } : {}),
    ...resolved,
  };
}

async function installPluginFromSpec(params: {
  config: OpenClawConfig;
  baseHash?: string;
  rawSpec: string;
  force?: boolean;
  pin?: boolean;
  dangerouslyForceUnsafeInstall?: boolean;
}): Promise<{ pluginId: string; config: OpenClawConfig; logs: string[] }> {
  const logs: string[] = [];
  const mode = params.force ? "update" : "install";
  const logger = createPluginInstallLogger(logs);
  const spec = normalizeInstallSpec(params.rawSpec);
  const installRecords = await loadInstalledPluginIndexInstallRecords();

  let install:
    | (Extract<InstallPluginResult, { ok: true }> & {
        installRecord: ReturnType<typeof resolveInstallRecord>;
      })
    | null = null;

  const clawhubSpec = parseClawHubPluginSpec(spec) ? spec : buildPreferredClawHubSpec(spec);
  if (clawhubSpec) {
    logs.push(`Trying ClawHub package ${clawhubSpec}...`);
    const clawhubResult = await installPluginFromClawHub({
      dangerouslyForceUnsafeInstall: params.dangerouslyForceUnsafeInstall,
      mode,
      spec: clawhubSpec,
      logger,
    });
    if (clawhubResult.ok) {
      install = {
        ...clawhubResult,
        installRecord: {
          source: "clawhub" as const,
          spec: clawhubSpec,
          installPath: clawhubResult.targetDir,
          ...(clawhubResult.version ? { version: clawhubResult.version } : {}),
          integrity: clawhubResult.clawhub.integrity,
          resolvedAt: clawhubResult.clawhub.resolvedAt,
          clawhubUrl: clawhubResult.clawhub.clawhubUrl,
          clawhubPackage: clawhubResult.clawhub.clawhubPackage,
          clawhubFamily: clawhubResult.clawhub.clawhubFamily,
          ...(clawhubResult.clawhub.clawhubChannel
            ? { clawhubChannel: clawhubResult.clawhub.clawhubChannel }
            : {}),
        },
      };
    } else if (parseClawHubPluginSpec(spec)) {
      throw new Error(clawhubResult.error);
    } else {
      logs.push(`ClawHub fallback unavailable: ${clawhubResult.error}`);
    }
  }

  if (!install) {
    logs.push(`Downloading ${spec}...`);
    const npmResult = await installPluginFromNpmSpec({
      dangerouslyForceUnsafeInstall: params.dangerouslyForceUnsafeInstall,
      mode,
      spec,
      logger,
    });
    if (!npmResult.ok) {
      throw new Error(npmResult.error);
    }
    install = {
      ...npmResult,
      installRecord: resolveInstallRecord({
        spec,
        targetDir: npmResult.targetDir,
        version: npmResult.version,
        npmResolution: npmResult.npmResolution,
        pin: params.pin,
      }),
    };
  }

  let next = recordPluginInstall(params.config, {
    pluginId: install.pluginId,
    ...install.installRecord,
  });
  next = enablePluginInConfig(next, install.pluginId, { updateChannelConfig: false }).config;
  const slotResult = applySlotSelectionForPlugin(next, install.pluginId);
  next = withoutPluginInstallRecords(slotResult.config);
  const nextInstallRecords = {
    ...installRecords,
    [install.pluginId]: install.installRecord,
  };
  await commitPluginInstallRecordsWithConfig({
    previousInstallRecords: installRecords,
    nextInstallRecords,
    nextConfig: next,
    baseHash: params.baseHash,
  });
  await refreshPluginRegistryAfterConfigMutation({
    config: next,
    reason: "source-changed",
    installRecords: nextInstallRecords,
  });

  return {
    pluginId: install.pluginId,
    config: next,
    logs: [...logs, ...slotResult.warnings],
  };
}

function pluginMutationMessage(pluginId: string, enabled: boolean, reason?: string): string {
  if (enabled) {
    return `Enabled plugin "${pluginId}". Restart the gateway to apply runtime changes.`;
  }
  if (reason) {
    return `Plugin "${pluginId}" could not be enabled (${reason}).`;
  }
  return `Disabled plugin "${pluginId}". Restart the gateway to apply runtime changes.`;
}

export const pluginsHandlers: GatewayRequestHandlers = {
  "plugins.status": ({ params, respond, context }) => {
    if (!validatePluginsStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid plugins.status params: ${formatValidationErrors(validatePluginsStatusParams.errors)}`,
        ),
      );
      return;
    }
    try {
      respond(true, createPluginsStatusResult(context.getRuntimeConfig()), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatErrorMessage(err)));
    }
  },
  "plugins.setEnabled": async ({ params, respond, context }) => {
    if (!validatePluginsSetEnabledParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid plugins.setEnabled params: ${formatValidationErrors(validatePluginsSetEnabledParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const result = await persistPluginEnablement({
        config: context.getRuntimeConfig(),
        pluginId: params.pluginId,
        enabled: params.enabled,
      });
      const effectiveEnabled = params.enabled ? result.enabled : false;
      respond(
        true,
        {
          ok: true,
          pluginId: params.pluginId,
          message: pluginMutationMessage(params.pluginId, effectiveEnabled, result.reason),
          restartRequired: true,
          warnings: result.warnings,
          status: createPluginsStatusResult(result.config),
        } satisfies PluginsMutationResult,
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatErrorMessage(err)));
    }
  },
  "plugins.uninstall": async ({ params, respond }) => {
    if (!validatePluginsUninstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid plugins.uninstall params: ${formatValidationErrors(validatePluginsUninstallParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const snapshot = await readConfigFileSnapshot();
      const installRecords = await loadInstalledPluginIndexInstallRecords();
      const sourceConfig = (snapshot.sourceConfig ?? snapshot.config) as OpenClawConfig;
      const config = withPluginInstallRecords(sourceConfig, installRecords);
      const report = buildPluginRegistrySnapshotReport({ config });
      const plugin = report.plugins.find((entry) => entry.id === params.pluginId);
      const plan = planPluginUninstall({
        config,
        pluginId: params.pluginId,
        channelIds: plugin?.channelIds,
        deleteFiles: params.deleteFiles !== false,
      });
      if (!plan.ok) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, plan.error));
        return;
      }
      const nextInstallRecords = removePluginInstallRecordFromRecords(
        installRecords,
        params.pluginId,
      );
      const nextConfig = withoutPluginInstallRecords(plan.config);
      await commitPluginInstallRecordsWithConfig({
        previousInstallRecords: installRecords,
        nextInstallRecords,
        nextConfig,
        ...(snapshot.hash !== undefined ? { baseHash: snapshot.hash } : {}),
      });
      const directory = await applyPluginUninstallDirectoryRemoval(plan.directoryRemoval);
      await refreshPluginRegistryAfterConfigMutation({
        config: nextConfig,
        reason: "source-changed",
        installRecords: nextInstallRecords,
      });
      respond(
        true,
        {
          ok: true,
          pluginId: params.pluginId,
          message: `Uninstalled plugin "${params.pluginId}". Restart the gateway to apply runtime changes.`,
          restartRequired: true,
          warnings: directory.warnings,
          status: createPluginsStatusResult(nextConfig),
        } satisfies PluginsMutationResult,
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatErrorMessage(err)));
    }
  },
  "plugins.install": async ({ params, respond }) => {
    if (!validatePluginsInstallParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid plugins.install params: ${formatValidationErrors(validatePluginsInstallParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const snapshot = await readConfigFileSnapshot();
      const sourceConfig = (snapshot.sourceConfig ?? snapshot.config) as OpenClawConfig;
      const result = await installPluginFromSpec({
        config: sourceConfig,
        ...(snapshot.hash !== undefined ? { baseHash: snapshot.hash } : {}),
        rawSpec: params.spec,
        force: params.force,
        pin: params.pin,
        dangerouslyForceUnsafeInstall: params.dangerouslyForceUnsafeInstall,
      });
      respond(
        true,
        {
          ok: true,
          pluginId: result.pluginId,
          message: `Installed plugin "${result.pluginId}". Restart the gateway to load it. If the package already exists, use ${formatCliCommand("kova plugins update")} or install with force.`,
          restartRequired: true,
          logs: result.logs,
          status: createPluginsStatusResult(result.config),
        } satisfies PluginsInstallResult,
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatErrorMessage(err)));
    }
  },
};
