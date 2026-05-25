import type { KovaConfig } from "../config/types.kova.js";
import type { ChannelAccountSnapshot } from "./plugins/types.core.js";
import type { ChannelPlugin } from "./plugins/types.plugin.js";
export declare function buildChannelAccountSnapshot(params: {
    plugin: ChannelPlugin;
    account: unknown;
    cfg: KovaConfig;
    accountId: string;
    enabled: boolean;
    configured: boolean;
}): ChannelAccountSnapshot;
export declare function formatChannelAllowFrom(params: {
    plugin: ChannelPlugin;
    cfg: KovaConfig;
    accountId?: string | null;
    allowFrom: Array<string | number>;
}): string[];
export declare function resolveChannelAccountEnabled(params: {
    plugin: ChannelPlugin;
    account: unknown;
    cfg: KovaConfig;
}): boolean;
export declare function resolveChannelAccountConfigured(params: {
    plugin: ChannelPlugin;
    account: unknown;
    cfg: KovaConfig;
    readAccountConfiguredField?: boolean;
}): Promise<boolean>;
