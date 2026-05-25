import type { KovaConfig } from "../config/types.js";
import type { AnyAgentTool } from "./pi-tools.types.js";
export declare function isLocalModelLeanEnabled(params: {
    config?: KovaConfig;
    agentId?: string;
    sessionKey?: string;
}): boolean;
export declare function filterLocalModelLeanTools(params: {
    tools: AnyAgentTool[];
    config?: KovaConfig;
    agentId?: string;
    sessionKey?: string;
}): AnyAgentTool[];
