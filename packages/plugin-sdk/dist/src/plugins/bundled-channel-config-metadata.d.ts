import type { KovaPackageManifest, PluginManifest, PluginManifestChannelConfig } from "./manifest.js";
export declare function collectBundledChannelConfigs(params: {
    pluginDir: string;
    manifest: PluginManifest;
    packageManifest?: KovaPackageManifest;
}): Record<string, PluginManifestChannelConfig> | undefined;
