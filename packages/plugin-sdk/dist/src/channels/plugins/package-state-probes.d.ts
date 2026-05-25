import type { KovaConfig } from "../../config/types.kova.js";
export type ChannelPackageStateMetadataKey = "configuredState" | "persistedAuthState";
export declare function listBundledChannelIdsForPackageState(metadataKey: ChannelPackageStateMetadataKey): string[];
export declare function hasBundledChannelPackageState(params: {
    metadataKey: ChannelPackageStateMetadataKey;
    channelId: string;
    cfg: KovaConfig;
    env?: NodeJS.ProcessEnv;
}): boolean;
