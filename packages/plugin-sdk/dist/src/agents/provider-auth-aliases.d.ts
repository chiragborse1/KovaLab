import type { KovaConfig } from "../config/types.kova.js";
export type ProviderAuthAliasLookupParams = {
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    includeUntrustedWorkspacePlugins?: boolean;
};
export declare function resetProviderAuthAliasMapCacheForTest(): void;
export declare function resolveProviderAuthAliasMap(params?: ProviderAuthAliasLookupParams): Record<string, string>;
export declare function resolveProviderIdForAuth(provider: string, params?: ProviderAuthAliasLookupParams): string;
