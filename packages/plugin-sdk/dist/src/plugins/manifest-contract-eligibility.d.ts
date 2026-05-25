import type { KovaConfig } from "../config/types.kova.js";
import type { PluginManifestContractListKey, PluginManifestRecord } from "./manifest-registry.js";
import type { PluginMetadataManifestView, PluginMetadataRegistryView, PluginMetadataSnapshot } from "./plugin-metadata-snapshot.types.js";
export declare function isManifestPluginAvailableForControlPlane(params: {
    snapshot: Pick<PluginMetadataSnapshot, "index">;
    plugin: Pick<PluginManifestRecord, "id" | "origin" | "enabledByDefault">;
    config?: KovaConfig;
}): boolean;
export declare function hasManifestContractValue(params: {
    plugin: Pick<PluginManifestRecord, "contracts">;
    contract: PluginManifestContractListKey;
    value?: string;
}): boolean;
export declare function listAvailableManifestContractPlugins(params: {
    snapshot: Pick<PluginMetadataSnapshot, "index" | "plugins">;
    contract: PluginManifestContractListKey;
    value?: string;
    config?: KovaConfig;
}): PluginManifestRecord[];
export declare function listAvailableManifestContractValues(params: {
    snapshot: Pick<PluginMetadataSnapshot, "index" | "plugins">;
    contract: PluginManifestContractListKey;
    config?: KovaConfig;
}): string[];
export declare function loadManifestContractSnapshot(params: {
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
}): PluginMetadataManifestView;
export declare function loadManifestMetadataRegistry(params: {
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
}): PluginMetadataRegistryView;
export declare function loadManifestMetadataSnapshot(params: {
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
}): PluginMetadataSnapshot;
