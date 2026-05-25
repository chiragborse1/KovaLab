import type { KovaConfig } from "../config/types.kova.js";
export declare function expectGeneratedTokenPersistedToGatewayAuth(params: {
    generatedToken?: string;
    authToken?: string;
    persistedConfig?: KovaConfig;
}): void;
