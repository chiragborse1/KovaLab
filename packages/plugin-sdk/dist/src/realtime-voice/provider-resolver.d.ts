import type { KovaConfig } from "../config/types.kova.js";
import type { RealtimeVoiceProviderPlugin } from "../plugins/types.js";
import type { RealtimeVoiceProviderConfig } from "./provider-types.js";
export type ResolvedRealtimeVoiceProvider = {
    provider: RealtimeVoiceProviderPlugin;
    providerConfig: RealtimeVoiceProviderConfig;
};
export type ResolveConfiguredRealtimeVoiceProviderParams = {
    configuredProviderId?: string;
    providerConfigs?: Record<string, Record<string, unknown> | undefined>;
    cfg?: KovaConfig;
    cfgForResolve?: KovaConfig;
    providers?: RealtimeVoiceProviderPlugin[];
    defaultModel?: string;
    noRegisteredProviderMessage?: string;
};
export declare function resolveConfiguredRealtimeVoiceProvider(params: ResolveConfiguredRealtimeVoiceProviderParams): ResolvedRealtimeVoiceProvider;
