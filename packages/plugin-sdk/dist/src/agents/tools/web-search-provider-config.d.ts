import type { KovaConfig } from "../../config/types.kova.js";
type ConfiguredWebSearchProvider = NonNullable<NonNullable<NonNullable<KovaConfig["tools"]>["web"]>["search"]>["provider"];
export type WebSearchConfig = NonNullable<KovaConfig["tools"]>["web"] extends infer Web ? Web extends {
    search?: infer Search;
} ? Search : undefined : undefined;
export declare function withForcedProvider(config: KovaConfig | undefined, provider: ConfiguredWebSearchProvider): KovaConfig;
export declare function getTopLevelCredentialValue(searchConfig?: Record<string, unknown>): unknown;
export declare function setTopLevelCredentialValue(searchConfigTarget: Record<string, unknown>, value: unknown): void;
export declare function getScopedCredentialValue(searchConfig: Record<string, unknown> | undefined, key: string): unknown;
export declare function setScopedCredentialValue(searchConfigTarget: Record<string, unknown>, key: string, value: unknown): void;
export declare function mergeScopedSearchConfig(searchConfig: Record<string, unknown> | undefined, key: string, pluginConfig: Record<string, unknown> | undefined, options?: {
    mirrorApiKeyToTopLevel?: boolean;
}): Record<string, unknown> | undefined;
export declare function resolveSearchConfig(cfg?: KovaConfig): WebSearchConfig;
export declare function resolveProviderWebSearchPluginConfig(config: KovaConfig | undefined, pluginId: string): Record<string, unknown> | undefined;
export declare function setProviderWebSearchPluginConfigValue(configTarget: KovaConfig, pluginId: string, key: string, value: unknown): void;
export declare function resolveSearchEnabled(params: {
    search?: WebSearchConfig;
    sandboxed?: boolean;
}): boolean;
export {};
