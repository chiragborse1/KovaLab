import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import type { PluginAutoEnableCandidate } from "./plugin-auto-enable.types.js";
import type { KovaConfig } from "./types.kova.js";
export declare function shouldSkipPreferredPluginAutoEnable(params: {
    config: KovaConfig;
    entry: PluginAutoEnableCandidate;
    configured: readonly PluginAutoEnableCandidate[];
    env: NodeJS.ProcessEnv;
    registry: PluginManifestRegistry;
    isPluginDenied: (config: KovaConfig, pluginId: string) => boolean;
    isPluginExplicitlyDisabled: (config: KovaConfig, pluginId: string) => boolean;
    preferOverCache: Map<string, string[]>;
}): boolean;
