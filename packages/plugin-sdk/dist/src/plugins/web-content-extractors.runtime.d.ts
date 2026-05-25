import type { KovaConfig } from "../config/types.kova.js";
import type { PluginWebContentExtractorEntry } from "./web-content-extractor-types.js";
export declare function resolvePluginWebContentExtractors(params?: {
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    onlyPluginIds?: readonly string[];
}): PluginWebContentExtractorEntry[];
