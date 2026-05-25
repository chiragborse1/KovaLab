import type { KovaConfig } from "../../config/types.kova.js";
import type { GatewayMessageChannel } from "../../utils/message-channel.js";
import { type AnyAgentTool } from "./common.js";
export declare function createNodesTool(options?: {
    agentSessionKey?: string;
    agentChannel?: GatewayMessageChannel;
    agentAccountId?: string;
    currentChannelId?: string;
    currentThreadTs?: string | number;
    config?: KovaConfig;
    modelHasVision?: boolean;
    allowMediaInvokeCommands?: boolean;
}): AnyAgentTool;
