import type { KovaConfig } from "../config/types.kova.js";
export type NormalizedPluginsConfig = {
    enabled: boolean;
    allow: string[];
    deny: string[];
    loadPaths: string[];
    slots: {
        memory?: string | null;
        contextEngine?: string | null;
    };
    entries: Record<string, {
        enabled?: boolean;
        hooks?: {
            allowPromptInjection?: boolean;
            allowConversationAccess?: boolean;
        };
        subagent?: {
            allowModelOverride?: boolean;
            allowedModels?: string[];
            hasAllowedModelsConfig?: boolean;
        };
        config?: unknown;
    }>;
};
export type NormalizePluginId = (id: string) => string;
export declare const identityNormalizePluginId: NormalizePluginId;
export declare function normalizePluginsConfigWithResolver(config?: KovaConfig["plugins"], normalizePluginId?: NormalizePluginId): NormalizedPluginsConfig;
export declare function hasExplicitPluginConfig(plugins?: KovaConfig["plugins"]): boolean;
export declare function isBundledChannelEnabledByChannelConfig(cfg: KovaConfig | undefined, pluginId: string): boolean;
