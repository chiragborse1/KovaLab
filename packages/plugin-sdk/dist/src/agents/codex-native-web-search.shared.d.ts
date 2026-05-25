import type { KovaConfig } from "../config/types.kova.js";
export type CodexNativeSearchMode = "cached" | "live";
export type CodexNativeSearchContextSize = "low" | "medium" | "high";
export type CodexNativeSearchUserLocation = {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
};
export type ResolvedCodexNativeWebSearchConfig = {
    enabled: boolean;
    mode: CodexNativeSearchMode;
    allowedDomains?: string[];
    contextSize?: CodexNativeSearchContextSize;
    userLocation?: CodexNativeSearchUserLocation;
};
export declare function resolveCodexNativeWebSearchConfig(config: KovaConfig | undefined): ResolvedCodexNativeWebSearchConfig;
export declare function describeCodexNativeWebSearch(config: KovaConfig | undefined): string | undefined;
