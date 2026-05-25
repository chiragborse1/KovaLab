import type { KovaConfig } from "../../config/types.kova.js";
import type { AuthProfileStore } from "./types.js";
type OAuthSecretRefPolicyViolation = {
    profileId: string;
    path: string;
    reason: string;
};
export declare function collectOAuthSecretRefPolicyViolations(params: {
    store: AuthProfileStore;
    cfg?: KovaConfig;
    profileIds?: Iterable<string>;
}): OAuthSecretRefPolicyViolation[];
export declare function assertNoOAuthSecretRefPolicyViolations(params: {
    store: AuthProfileStore;
    cfg?: KovaConfig;
    profileIds?: Iterable<string>;
    context?: string;
}): void;
export {};
