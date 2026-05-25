import type { KovaConfig } from "../config/types.kova.js";
import type { ImageGenerationProviderPlugin } from "../plugins/types.js";
export declare function listImageGenerationProviders(cfg?: KovaConfig): ImageGenerationProviderPlugin[];
export declare function getImageGenerationProvider(providerId: string | undefined, cfg?: KovaConfig): ImageGenerationProviderPlugin | undefined;
