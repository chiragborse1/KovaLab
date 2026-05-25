import type { KovaConfig } from "../config/types.kova.js";
/** Resolve the config path prefix for a channel account, falling back to the root channel section. */
export declare function resolveChannelAccountConfigBasePath(params: {
    cfg: KovaConfig;
    channelKey: string;
    accountId: string;
}): string;
