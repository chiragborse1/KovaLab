import type { AgentModelListConfig } from "../config/types.js";
import type { KovaConfig } from "../config/types.kova.js";
export declare function resolvePrimaryModel(model?: AgentModelListConfig | string): string | undefined;
export declare function applyAgentDefaultPrimaryModel(params: {
    cfg: KovaConfig;
    model: string;
    legacyModels?: Set<string>;
}): {
    next: KovaConfig;
    changed: boolean;
};
export declare function applyPrimaryModel(cfg: KovaConfig, model: string): KovaConfig;
