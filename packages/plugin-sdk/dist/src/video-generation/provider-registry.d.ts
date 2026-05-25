import type { KovaConfig } from "../config/types.js";
import type { VideoGenerationProviderPlugin } from "../plugins/types.js";
export declare function listVideoGenerationProviders(cfg?: KovaConfig): VideoGenerationProviderPlugin[];
export declare function getVideoGenerationProvider(providerId: string | undefined, cfg?: KovaConfig): VideoGenerationProviderPlugin | undefined;
