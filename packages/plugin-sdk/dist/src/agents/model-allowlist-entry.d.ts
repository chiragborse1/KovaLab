import type { KovaConfig } from "../config/types.kova.js";
export declare function ensureStaticModelAllowlistEntry(params: {
    cfg: KovaConfig;
    modelRef: string;
    defaultProvider?: string;
}): KovaConfig;
