import type { KovaConfig } from "../../config/types.kova.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import type { AnyAgentTool } from "./common.js";
export declare function createTtsTool(opts?: {
    config?: KovaConfig;
    agentChannel?: GatewayMessageChannel;
    agentId?: string;
    agentAccountId?: string;
}): AnyAgentTool;
