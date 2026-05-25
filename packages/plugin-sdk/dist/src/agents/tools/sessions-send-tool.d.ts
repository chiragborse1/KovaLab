import type { KovaConfig } from "../../config/types.kova.js";
import { callGateway } from "../../gateway/call.js";
import { type GatewayMessageChannel } from "../../utils/message-channel.js";
import type { AnyAgentTool } from "./common.js";
type GatewayCaller = typeof callGateway;
export declare function createSessionsSendTool(opts?: {
    agentSessionKey?: string;
    agentChannel?: GatewayMessageChannel;
    sandboxed?: boolean;
    config?: KovaConfig;
    callGateway?: GatewayCaller;
}): AnyAgentTool;
export {};
