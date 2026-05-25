import type { KovaConfig } from "../../config/types.kova.js";
export declare function listBundledChannelIdsWithConfiguredState(): string[];
export declare function hasBundledChannelConfiguredState(params: {
    channelId: string;
    cfg: KovaConfig;
    env?: NodeJS.ProcessEnv;
}): boolean;
