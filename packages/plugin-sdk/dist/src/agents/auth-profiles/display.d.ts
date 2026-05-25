import type { KovaConfig } from "../../config/types.kova.js";
import type { AuthProfileStore } from "./types.js";
export declare function resolveAuthProfileDisplayLabel(params: {
    cfg?: KovaConfig;
    store: AuthProfileStore;
    profileId: string;
}): string;
