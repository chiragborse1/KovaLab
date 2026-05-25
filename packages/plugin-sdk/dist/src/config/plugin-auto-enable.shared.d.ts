import { type PluginManifestRegistry } from "../plugins/manifest-registry.js";
import type { PluginAutoEnableCandidate, PluginAutoEnableResult } from "./plugin-auto-enable.types.js";
import type { KovaConfig } from "./types.kova.js";
export type { PluginAutoEnableCandidate, PluginAutoEnableResult, } from "./plugin-auto-enable.types.js";
export declare function configMayNeedPluginAutoEnable(cfg: KovaConfig, env: NodeJS.ProcessEnv): boolean;
export declare function resolvePluginAutoEnableCandidateReason(candidate: PluginAutoEnableCandidate): string;
export declare function resolveConfiguredPluginAutoEnableCandidates(params: {
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
    registry: PluginManifestRegistry;
}): PluginAutoEnableCandidate[];
export declare function resolvePluginAutoEnableManifestRegistry(params: {
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
    manifestRegistry?: PluginManifestRegistry;
}): PluginManifestRegistry;
export declare function materializePluginAutoEnableCandidatesInternal(params: {
    config?: KovaConfig;
    candidates: readonly PluginAutoEnableCandidate[];
    env: NodeJS.ProcessEnv;
    manifestRegistry: PluginManifestRegistry;
}): PluginAutoEnableResult;
