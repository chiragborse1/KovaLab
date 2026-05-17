/**
 * Global Plugin Hook Runner
 *
 * Singleton hook runner that's initialized when plugins are loaded
 * and can be called from anywhere in the codebase.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveGlobalSingleton } from "../shared/global-singleton.js";
import type { GlobalHookRunnerRegistry } from "./hook-registry.types.js";
import type { PluginHookGatewayContext, PluginHookGatewayStopEvent } from "./hook-types.js";
import { createHookRunner, type HookRunner } from "./hooks.js";

export type GlobalHookRunnerRuntimeSubagentMode = "default" | "explicit" | "gateway-bindable";

type HookRunnerGlobalState = {
  hookRunner: HookRunner | null;
  registry: GlobalHookRunnerRegistry | null;
  runtimeSubagentMode: GlobalHookRunnerRuntimeSubagentMode | null;
  lastGatewayStart: {
    event: Parameters<HookRunner["runGatewayStart"]>[0];
    ctx: Parameters<HookRunner["runGatewayStart"]>[1];
  } | null;
};

const hookRunnerGlobalStateKey = Symbol.for("kova.plugins.hook-runner-global-state");
const getState = () =>
  resolveGlobalSingleton<HookRunnerGlobalState>(hookRunnerGlobalStateKey, () => ({
    hookRunner: null,
    registry: null,
    runtimeSubagentMode: null,
    lastGatewayStart: null,
  }));

const getLog = () => createSubsystemLogger("plugins");

/**
 * Initialize the global hook runner with a plugin registry.
 * Called once when plugins are loaded during gateway startup.
 */
export function initializeGlobalHookRunner(
  registry: GlobalHookRunnerRegistry,
  options?: { runtimeSubagentMode?: GlobalHookRunnerRuntimeSubagentMode },
): void {
  const state = getState();
  const log = getLog();
  state.registry = registry;
  state.runtimeSubagentMode = options?.runtimeSubagentMode ?? "default";
  state.hookRunner = createHookRunner(registry, {
    logger: {
      debug: (msg) => log.debug(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg),
    },
    catchErrors: true,
    failurePolicyByHook: {
      before_tool_call: "fail-closed",
    },
  });

  const hookCount = registry.hooks.length;
  if (hookCount > 0) {
    log.debug(`hook runner initialized with ${hookCount} registered hooks`);
  }
  replayGatewayStartForCurrentRunner(state);
}

/**
 * Get the global hook runner.
 * Returns null if plugins haven't been loaded yet.
 */
export function getGlobalHookRunner(): HookRunner | null {
  return getState().hookRunner;
}

/**
 * Get the global plugin registry.
 * Returns null if plugins haven't been loaded yet.
 */
export function getGlobalPluginRegistry(): GlobalHookRunnerRegistry | null {
  return getState().registry;
}

export function getGlobalHookRunnerRuntimeSubagentMode(): GlobalHookRunnerRuntimeSubagentMode | null {
  return getState().runtimeSubagentMode;
}

function replayGatewayStartForCurrentRunner(state: HookRunnerGlobalState): void {
  const log = getLog();
  const replay = state.lastGatewayStart;
  const hookRunner = state.hookRunner;
  if (!replay || !hookRunner?.hasHooks("gateway_start")) {
    return;
  }
  void hookRunner.runGatewayStart(replay.event, replay.ctx).catch((err) => {
    log.warn(`gateway_start hook replay failed: ${String(err)}`);
  });
}

/**
 * Check if any hooks are registered for a given hook name.
 */
export function hasGlobalHooks(hookName: Parameters<HookRunner["hasHooks"]>[0]): boolean {
  return getState().hookRunner?.hasHooks(hookName) ?? false;
}

export async function runGlobalGatewayStopSafely(params: {
  event: PluginHookGatewayStopEvent;
  ctx: PluginHookGatewayContext;
  onError?: (err: unknown) => void;
}): Promise<void> {
  const log = getLog();
  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("gateway_stop")) {
    return;
  }
  try {
    await hookRunner.runGatewayStop(params.event, params.ctx);
  } catch (err) {
    if (params.onError) {
      params.onError(err);
      return;
    }
    log.warn(`gateway_stop hook failed: ${String(err)}`);
  }
}

export async function runGlobalGatewayStartSafely(params: {
  event: Parameters<HookRunner["runGatewayStart"]>[0];
  ctx: Parameters<HookRunner["runGatewayStart"]>[1];
  onError?: (err: unknown) => void;
}): Promise<void> {
  const state = getState();
  state.lastGatewayStart = { event: params.event, ctx: params.ctx };
  const log = getLog();
  const hookRunner = state.hookRunner;
  if (!hookRunner?.hasHooks("gateway_start")) {
    return;
  }
  try {
    await hookRunner.runGatewayStart(params.event, params.ctx);
  } catch (err) {
    if (params.onError) {
      params.onError(err);
      return;
    }
    log.warn(`gateway_start hook failed: ${String(err)}`);
  }
}

/**
 * Reset the global hook runner (for testing).
 */
export function resetGlobalHookRunner(): void {
  const state = getState();
  state.hookRunner = null;
  state.registry = null;
  state.runtimeSubagentMode = null;
  state.lastGatewayStart = null;
}
