import type { KovaConfig } from "../../../config/types.kova.js";
export declare function listLegacyWebFetchConfigPaths(raw: unknown): string[];
export declare function normalizeLegacyWebFetchConfig<T>(raw: T): T;
export declare function migrateLegacyWebFetchConfig<T>(raw: T): {
    config: T;
    changes: string[];
};
export declare function resolvePluginWebFetchConfig(config: KovaConfig | undefined, pluginId: string): Record<string, unknown> | undefined;
