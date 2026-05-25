import type { KovaConfig } from "../config/types.kova.js";
export declare function setPluginEnabledInConfig(config: KovaConfig, pluginId: string, enabled: boolean, options?: {
    updateChannelConfig?: boolean;
}): KovaConfig;
