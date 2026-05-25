import type { KovaConfig } from "../config/types.kova.js";
import type { PluginDocumentExtractorEntry } from "./document-extractor-types.js";
export declare function resolvePluginDocumentExtractors(params?: {
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    onlyPluginIds?: readonly string[];
}): PluginDocumentExtractorEntry[];
