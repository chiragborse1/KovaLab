import type { KovaConfig } from "../config/types.js";
import type { MediaUnderstandingProvider } from "./types.js";
export { normalizeMediaProviderId } from "./provider-id.js";
export declare function buildMediaUnderstandingRegistry(overrides?: Record<string, MediaUnderstandingProvider>, cfg?: KovaConfig): Map<string, MediaUnderstandingProvider>;
export declare function getMediaUnderstandingProvider(id: string, registry: Map<string, MediaUnderstandingProvider>): MediaUnderstandingProvider | undefined;
