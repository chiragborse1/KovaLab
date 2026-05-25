import type { KovaConfig } from "../../config/types.kova.js";
export declare function resolveProfileOverride(params: {
    rawProfile?: string;
    provider: string;
    cfg: KovaConfig;
    agentDir?: string;
}): {
    profileId?: string;
    error?: string;
};
