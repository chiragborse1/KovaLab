import type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
import type { KovaConfig } from "../config/types.kova.js";
export type ChannelSummaryOptions = {
    colorize?: boolean;
    includeAllowFrom?: boolean;
    plugins?: readonly ChannelPlugin[];
    sourceConfig?: KovaConfig;
};
export declare function buildChannelSummary(cfg?: KovaConfig, options?: ChannelSummaryOptions): Promise<string[]>;
