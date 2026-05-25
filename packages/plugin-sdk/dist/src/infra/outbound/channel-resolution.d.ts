import type { ChannelPlugin } from "../../channels/plugins/types.plugin.js";
import type { KovaConfig } from "../../config/types.kova.js";
import { type DeliverableMessageChannel } from "../../utils/message-channel.js";
export declare function resetOutboundChannelResolutionStateForTest(): void;
export declare function normalizeDeliverableOutboundChannel(raw?: string | null): DeliverableMessageChannel | undefined;
export declare function resolveOutboundChannelPlugin(params: {
    channel: string;
    cfg?: KovaConfig;
}): ChannelPlugin | undefined;
