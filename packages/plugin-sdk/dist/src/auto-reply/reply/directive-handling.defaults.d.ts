import { type ModelAliasIndex } from "../../agents/model-selection.js";
import type { KovaConfig } from "../../config/types.kova.js";
export declare function resolveDefaultModel(params: {
    cfg: KovaConfig;
    agentId?: string;
}): {
    defaultProvider: string;
    defaultModel: string;
    aliasIndex: ModelAliasIndex;
};
