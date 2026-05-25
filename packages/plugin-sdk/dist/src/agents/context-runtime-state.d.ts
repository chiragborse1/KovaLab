import type { KovaConfig } from "../config/types.kova.js";
type ContextWindowRuntimeState = {
    loadPromise: Promise<void> | null;
    configuredConfig: KovaConfig | undefined;
    configLoadFailures: number;
    nextConfigLoadAttemptAtMs: number;
    modelsConfigRuntimePromise: Promise<typeof import("./models-config.runtime.js")> | undefined;
};
export declare const CONTEXT_WINDOW_RUNTIME_STATE: ContextWindowRuntimeState;
export declare function resetContextWindowCacheForTest(): void;
export {};
