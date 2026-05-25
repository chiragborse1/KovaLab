import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import type { PluginAutoEnableCandidate } from "./plugin-auto-enable.types.js";
import type { KovaConfig } from "./types.kova.js";
export declare function detectPluginAutoEnableCandidates(params: {
    config?: KovaConfig;
    env?: NodeJS.ProcessEnv;
    manifestRegistry?: PluginManifestRegistry;
}): PluginAutoEnableCandidate[];
