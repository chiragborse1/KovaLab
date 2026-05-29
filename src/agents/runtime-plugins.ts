import type { KovaConfig } from "../config/types.kova.js";
import { getCurrentPluginMetadataSnapshot } from "../plugins/current-plugin-metadata-snapshot.js";
import { loadPluginLookUpTable } from "../plugins/plugin-lookup-table.js";
import { getActivePluginRuntimeSubagentMode } from "../plugins/runtime.js";
import { ensureStandaloneRuntimePluginRegistryLoaded } from "../plugins/runtime/standalone-runtime-registry-loader.js";
import { resolveUserPath } from "../utils.js";

type StartupScopedPluginSnapshot = NonNullable<
  ReturnType<typeof getCurrentPluginMetadataSnapshot>
> & {
  startup?: {
    pluginIds?: readonly unknown[];
  };
};

function resolveStartupPluginIdsFromCurrentSnapshot(params: {
  config?: KovaConfig;
  workspaceDir?: string;
}): string[] | undefined {
  const snapshot = getCurrentPluginMetadataSnapshot({
    config: params.config,
    workspaceDir: params.workspaceDir,
  }) as StartupScopedPluginSnapshot | undefined;
  const pluginIds = snapshot?.startup?.pluginIds;
  if (!Array.isArray(pluginIds)) {
    return undefined;
  }
  return pluginIds.filter((pluginId): pluginId is string => typeof pluginId === "string");
}

function resolveStartupPluginIds(params: {
  config?: KovaConfig;
  workspaceDir?: string;
}): string[] | undefined {
  const fromSnapshot = resolveStartupPluginIdsFromCurrentSnapshot(params);
  if (fromSnapshot) {
    return fromSnapshot;
  }
  if (!params.config) {
    return undefined;
  }
  return [
    ...loadPluginLookUpTable({
      config: params.config,
      activationSourceConfig: params.config,
      workspaceDir: params.workspaceDir,
      env: process.env,
      metadataSnapshot: getCurrentPluginMetadataSnapshot({
        config: params.config,
        workspaceDir: params.workspaceDir,
      }),
    }).startup.pluginIds,
  ];
}

export function ensureRuntimePluginsLoaded(params: {
  config?: KovaConfig;
  workspaceDir?: string | null;
  allowGatewaySubagentBinding?: boolean;
}): void {
  const workspaceDir =
    typeof params.workspaceDir === "string" && params.workspaceDir.trim()
      ? resolveUserPath(params.workspaceDir)
      : undefined;
  const startupPluginIds = resolveStartupPluginIds({
    config: params.config,
    workspaceDir,
  });
  const allowGatewaySubagentBinding =
    params.allowGatewaySubagentBinding === true ||
    getActivePluginRuntimeSubagentMode() === "gateway-bindable";
  ensureStandaloneRuntimePluginRegistryLoaded({
    requiredPluginIds: startupPluginIds,
    loadOptions: {
      config: params.config,
      workspaceDir,
      ...(startupPluginIds === undefined ? {} : { onlyPluginIds: startupPluginIds }),
      runtimeOptions: allowGatewaySubagentBinding
        ? {
            allowGatewaySubagentBinding: true,
          }
        : undefined,
    },
  });
}
