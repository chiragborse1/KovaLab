import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { formatErrorMessage } from "../../infra/errors.js";
import type { PluginDiagnostic } from "../../plugins/manifest-types.js";
import type { PluginRegistrySnapshotDiagnostic } from "../../plugins/plugin-registry.js";
import type { PluginRecord } from "../../plugins/registry.js";
import { buildPluginRegistrySnapshotReport } from "../../plugins/status.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validatePluginsStatusParams,
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

function sortStrings(values: readonly string[] | undefined): string[] {
  return [...(values ?? [])].sort((a, b) => a.localeCompare(b));
}

function summarizePlugin(plugin: PluginRecord): PluginStatusSummary {
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
  const plugins = report.plugins.map(summarizePlugin).sort((a, b) => a.id.localeCompare(b.id));
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
};
