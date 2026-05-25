import type { KovaConfig } from "../../config/types.kova.js";
export declare function listBundledChannelIdsWithPersistedAuthState(): string[];
export declare function hasBundledChannelPersistedAuthState(params: {
    channelId: string;
    cfg: KovaConfig;
    env?: NodeJS.ProcessEnv;
}): boolean;
