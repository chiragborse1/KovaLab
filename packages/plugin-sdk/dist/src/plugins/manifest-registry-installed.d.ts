import type { KovaConfig } from "../config/types.kova.js";
import type { InstalledPluginIndex } from "./installed-plugin-index.js";
import { type PluginManifestRegistry } from "./manifest-registry.js";
import type { BundledChannelConfigCollector } from "./manifest-registry.js";
export declare function resolveInstalledManifestRegistryIndexFingerprint(index: InstalledPluginIndex): string;
export declare function clearInstalledManifestRegistryCache(): void;
export declare function loadPluginManifestRegistryForInstalledIndex(params: {
    index: InstalledPluginIndex;
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    pluginIds?: readonly string[];
    includeDisabled?: boolean;
    bundledChannelConfigCollector?: BundledChannelConfigCollector;
}): PluginManifestRegistry;
