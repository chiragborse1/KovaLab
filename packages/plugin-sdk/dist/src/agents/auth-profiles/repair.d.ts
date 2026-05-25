import type { KovaConfig } from "../../config/types.kova.js";
import type { AuthProfileIdRepairResult, AuthProfileStore } from "./types.js";
export declare function suggestOAuthProfileIdForLegacyDefault(params: {
    cfg?: KovaConfig;
    store: AuthProfileStore;
    provider: string;
    legacyProfileId: string;
}): string | null;
export declare function repairOAuthProfileIdMismatch(params: {
    cfg: KovaConfig;
    store: AuthProfileStore;
    provider: string;
    legacyProfileId?: string;
}): AuthProfileIdRepairResult;
