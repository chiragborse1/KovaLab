import type { ChannelThreadingAdapter } from "../../channels/plugins/types.core.js";
import type { ReplyToMode } from "../../config/types.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { OriginatingChannelType } from "../templating.js";
import type { ReplyPayload, ReplyThreadingPolicy } from "../types.js";
export declare function resolveConfiguredReplyToMode(cfg: KovaConfig, channel?: OriginatingChannelType, chatType?: string | null): ReplyToMode;
export declare function resolveReplyToModeWithThreading(cfg: KovaConfig, threading: ChannelThreadingAdapter | undefined, params?: {
    channel?: OriginatingChannelType;
    accountId?: string | null;
    chatType?: string | null;
}): ReplyToMode;
export declare function resolveReplyToMode(cfg: KovaConfig, channel?: OriginatingChannelType, accountId?: string | null, chatType?: string | null): ReplyToMode;
export declare function createReplyToModeFilter(mode: ReplyToMode, opts?: {
    allowExplicitReplyTagsWhenOff?: boolean;
}): (payload: ReplyPayload) => ReplyPayload;
export declare function resolveImplicitCurrentMessageReplyAllowance(mode: ReplyToMode | undefined, policy?: ReplyThreadingPolicy): boolean;
export declare function resolveBatchedReplyThreadingPolicy(mode: ReplyToMode, isBatched: boolean): ReplyThreadingPolicy | undefined;
export declare function createReplyToModeFilterForChannel(mode: ReplyToMode, channel?: OriginatingChannelType): (payload: ReplyPayload) => ReplyPayload;
