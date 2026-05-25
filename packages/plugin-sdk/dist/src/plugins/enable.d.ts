import type { KovaConfig } from "../config/types.kova.js";
export type PluginEnableResult = {
    config: KovaConfig;
    enabled: boolean;
    reason?: string;
};
export declare function enablePluginInConfig(cfg: KovaConfig, pluginId: string, options?: {
    updateChannelConfig?: boolean;
}): PluginEnableResult;
