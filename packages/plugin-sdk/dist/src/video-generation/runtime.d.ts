import type { KovaConfig } from "../config/types.kova.js";
import type { GenerateVideoParams, GenerateVideoRuntimeResult } from "./runtime-types.js";
export type { GenerateVideoParams, GenerateVideoRuntimeResult } from "./runtime-types.js";
export declare function listRuntimeVideoGenerationProviders(params?: {
    config?: KovaConfig;
}): import("./types.js").VideoGenerationProvider[];
export declare function generateVideo(params: GenerateVideoParams): Promise<GenerateVideoRuntimeResult>;
