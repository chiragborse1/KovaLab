import type { KovaConfig } from "../../config/types.kova.js";
import type { AuthProfileStore } from "./types.js";
export declare function formatAuthDoctorHint(params: {
    cfg?: KovaConfig;
    store: AuthProfileStore;
    provider: string;
    profileId?: string;
}): Promise<string>;
