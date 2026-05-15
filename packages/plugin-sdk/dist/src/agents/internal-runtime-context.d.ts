export declare const INTERNAL_RUNTIME_CONTEXT_BEGIN = "<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>";
export declare const INTERNAL_RUNTIME_CONTEXT_END = "<<<END_OPENCLAW_INTERNAL_CONTEXT>>>";
export declare const KOVA_RUNTIME_CONTEXT_CUSTOM_TYPE = "kova.runtime-context";
export declare const LEGACY_OPENCLAW_RUNTIME_CONTEXT_CUSTOM_TYPE = "openclaw.runtime-context";
export declare function escapeInternalRuntimeContextDelimiters(value: string): string;
export declare function stripInternalRuntimeContext(text: string): string;
export declare function hasInternalRuntimeContext(text: string): boolean;
export declare function stripRuntimeContextCustomMessages<T>(messages: T[]): T[];
/** Removes stale runtime-context custom messages while preserving current-turn context. */
export declare function stripHistoricalRuntimeContextCustomMessages<T>(messages: T[]): T[];
