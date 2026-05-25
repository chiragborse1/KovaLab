import type { KovaConfig } from "../config/types.kova.js";
import type { GenerateImageParams, GenerateImageRuntimeResult } from "./runtime-types.js";
export type { GenerateImageParams, GenerateImageRuntimeResult } from "./runtime-types.js";
export declare function listRuntimeImageGenerationProviders(params?: {
    config?: KovaConfig;
}): import("./types.js").ImageGenerationProvider[];
export declare function generateImage(params: GenerateImageParams): Promise<GenerateImageRuntimeResult>;
