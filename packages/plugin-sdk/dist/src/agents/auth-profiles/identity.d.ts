import type { KovaConfig } from "../../config/types.kova.js";
import type { AuthProfileStore } from "./types.js";
export declare function buildAuthProfileId(params: {
    providerId: string;
    profileName?: string | null;
    profilePrefix?: string;
}): string;
export declare function resolveAuthProfileMetadata(params: {
    cfg?: KovaConfig;
    store?: AuthProfileStore;
    profileId: string;
}): {
    displayName?: string;
    email?: string;
};
