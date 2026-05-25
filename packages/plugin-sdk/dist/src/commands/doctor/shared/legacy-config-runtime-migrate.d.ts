import type { KovaConfig } from "../../../config/types.kova.js";
export declare function normalizeRuntimeCompatibilityConfigValues(cfg: KovaConfig): {
    config: KovaConfig;
    changes: string[];
};
