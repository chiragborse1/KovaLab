import type { KovaConfig } from "../../config/types.kova.js";
import { type ImageModelConfig } from "./image-tool.helpers.js";
export declare function resolvePdfModelConfigForTool(params: {
    cfg?: KovaConfig;
    agentDir: string;
}): ImageModelConfig | null;
