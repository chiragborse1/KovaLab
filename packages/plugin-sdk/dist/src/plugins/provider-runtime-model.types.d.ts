import type { Api, Model } from "@mariozechner/pi-ai";
import type { ProviderThinkingLevelId } from "./provider-thinking.types.js";
/**
 * Fully-resolved runtime model shape used after provider/plugin-owned
 * discovery, overrides, and compat normalization.
 */
export type ProviderRuntimeModel = Model<Api> & {
    contextTokens?: number;
    params?: Record<string, unknown>;
    requestTimeoutMs?: number;
    thinkingLevelMap?: Partial<Record<ProviderThinkingLevelId, string | null>>;
};
