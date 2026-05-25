import type { KovaConfig } from "../../config/types.kova.js";
import { callGateway } from "../../gateway/call.js";
import type { AnyAgentTool } from "./common.js";
type GatewayCaller = typeof callGateway;
export declare function createSessionsHistoryTool(opts?: {
    agentSessionKey?: string;
    sandboxed?: boolean;
    config?: KovaConfig;
    callGateway?: GatewayCaller;
}): AnyAgentTool;
export {};
