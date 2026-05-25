import type { KovaConfig } from "../../../config/types.kova.js";
export declare const ATTEMPT_CACHE_TTL_CUSTOM_TYPE = "kova.cache-ttl";
export declare function composeSystemPromptWithHookContext(params: {
    baseSystemPrompt?: string;
    prependSystemContext?: string;
    appendSystemContext?: string;
}): string | undefined;
export declare function resolveAttemptSpawnWorkspaceDir(params: {
    sandbox?: {
        enabled?: boolean;
        workspaceAccess?: string;
    } | null;
    resolvedWorkspace: string;
}): string | undefined;
export declare function shouldUseOpenAIWebSocketTransport(params: {
    provider: string;
    modelApi?: string | null;
    modelBaseUrl?: string | null;
}): boolean;
export declare function shouldAppendAttemptCacheTtl(params: {
    timedOutDuringCompaction: boolean;
    compactionOccurredThisAttempt: boolean;
    config?: KovaConfig;
    provider: string;
    modelId: string;
    modelApi?: string;
    isCacheTtlEligibleProvider: (provider: string, modelId: string, modelApi?: string) => boolean;
}): boolean;
export declare function appendAttemptCacheTtlIfNeeded(params: {
    sessionManager: {
        appendCustomEntry?: (customType: string, data: unknown) => void;
    };
    timedOutDuringCompaction: boolean;
    compactionOccurredThisAttempt: boolean;
    config?: KovaConfig;
    provider: string;
    modelId: string;
    modelApi?: string;
    isCacheTtlEligibleProvider: (provider: string, modelId: string, modelApi?: string) => boolean;
    now?: number;
}): boolean;
export declare function shouldPersistCompletedBootstrapTurn(params: {
    shouldRecordCompletedBootstrapTurn: boolean;
    promptError: unknown;
    aborted: boolean;
    timedOutDuringCompaction: boolean;
    compactionOccurredThisAttempt: boolean;
}): boolean;
