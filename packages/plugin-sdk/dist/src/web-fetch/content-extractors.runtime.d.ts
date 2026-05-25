import type { KovaConfig } from "../config/types.kova.js";
import type { WebContentExtractionResult, WebContentExtractMode } from "../plugins/web-content-extractor-types.js";
export declare function extractReadableContent(params: {
    html: string;
    url: string;
    extractMode: WebContentExtractMode;
    config?: KovaConfig;
}): Promise<(WebContentExtractionResult & {
    extractor: string;
}) | null>;
