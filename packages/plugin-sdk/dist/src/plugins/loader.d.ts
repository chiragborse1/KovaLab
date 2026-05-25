import type { KovaConfig } from "../config/types.kova.js";
import type { PluginInstallRecord } from "../config/types.plugins.js";
import type { GatewayRequestHandler } from "../gateway/server-methods/types.js";
import { type BundledRuntimeDepsInstallParams } from "./bundled-runtime-deps.js";
import { type PluginActivationConfigSource } from "./config-state.js";
import { toSafeImportPath } from "./import-specifier.js";
import { type PluginRegistry } from "./registry.js";
import type { CreatePluginRuntimeOptions } from "./runtime/types.js";
import { buildPluginLoaderAliasMap, buildPluginLoaderJitiOptions, listPluginSdkAliasCandidates, listPluginSdkExportedSubpaths, type PluginSdkResolutionPreference, resolveExtensionApiAlias, resolvePluginSdkAliasCandidateOrder, resolvePluginSdkAliasFile, resolvePluginRuntimeModulePath, resolvePluginSdkScopedAliasMap, shouldPreferNativeJiti } from "./sdk-alias.js";
import type { PluginLogger } from "./types.js";
export type PluginLoadResult = PluginRegistry;
export { PluginLoadReentryError } from "./loader-cache-state.js";
export type PluginLoadOptions = {
    config?: KovaConfig;
    activationSourceConfig?: KovaConfig;
    autoEnabledReasons?: Readonly<Record<string, string[]>>;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    logger?: PluginLogger;
    coreGatewayHandlers?: Record<string, GatewayRequestHandler>;
    coreGatewayMethodNames?: readonly string[];
    runtimeOptions?: CreatePluginRuntimeOptions;
    pluginSdkResolution?: PluginSdkResolutionPreference;
    cache?: boolean;
    mode?: "full" | "validate";
    onlyPluginIds?: string[];
    includeSetupOnlyChannelPlugins?: boolean;
    forceSetupOnlyChannelPlugins?: boolean;
    requireSetupEntryForSetupOnlyChannelPlugins?: boolean;
    /**
     * Prefer `setupEntry` for configured channel plugins that explicitly opt in
     * via package metadata because their setup entry covers the pre-listen startup surface.
     */
    preferSetupRuntimeForChannelPlugins?: boolean;
    activate?: boolean;
    loadModules?: boolean;
    installBundledRuntimeDeps?: boolean;
    throwOnLoadError?: boolean;
    bundledRuntimeDepsInstaller?: (params: BundledRuntimeDepsInstallParams) => void;
};
export declare class PluginLoadFailureError extends Error {
    readonly pluginIds: string[];
    readonly registry: PluginRegistry;
    constructor(registry: PluginRegistry);
}
export declare function clearPluginLoaderCache(): void;
declare function ensureKovaPluginSdkAlias(distRoot: string): void;
export declare const __testing: {
    buildPluginLoaderJitiOptions: typeof buildPluginLoaderJitiOptions;
    buildPluginLoaderAliasMap: typeof buildPluginLoaderAliasMap;
    listPluginSdkAliasCandidates: typeof listPluginSdkAliasCandidates;
    listPluginSdkExportedSubpaths: typeof listPluginSdkExportedSubpaths;
    resolveExtensionApiAlias: typeof resolveExtensionApiAlias;
    resolvePluginSdkScopedAliasMap: typeof resolvePluginSdkScopedAliasMap;
    resolvePluginSdkAliasCandidateOrder: typeof resolvePluginSdkAliasCandidateOrder;
    resolvePluginSdkAliasFile: typeof resolvePluginSdkAliasFile;
    resolvePluginRuntimeModulePath: typeof resolvePluginRuntimeModulePath;
    ensureKovaPluginSdkAlias: typeof ensureKovaPluginSdkAlias;
    shouldLoadChannelPluginInSetupRuntime: typeof shouldLoadChannelPluginInSetupRuntime;
    shouldPreferNativeJiti: typeof shouldPreferNativeJiti;
    toSafeImportPath: typeof toSafeImportPath;
    getCompatibleActivePluginRegistry: typeof getCompatibleActivePluginRegistry;
    resolvePluginLoadCacheContext: typeof resolvePluginLoadCacheContext;
    readonly maxPluginRegistryCacheEntries: number;
    setMaxPluginRegistryCacheEntriesForTest(value?: number): void;
};
declare function resolvePluginLoadCacheContext(options?: PluginLoadOptions): {
    env: NodeJS.ProcessEnv;
    cfg: KovaConfig;
    normalized: import("./config-normalization-shared.ts").NormalizedPluginsConfig;
    activationSourceConfig: KovaConfig;
    activationSource: PluginActivationConfigSource;
    autoEnabledReasons: Readonly<Record<string, string[]>>;
    onlyPluginIds: string[] | undefined;
    includeSetupOnlyChannelPlugins: boolean;
    forceSetupOnlyChannelPlugins: boolean;
    requireSetupEntryForSetupOnlyChannelPlugins: boolean;
    preferSetupRuntimeForChannelPlugins: boolean;
    shouldActivate: boolean;
    shouldLoadModules: boolean;
    shouldInstallBundledRuntimeDeps: boolean;
    runtimeSubagentMode: "default" | "explicit" | "gateway-bindable";
    installRecords: {
        [x: string]: PluginInstallRecord;
    };
    cacheKey: string;
};
declare function getCompatibleActivePluginRegistry(options?: PluginLoadOptions): PluginRegistry | undefined;
export declare function resolveRuntimePluginRegistry(options?: PluginLoadOptions): PluginRegistry | undefined;
export declare function resolvePluginRegistryLoadCacheKey(options?: PluginLoadOptions): string;
export declare function isPluginRegistryLoadInFlight(options?: PluginLoadOptions): boolean;
export declare function resolveCompatibleRuntimePluginRegistry(options?: PluginLoadOptions): PluginRegistry | undefined;
declare function shouldLoadChannelPluginInSetupRuntime(params: {
    manifestChannels: string[];
    setupSource?: string;
    startupDeferConfiguredChannelFullLoadUntilAfterListen?: boolean;
    cfg: KovaConfig;
    env: NodeJS.ProcessEnv;
    preferSetupRuntimeForChannelPlugins?: boolean;
}): boolean;
export declare function loadKovaPlugins(options?: PluginLoadOptions): PluginRegistry;
export declare function loadKovaPluginCliRegistry(options?: PluginLoadOptions): Promise<PluginRegistry>;
