import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { initSubagentRegistry } from "../agents/subagent-registry.js";
import { applyPluginAutoEnable } from "../config/plugin-auto-enable.js";
import type { KovaConfig } from "../config/types.kova.js";
import { resolveKovaPackageRootSync } from "../infra/kova-root.js";
import {
  repairBundledRuntimeDepsInstallRootAsync,
  resolveBundledRuntimeDependencyPackageInstallRoot,
  scanBundledPluginRuntimeDeps,
} from "../plugins/bundled-runtime-deps.js";
import { loadPluginLookUpTable } from "../plugins/plugin-lookup-table.js";
import { createEmptyPluginRegistry } from "../plugins/registry.js";
import { getActivePluginRegistry, setActivePluginRegistry } from "../plugins/runtime.js";
import { listGatewayMethods } from "./server-methods-list.js";
import type { loadGatewayStartupPlugins } from "./server-plugin-bootstrap.js";

type GatewayPluginBootstrapLog = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
};

async function prestageGatewayBundledRuntimeDeps(params: {
  cfg: KovaConfig;
  pluginIds: readonly string[];
  log: GatewayPluginBootstrapLog;
}): Promise<void> {
  if (params.pluginIds.length === 0) {
    return;
  }
  const packageRoot = resolveKovaPackageRootSync({
    argv1: process.argv[1],
    cwd: process.cwd(),
    moduleUrl: import.meta.url,
  });
  if (!packageRoot) {
    return;
  }
  let scanResult: ReturnType<typeof scanBundledPluginRuntimeDeps>;
  try {
    scanResult = scanBundledPluginRuntimeDeps({
      packageRoot,
      config: params.cfg,
      selectedPluginIds: [...params.pluginIds],
      env: process.env,
    });
  } catch (error) {
    params.log.warn(
      `[plugins] failed to scan bundled runtime deps before plugin runtime load; gateway startup will continue with per-plugin runtime-deps installs: ${String(error)}`,
    );
    return;
  }
  const { deps, missing, conflicts } = scanResult;
  if (conflicts.length > 0) {
    params.log.warn(
      `[plugins] bundled runtime deps have version conflicts: ${conflicts.map((conflict) => `${conflict.name} (${conflict.versions.join(", ")})`).join("; ")}`,
    );
  }
  if (missing.length === 0) {
    return;
  }
  const missingSpecs = missing.map((dep) => `${dep.name}@${dep.version}`);
  const installSpecs = deps.map((dep) => `${dep.name}@${dep.version}`);
  const installRoot = resolveBundledRuntimeDependencyPackageInstallRoot(packageRoot, {
    env: process.env,
  });
  const startedAt = Date.now();
  params.log.info(
    `[plugins] staging bundled runtime deps before plugin runtime load (${missingSpecs.length} missing, ${installSpecs.length} install specs): ${missingSpecs.join(", ")}`,
  );
  try {
    await repairBundledRuntimeDepsInstallRootAsync({
      installRoot,
      missingSpecs,
      installSpecs,
      env: process.env,
      warn: (message) => params.log.warn(`[plugins] ${message}`),
    });
  } catch (error) {
    params.log.warn(
      `[plugins] failed to stage bundled runtime deps before plugin runtime load after ${Date.now() - startedAt}ms; gateway startup will continue with per-plugin runtime-deps installs: ${String(error)}`,
    );
    return;
  }
  params.log.info(
    `[plugins] installed bundled runtime deps before plugin runtime load in ${Date.now() - startedAt}ms: ${missingSpecs.join(", ")}`,
  );
}

export type GatewayStartupPluginRuntimeLoadResult = ReturnType<typeof loadGatewayStartupPlugins>;

export async function loadGatewayStartupPluginRuntime(params: {
  cfg: KovaConfig;
  activationSourceConfig?: KovaConfig;
  workspaceDir: string;
  log: GatewayPluginBootstrapLog;
  baseMethods: string[];
  startupPluginIds: string[];
  pluginLookUpTable?: ReturnType<typeof loadPluginLookUpTable>;
  preferSetupRuntimeForChannelPlugins?: boolean;
  suppressPluginInfoLogs?: boolean;
  logDiagnostics?: boolean;
}): Promise<GatewayStartupPluginRuntimeLoadResult> {
  await prestageGatewayBundledRuntimeDeps({
    cfg: params.cfg,
    pluginIds: params.startupPluginIds,
    log: params.log,
  });
  const { loadGatewayStartupPlugins } = await import("./server-plugin-bootstrap.js");
  return loadGatewayStartupPlugins({
    cfg: params.cfg,
    activationSourceConfig: params.activationSourceConfig,
    workspaceDir: params.workspaceDir,
    log: params.log,
    coreGatewayMethodNames: params.baseMethods,
    baseMethods: params.baseMethods,
    pluginIds: params.startupPluginIds,
    pluginLookUpTable: params.pluginLookUpTable,
    preferSetupRuntimeForChannelPlugins: params.preferSetupRuntimeForChannelPlugins,
    suppressPluginInfoLogs: params.suppressPluginInfoLogs,
    logDiagnostics: params.logDiagnostics,
  });
}

export async function prepareGatewayPluginBootstrap(params: {
  cfgAtStart: KovaConfig;
  startupRuntimeConfig: KovaConfig;
  minimalTestGateway: boolean;
  loadRuntimePlugins?: boolean;
  log: GatewayPluginBootstrapLog;
}) {
  const startupMaintenanceConfig =
    params.cfgAtStart.channels === undefined && params.startupRuntimeConfig.channels !== undefined
      ? {
          ...params.cfgAtStart,
          channels: params.startupRuntimeConfig.channels,
        }
      : params.cfgAtStart;

  const shouldRunStartupMaintenance =
    !params.minimalTestGateway || startupMaintenanceConfig.channels !== undefined;
  if (shouldRunStartupMaintenance) {
    const [{ runChannelPluginStartupMaintenance }, { runStartupSessionMigration }] =
      await Promise.all([
        import("../channels/plugins/lifecycle-startup.js"),
        import("./server-startup-session-migration.js"),
      ]);
    const startupTasks = [
      runChannelPluginStartupMaintenance({
        cfg: startupMaintenanceConfig,
        env: process.env,
        log: params.log,
      }),
    ];
    if (!params.minimalTestGateway) {
      startupTasks.push(
        runStartupSessionMigration({
          cfg: params.cfgAtStart,
          env: process.env,
          log: params.log,
        }),
      );
    }
    await Promise.all(startupTasks);
  }

  initSubagentRegistry();

  const gatewayPluginConfig = params.minimalTestGateway
    ? params.cfgAtStart
    : applyPluginAutoEnable({
        config: params.cfgAtStart,
        env: process.env,
      }).config;
  const defaultAgentId = resolveDefaultAgentId(gatewayPluginConfig);
  const defaultWorkspaceDir = resolveAgentWorkspaceDir(gatewayPluginConfig, defaultAgentId);
  const pluginLookUpTable = params.minimalTestGateway
    ? undefined
    : loadPluginLookUpTable({
        config: gatewayPluginConfig,
        workspaceDir: defaultWorkspaceDir,
        env: process.env,
        activationSourceConfig: params.cfgAtStart,
      });
  const deferredConfiguredChannelPluginIds = [
    ...(pluginLookUpTable?.startup.configuredDeferredChannelPluginIds ?? []),
  ];
  const startupPluginIds = [...(pluginLookUpTable?.startup.pluginIds ?? [])];

  const baseMethods = listGatewayMethods();
  const emptyPluginRegistry = createEmptyPluginRegistry();
  let pluginRegistry = emptyPluginRegistry;
  let baseGatewayMethods = baseMethods;
  let runtimePluginsLoaded = false;

  if (!params.minimalTestGateway && params.loadRuntimePlugins !== false) {
    ({ pluginRegistry, gatewayMethods: baseGatewayMethods } = await loadGatewayStartupPluginRuntime(
      {
        cfg: gatewayPluginConfig,
        activationSourceConfig: params.cfgAtStart,
        workspaceDir: defaultWorkspaceDir,
        log: params.log,
        baseMethods,
        startupPluginIds,
        pluginLookUpTable,
        preferSetupRuntimeForChannelPlugins: deferredConfiguredChannelPluginIds.length > 0,
        suppressPluginInfoLogs: deferredConfiguredChannelPluginIds.length > 0,
      },
    ));
    runtimePluginsLoaded = true;
  } else if (!params.minimalTestGateway) {
    setActivePluginRegistry(pluginRegistry);
  } else {
    pluginRegistry = getActivePluginRegistry() ?? emptyPluginRegistry;
    setActivePluginRegistry(pluginRegistry);
  }

  return {
    gatewayPluginConfigAtStart: gatewayPluginConfig,
    defaultWorkspaceDir,
    deferredConfiguredChannelPluginIds,
    startupPluginIds,
    pluginLookUpTable,
    baseMethods,
    pluginRegistry,
    baseGatewayMethods,
    runtimePluginsLoaded,
  };
}
