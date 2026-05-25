import type { KovaConfig } from "../config/types.kova.js";
import type { RealtimeVoiceProviderPlugin } from "../plugins/types.js";
import type { RealtimeVoiceProviderId } from "./provider-types.js";
export declare function normalizeRealtimeVoiceProviderId(providerId: string | undefined): RealtimeVoiceProviderId | undefined;
export declare function listRealtimeVoiceProviders(cfg?: KovaConfig): RealtimeVoiceProviderPlugin[];
export declare function getRealtimeVoiceProvider(providerId: string | undefined, cfg?: KovaConfig): RealtimeVoiceProviderPlugin | undefined;
export declare function canonicalizeRealtimeVoiceProviderId(providerId: string | undefined, cfg?: KovaConfig): RealtimeVoiceProviderId | undefined;
