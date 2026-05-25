import type { KovaConfig } from "../config/types.js";
import type { MusicGenerationProviderPlugin } from "../plugins/types.js";
export declare function listMusicGenerationProviders(cfg?: KovaConfig): MusicGenerationProviderPlugin[];
export declare function getMusicGenerationProvider(providerId: string | undefined, cfg?: KovaConfig): MusicGenerationProviderPlugin | undefined;
