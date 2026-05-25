/**
 * Global Plugin Hook Runner
 *
 * Singleton hook runner that's initialized when plugins are loaded
 * and can be called from anywhere in the codebase.
 */
import type { GlobalHookRunnerRegistry } from "./hook-registry.types.js";
import type { PluginHookGatewayContext, PluginHookGatewayStopEvent } from "./hook-types.js";
import { type HookRunner } from "./hooks.js";
export type GlobalHookRunnerRuntimeSubagentMode = "default" | "explicit" | "gateway-bindable";
/**
 * Initialize the global hook runner with a plugin registry.
 * Called once when plugins are loaded during gateway startup.
 */
export declare function initializeGlobalHookRunner(registry: GlobalHookRunnerRegistry, options?: {
    runtimeSubagentMode?: GlobalHookRunnerRuntimeSubagentMode;
}): void;
/**
 * Get the global hook runner.
 * Returns null if plugins haven't been loaded yet.
 */
export declare function getGlobalHookRunner(): HookRunner | null;
/**
 * Get the global plugin registry.
 * Returns null if plugins haven't been loaded yet.
 */
export declare function getGlobalPluginRegistry(): GlobalHookRunnerRegistry | null;
export declare function getGlobalHookRunnerRuntimeSubagentMode(): GlobalHookRunnerRuntimeSubagentMode | null;
/**
 * Check if any hooks are registered for a given hook name.
 */
export declare function hasGlobalHooks(hookName: Parameters<HookRunner["hasHooks"]>[0]): boolean;
export declare function runGlobalGatewayStopSafely(params: {
    event: PluginHookGatewayStopEvent;
    ctx: PluginHookGatewayContext;
    onError?: (err: unknown) => void;
}): Promise<void>;
export declare function runGlobalGatewayStartSafely(params: {
    event: Parameters<HookRunner["runGatewayStart"]>[0];
    ctx: Parameters<HookRunner["runGatewayStart"]>[1];
    onError?: (err: unknown) => void;
}): Promise<void>;
/**
 * Reset the global hook runner (for testing).
 */
export declare function resetGlobalHookRunner(): void;
