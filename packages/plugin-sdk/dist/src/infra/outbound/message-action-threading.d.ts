import type { ChannelId, ChannelThreadingAdapter, ChannelThreadingToolContext } from "../../channels/plugins/types.public.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { OutboundSessionRoute, ResolveOutboundSessionRouteParams } from "./outbound-session.js";
import type { ResolvedMessagingTarget } from "./target-resolver.js";
type ResolveAutoThreadId = NonNullable<ChannelThreadingAdapter["resolveAutoThreadId"]>;
export declare function resolveAndApplyOutboundThreadId(actionParams: Record<string, unknown>, context: {
    cfg: KovaConfig;
    to: string;
    accountId?: string | null;
    toolContext?: ChannelThreadingToolContext;
    resolveAutoThreadId?: ResolveAutoThreadId;
}): string | undefined;
export declare function resolveAndApplyOutboundReplyToId(actionParams: Record<string, unknown>, context: {
    channel: ChannelId;
    toolContext?: ChannelThreadingToolContext;
}): string | undefined;
export declare function prepareOutboundMirrorRoute(params: {
    cfg: KovaConfig;
    channel: ChannelId;
    to: string;
    actionParams: Record<string, unknown>;
    accountId?: string | null;
    toolContext?: ChannelThreadingToolContext;
    agentId?: string;
    currentSessionKey?: string;
    dryRun?: boolean;
    resolvedTarget?: ResolvedMessagingTarget;
    resolveAutoThreadId?: ResolveAutoThreadId;
    resolveOutboundSessionRoute: (params: ResolveOutboundSessionRouteParams) => Promise<OutboundSessionRoute | null>;
    ensureOutboundSessionEntry: (params: {
        cfg: KovaConfig;
        channel: ChannelId;
        accountId?: string | null;
        route: OutboundSessionRoute;
    }) => Promise<void>;
}): Promise<{
    resolvedThreadId?: string;
    outboundRoute: OutboundSessionRoute | null;
}>;
export {};
