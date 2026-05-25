import type { KovaConfig } from "../config/types.kova.js";
import type { GenerateMusicParams, GenerateMusicRuntimeResult } from "./runtime-types.js";
export type { GenerateMusicParams, GenerateMusicRuntimeResult } from "./runtime-types.js";
export declare function listRuntimeMusicGenerationProviders(params?: {
    config?: KovaConfig;
}): import("./types.js").MusicGenerationProvider[];
export declare function generateMusic(params: GenerateMusicParams): Promise<GenerateMusicRuntimeResult>;
