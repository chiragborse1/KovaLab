import type { KovaConfig } from "../config/types.kova.js";
import type { ChannelPlugin } from "./plugins/types.plugin.js";
export declare function inspectChannelAccount(params: {
    plugin: ChannelPlugin;
    cfg: KovaConfig;
    accountId: string;
}): Promise<unknown>;
export declare function resolveInspectedChannelAccount(params: {
    plugin: ChannelPlugin;
    cfg: KovaConfig;
    sourceConfig: KovaConfig;
    accountId: string;
}): Promise<{
    account: unknown;
    enabled: boolean;
    configured: boolean;
}>;
