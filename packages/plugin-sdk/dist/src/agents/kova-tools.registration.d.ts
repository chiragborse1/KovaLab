import type { KovaConfig } from "../config/types.kova.js";
import type { AnyAgentTool } from "./tools/common.js";
export declare function collectPresentKovaTools(candidates: readonly (AnyAgentTool | null | undefined)[]): AnyAgentTool[];
export declare function isUpdatePlanToolEnabledForKovaTools(params: {
    config?: KovaConfig;
    agentSessionKey?: string;
    agentId?: string | null;
    modelProvider?: string;
    modelId?: string;
}): boolean;
