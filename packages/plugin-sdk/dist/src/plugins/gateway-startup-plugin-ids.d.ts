import type { KovaConfig } from "../config/types.kova.js";
import type { PluginManifestRegistry } from "./manifest-registry.js";
import { loadPluginRegistrySnapshot } from "./plugin-registry-snapshot.js";
export declare function resolveChannelPluginIds(params: {
    config: KovaConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
}): string[];
export declare function resolveChannelPluginIdsFromRegistry(params: {
    manifestRegistry: PluginManifestRegistry;
}): string[];
export declare function resolveConfiguredDeferredChannelPluginIdsFromRegistry(params: {
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
    index: ReturnType<typeof loadPluginRegistrySnapshot>;
    manifestRegistry: PluginManifestRegistry;
}): string[];
export declare function resolveConfiguredDeferredChannelPluginIds(params: {
    config: KovaConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
}): string[];
export declare function resolveGatewayStartupPluginIdsFromRegistry(params: {
    config: KovaConfig;
    activationSourceConfig?: KovaConfig;
    env: NodeJS.ProcessEnv;
    index: ReturnType<typeof loadPluginRegistrySnapshot>;
    manifestRegistry: PluginManifestRegistry;
}): string[];
export declare function resolveGatewayStartupPluginIds(params: {
    config: KovaConfig;
    activationSourceConfig?: KovaConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
}): string[];
