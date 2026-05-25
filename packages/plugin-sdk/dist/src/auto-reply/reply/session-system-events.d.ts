import type { KovaConfig } from "../../config/types.kova.js";
/** Drain queued system events, format as `System:` lines, return the block (or undefined). */
export declare function drainFormattedSystemEvents(params: {
    cfg: KovaConfig;
    sessionKey: string;
    isMainSession: boolean;
    isNewSession: boolean;
}): Promise<string | undefined>;
