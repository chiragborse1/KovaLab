import type { KovaConfig } from "../config/types.kova.js";
import type { PluginRegistry } from "./registry-types.js";
type CapabilityProviderRegistryKey = "memoryEmbeddingProviders" | "speechProviders" | "realtimeTranscriptionProviders" | "realtimeVoiceProviders" | "mediaUnderstandingProviders" | "imageGenerationProviders" | "videoGenerationProviders" | "musicGenerationProviders";
type CapabilityProviderForKey<K extends CapabilityProviderRegistryKey> = PluginRegistry[K][number] extends {
    provider: infer T;
} ? T : never;
export declare function resolvePluginCapabilityProvider<K extends CapabilityProviderRegistryKey>(params: {
    key: K;
    providerId: string;
    cfg?: KovaConfig;
}): CapabilityProviderForKey<K> | undefined;
export declare function resolvePluginCapabilityProviders<K extends CapabilityProviderRegistryKey>(params: {
    key: K;
    cfg?: KovaConfig;
}): CapabilityProviderForKey<K>[];
export {};
