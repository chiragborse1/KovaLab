import type { KovaConfig } from "../config/types.kova.js";
import type { ModelCatalogEntry } from "./model-catalog.types.js";
type ThinkLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive" | "max";
export declare function resolveThinkingDefault(params: {
    cfg: KovaConfig;
    provider: string;
    model: string;
    catalog?: ModelCatalogEntry[];
}): ThinkLevel;
export {};
