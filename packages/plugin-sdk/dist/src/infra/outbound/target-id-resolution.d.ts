import type { ChannelDirectoryEntryKind, ChannelId } from "../../channels/plugins/types.public.js";
import type { KovaConfig } from "../../config/types.kova.js";
export type ResolvedIdLikeTarget = {
    to: string;
    kind: ChannelDirectoryEntryKind | "channel";
    display?: string;
    source: "normalized" | "directory";
};
export declare function maybeResolveIdLikeTarget(params: {
    cfg: KovaConfig;
    channel: ChannelId;
    input: string;
    accountId?: string | null;
    preferredKind?: ChannelDirectoryEntryKind | "channel";
}): Promise<ResolvedIdLikeTarget | undefined>;
