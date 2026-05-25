import type { KovaConfig } from "../config/types.kova.js";
import { normalizePluginsConfig } from "./config-state.js";
import type { PluginManifestRecord } from "./manifest-registry.js";
type OwnerPlugin = Pick<PluginManifestRecord, "id" | "origin" | "enabledByDefault">;
type NormalizedPluginsConfig = ReturnType<typeof normalizePluginsConfig>;
export declare function isBundledManifestOwner(plugin: Pick<PluginManifestRecord, "origin">): boolean;
export declare function hasExplicitManifestOwnerTrust(params: {
    plugin: Pick<PluginManifestRecord, "id">;
    normalizedConfig: NormalizedPluginsConfig;
}): boolean;
export declare function passesManifestOwnerBasePolicy(params: {
    plugin: Pick<PluginManifestRecord, "id">;
    normalizedConfig: NormalizedPluginsConfig;
    allowExplicitlyDisabled?: boolean;
    allowRestrictiveAllowlistBypass?: boolean;
}): boolean;
export declare function isActivatedManifestOwner(params: {
    plugin: OwnerPlugin;
    normalizedConfig: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
}): boolean;
export {};
