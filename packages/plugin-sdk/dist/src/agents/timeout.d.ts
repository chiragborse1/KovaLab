import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveAgentTimeoutSeconds(cfg?: KovaConfig): number;
export declare function resolveAgentTimeoutMs(opts: {
    cfg?: KovaConfig;
    overrideMs?: number | null;
    overrideSeconds?: number | null;
    minMs?: number;
}): number;
