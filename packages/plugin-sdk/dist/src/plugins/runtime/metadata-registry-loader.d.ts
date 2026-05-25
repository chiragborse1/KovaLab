import type { KovaConfig } from "../../config/types.kova.js";
import type { PluginRegistry } from "../registry.js";
import type { PluginLogger } from "../types.js";
export declare function loadPluginMetadataRegistrySnapshot(options?: {
    config?: KovaConfig;
    activationSourceConfig?: KovaConfig;
    env?: NodeJS.ProcessEnv;
    logger?: PluginLogger;
    workspaceDir?: string;
    onlyPluginIds?: string[];
    loadModules?: boolean;
}): PluginRegistry;
