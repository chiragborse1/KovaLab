import type { KovaConfig } from "../config/types.kova.js";
export declare function shouldIncludeHeartbeatGuidanceForSystemPrompt(params: {
    config?: KovaConfig;
    agentId?: string;
    defaultAgentId?: string;
}): boolean;
export declare function resolveHeartbeatPromptForSystemPrompt(params: {
    config?: KovaConfig;
    agentId?: string;
    defaultAgentId?: string;
}): string | undefined;
