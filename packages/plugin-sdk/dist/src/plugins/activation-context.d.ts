import type { KovaConfig } from "../config/types.kova.js";
import { type NormalizedPluginsConfig, type PluginActivationConfigSource } from "./config-state.js";
export type PluginActivationCompatConfig = {
    allowlistPluginIds?: readonly string[];
    enablementPluginIds?: readonly string[];
    vitestPluginIds?: readonly string[];
};
export type PluginActivationBundledCompatMode = {
    allowlist?: boolean;
    enablement?: "always" | "allowlist";
    vitest?: boolean;
};
export type PluginActivationInputs = {
    rawConfig?: KovaConfig;
    config?: KovaConfig;
    normalized: NormalizedPluginsConfig;
    activationSourceConfig?: KovaConfig;
    activationSource: PluginActivationConfigSource;
    autoEnabledReasons: Record<string, string[]>;
};
export type PluginActivationSnapshot = Pick<PluginActivationInputs, "rawConfig" | "config" | "normalized" | "activationSourceConfig" | "activationSource" | "autoEnabledReasons">;
export type BundledPluginCompatibleActivationInputs = PluginActivationInputs & {
    compatPluginIds: string[];
};
export type BundledPluginCompatibleLoadValues = Pick<BundledPluginCompatibleActivationInputs, "rawConfig" | "config" | "activationSourceConfig" | "autoEnabledReasons" | "compatPluginIds">;
type BundledPluginCompatibleActivationParams = {
    rawConfig?: KovaConfig;
    resolvedConfig?: KovaConfig;
    autoEnabledReasons?: Record<string, string[]>;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
    onlyPluginIds?: readonly string[];
    applyAutoEnable?: boolean;
    compatMode: PluginActivationBundledCompatMode;
    resolveCompatPluginIds: (params: {
        config?: KovaConfig;
        workspaceDir?: string;
        env?: NodeJS.ProcessEnv;
        onlyPluginIds?: readonly string[];
    }) => string[];
};
export declare function withActivatedPluginIds(params: {
    config?: KovaConfig;
    pluginIds: readonly string[];
    overrideGlobalDisable?: boolean;
    overrideExplicitDisable?: boolean;
}): KovaConfig | undefined;
export declare function applyPluginCompatibilityOverrides(params: {
    config?: KovaConfig;
    compat?: PluginActivationCompatConfig;
    env: NodeJS.ProcessEnv;
}): KovaConfig | undefined;
export declare function resolvePluginActivationSnapshot(params: {
    rawConfig?: KovaConfig;
    resolvedConfig?: KovaConfig;
    autoEnabledReasons?: Record<string, string[]>;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
    applyAutoEnable?: boolean;
}): PluginActivationSnapshot;
export declare function resolvePluginActivationInputs(params: {
    rawConfig?: KovaConfig;
    resolvedConfig?: KovaConfig;
    autoEnabledReasons?: Record<string, string[]>;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
    compat?: PluginActivationCompatConfig;
    applyAutoEnable?: boolean;
}): PluginActivationInputs;
export declare function resolveBundledPluginCompatibleActivationInputs(params: BundledPluginCompatibleActivationParams): BundledPluginCompatibleActivationInputs;
export declare function resolveBundledPluginCompatibleLoadValues(params: BundledPluginCompatibleActivationParams): BundledPluginCompatibleLoadValues;
export {};
