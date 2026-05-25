import type { KovaConfig } from "../../config/types.kova.js";
import type { DeliverableMessageChannel } from "../../utils/message-channel.js";
export declare function resetOutboundChannelBootstrapStateForTests(): void;
export declare function bootstrapOutboundChannelPlugin(params: {
    channel: DeliverableMessageChannel;
    cfg?: KovaConfig;
}): void;
