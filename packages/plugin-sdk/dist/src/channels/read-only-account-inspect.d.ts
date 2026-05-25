import type { KovaConfig } from "../config/types.kova.js";
import type { ChannelId } from "./plugins/types.public.js";
export type ReadOnlyInspectedAccount = Record<string, unknown>;
export declare function inspectReadOnlyChannelAccount(params: {
    channelId: ChannelId;
    cfg: KovaConfig;
    accountId?: string | null;
}): Promise<ReadOnlyInspectedAccount | null>;
