import type { KovaConfig } from "../../config/types.kova.js";
export type PluginRegistryScope = "configured-channels" | "channels" | "all";
export declare function ensurePluginRegistryLoaded(options?: {
    scope?: PluginRegistryScope;
    config?: KovaConfig;
    activationSourceConfig?: KovaConfig;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
    onlyPluginIds?: string[];
}): void;
export declare const __testing: {
    resetPluginRegistryLoadedForTests(): void;
};
