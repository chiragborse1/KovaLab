import type { AgentModelConfig } from "../../config/types.agents-shared.js";
import type { KovaConfig } from "../../config/types.kova.js";
export type ToolModelConfig = {
    primary?: string;
    fallbacks?: string[];
    timeoutMs?: number;
};
export declare function hasToolModelConfig(model: ToolModelConfig | undefined): boolean;
export declare function resolveDefaultModelRef(cfg?: KovaConfig): {
    provider: string;
    model: string;
};
export declare function hasAuthForProvider(params: {
    provider: string;
    agentDir?: string;
}): boolean;
export declare function coerceToolModelConfig(model?: AgentModelConfig): ToolModelConfig;
export declare function buildToolModelConfigFromCandidates(params: {
    explicit: ToolModelConfig;
    agentDir?: string;
    candidates: Array<string | null | undefined>;
    isProviderConfigured?: (provider: string) => boolean;
}): ToolModelConfig | null;
