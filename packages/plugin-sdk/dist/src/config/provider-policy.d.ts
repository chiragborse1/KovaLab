import type { ModelProviderConfig, KovaConfig } from "./types.js";
export declare function normalizeProviderConfigForConfigDefaults(params: {
    provider: string;
    providerConfig: ModelProviderConfig;
}): ModelProviderConfig;
export declare function applyProviderConfigDefaultsForConfig(params: {
    provider: string;
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
}): KovaConfig;
