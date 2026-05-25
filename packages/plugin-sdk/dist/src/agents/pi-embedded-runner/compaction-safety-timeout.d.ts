import type { KovaConfig } from "../../config/types.kova.js";
import type { CompactResult, ContextEngine } from "../../context-engine/types.js";
export declare const EMBEDDED_COMPACTION_TIMEOUT_MS = 900000;
export declare function resolveCompactionTimeoutMs(cfg?: KovaConfig): number;
export declare function compactWithSafetyTimeout<T>(compact: (abortSignal?: AbortSignal) => Promise<T>, timeoutMs?: number, opts?: {
    abortSignal?: AbortSignal;
    onCancel?: () => void;
}): Promise<T>;
export type ContextEngineCompactParams = Parameters<ContextEngine["compact"]>[0];
export declare function compactContextEngineWithSafetyTimeout(contextEngine: Pick<ContextEngine, "compact">, params: ContextEngineCompactParams, timeoutMs?: number, abortSignal?: AbortSignal): Promise<CompactResult>;
