export declare const INTERNAL_RUNTIME_CONTEXT_BEGIN = "<<<BEGIN_KOVA_INTERNAL_CONTEXT>>>";
export declare const INTERNAL_RUNTIME_CONTEXT_END = "<<<END_KOVA_INTERNAL_CONTEXT>>>";
export declare const KOVA_RUNTIME_CONTEXT_CUSTOM_TYPE = "kova.runtime-context";
export declare const LEGACY_KOVA_RUNTIME_CONTEXT_CUSTOM_TYPE = "kova.runtime-context";
export declare const KOVA_RUNTIME_CONTEXT_NOTICE = "This context is runtime-generated, not user-authored. Keep internal details private.";
export declare const KOVA_NEXT_TURN_RUNTIME_CONTEXT_HEADER = "Kova runtime context for the immediately preceding user message.";
export declare const KOVA_RUNTIME_EVENT_HEADER = "Kova runtime event.";
export declare function escapeInternalRuntimeContextDelimiters(value: string): string;
export declare function stripInternalRuntimeContext(text: string): string;
export declare function hasInternalRuntimeContext(text: string): boolean;
export declare function stripRuntimeContextCustomMessages<T>(messages: T[]): T[];
/** Removes stale runtime-context custom messages while preserving current-turn context. */
export declare function stripHistoricalRuntimeContextCustomMessages<T>(messages: T[]): T[];
