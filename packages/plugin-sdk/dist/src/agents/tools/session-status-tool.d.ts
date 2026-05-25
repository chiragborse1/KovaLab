import type { KovaConfig } from "../../config/types.kova.js";
import type { AnyAgentTool } from "./common.js";
export declare function createSessionStatusTool(opts?: {
    agentSessionKey?: string;
    config?: KovaConfig;
    sandboxed?: boolean;
    activeModelProvider?: string;
    activeModelId?: string;
}): AnyAgentTool;
