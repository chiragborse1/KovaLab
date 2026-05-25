import type { KovaConfig } from "../config/types.kova.js";
import type { ProviderPlugin } from "./types.js";
export declare function resolvePluginDiscoveryProvidersRuntime(params: {
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    onlyPluginIds?: string[];
    includeUntrustedWorkspacePlugins?: boolean;
    requireCompleteDiscoveryEntryCoverage?: boolean;
    discoveryEntriesOnly?: boolean;
}): ProviderPlugin[];
