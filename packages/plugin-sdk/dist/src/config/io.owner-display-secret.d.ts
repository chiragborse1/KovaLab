import type { KovaConfig } from "./types.kova.js";
export type OwnerDisplaySecretPersistState = {
    pendingByPath: Map<string, string>;
    persistInFlight: Set<string>;
    persistWarned: Set<string>;
};
export declare function persistGeneratedOwnerDisplaySecret(params: {
    config: KovaConfig;
    configPath: string;
    generatedSecret?: string;
    logger: Pick<typeof console, "warn">;
    state: OwnerDisplaySecretPersistState;
    persistConfig: (config: KovaConfig, options: {
        expectedConfigPath: string;
    }) => Promise<unknown>;
}): KovaConfig;
