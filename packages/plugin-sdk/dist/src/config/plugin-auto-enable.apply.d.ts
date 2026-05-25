import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import type { PluginAutoEnableCandidate, PluginAutoEnableResult } from "./plugin-auto-enable.types.js";
import type { KovaConfig } from "./types.kova.js";
export declare function materializePluginAutoEnableCandidates(params: {
    config?: KovaConfig;
    candidates: readonly PluginAutoEnableCandidate[];
    env?: NodeJS.ProcessEnv;
    manifestRegistry?: PluginManifestRegistry;
}): PluginAutoEnableResult;
export declare function applyPluginAutoEnable(params: {
    config?: KovaConfig;
    env?: NodeJS.ProcessEnv;
    manifestRegistry?: PluginManifestRegistry;
}): PluginAutoEnableResult;
