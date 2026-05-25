import type { KovaConfig } from "../config/types.kova.js";
import type { DocumentExtractionRequest, DocumentExtractionResult } from "../plugins/document-extractor-types.js";
export declare function extractDocumentContent(params: DocumentExtractionRequest & {
    config?: KovaConfig;
}): Promise<(DocumentExtractionResult & {
    extractor: string;
}) | null>;
