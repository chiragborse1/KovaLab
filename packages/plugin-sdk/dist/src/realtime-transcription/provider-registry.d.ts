import type { KovaConfig } from "../config/types.kova.js";
import type { RealtimeTranscriptionProviderPlugin } from "../plugins/types.js";
import type { RealtimeTranscriptionProviderId } from "./provider-types.js";
export declare function normalizeRealtimeTranscriptionProviderId(providerId: string | undefined): RealtimeTranscriptionProviderId | undefined;
export declare function listRealtimeTranscriptionProviders(cfg?: KovaConfig): RealtimeTranscriptionProviderPlugin[];
export declare function getRealtimeTranscriptionProvider(providerId: string | undefined, cfg?: KovaConfig): RealtimeTranscriptionProviderPlugin | undefined;
export declare function canonicalizeRealtimeTranscriptionProviderId(providerId: string | undefined, cfg?: KovaConfig): RealtimeTranscriptionProviderId | undefined;
