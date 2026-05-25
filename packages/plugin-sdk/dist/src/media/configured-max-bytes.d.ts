import type { KovaConfig } from "../config/types.kova.js";
import { type MediaKind } from "./constants.js";
export declare function resolveConfiguredMediaMaxBytes(cfg?: KovaConfig): number | undefined;
export declare function resolveGeneratedMediaMaxBytes(cfg: KovaConfig | undefined, kind: MediaKind): number;
export declare function resolveChannelAccountMediaMaxMb(params: {
    cfg: KovaConfig;
    channel?: string | null;
    accountId?: string | null;
}): number | undefined;
