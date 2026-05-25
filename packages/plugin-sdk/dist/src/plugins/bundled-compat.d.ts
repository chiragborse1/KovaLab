import type { KovaConfig } from "../config/types.kova.js";
export declare function withBundledPluginAllowlistCompat(params: {
    config: KovaConfig | undefined;
    pluginIds: readonly string[];
}): KovaConfig | undefined;
export declare function withBundledPluginEnablementCompat(params: {
    config: KovaConfig | undefined;
    pluginIds: readonly string[];
}): KovaConfig | undefined;
export declare function withBundledPluginVitestCompat(params: {
    config: KovaConfig | undefined;
    pluginIds: readonly string[];
    env?: NodeJS.ProcessEnv;
}): KovaConfig | undefined;
