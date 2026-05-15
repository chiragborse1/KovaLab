import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { PluginManifestRecord, PluginManifestRegistry } from "./manifest-registry.js";
import type { PluginDiagnostic } from "./manifest-types.js";
import { type PluginRegistrySnapshot, type PluginRegistrySnapshotDiagnostic } from "./plugin-registry-snapshot.js";
export type PluginLookUpTableOwnerMaps = {
    channels: ReadonlyMap<string, readonly string[]>;
    channelConfigs: ReadonlyMap<string, readonly string[]>;
    providers: ReadonlyMap<string, readonly string[]>;
    modelCatalogProviders: ReadonlyMap<string, readonly string[]>;
    cliBackends: ReadonlyMap<string, readonly string[]>;
    setupProviders: ReadonlyMap<string, readonly string[]>;
    commandAliases: ReadonlyMap<string, readonly string[]>;
    contracts: ReadonlyMap<string, readonly string[]>;
};
export type PluginLookUpTableStartupPlan = {
    channelPluginIds: readonly string[];
    configuredDeferredChannelPluginIds: readonly string[];
    pluginIds: readonly string[];
};
export type PluginLookUpTableMetrics = {
    registrySnapshotMs: number;
    manifestRegistryMs: number;
    startupPlanMs: number;
    ownerMapsMs: number;
    totalMs: number;
    indexPluginCount: number;
    manifestPluginCount: number;
    startupPluginCount: number;
    deferredChannelPluginCount: number;
};
export type PluginLookUpTable = {
    key: string;
    index: PluginRegistrySnapshot;
    registryDiagnostics: readonly PluginRegistrySnapshotDiagnostic[];
    manifestRegistry: PluginManifestRegistry;
    plugins: readonly PluginManifestRecord[];
    diagnostics: readonly PluginDiagnostic[];
    byPluginId: ReadonlyMap<string, PluginManifestRecord>;
    normalizePluginId: (pluginId: string) => string;
    owners: PluginLookUpTableOwnerMaps;
    startup: PluginLookUpTableStartupPlan;
    metrics: PluginLookUpTableMetrics;
};
export type LoadPluginLookUpTableParams = {
    config: OpenClawConfig;
    activationSourceConfig?: OpenClawConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
    index?: PluginRegistrySnapshot;
};
export declare function loadPluginLookUpTable(params: LoadPluginLookUpTableParams): PluginLookUpTable;
