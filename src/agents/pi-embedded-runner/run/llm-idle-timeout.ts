import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { DEFAULT_LLM_IDLE_TIMEOUT_SECONDS } from "../../../config/agent-timeout-defaults.js";
import type { KovaConfig } from "../../../config/types.kova.js";
import { createStreamIteratorWrapper } from "../../stream-iterator-wrapper.js";
import type { EmbeddedRunTrigger } from "./params.js";

/**
 * Default idle timeout for LLM streaming responses in milliseconds.
 */
export const DEFAULT_LLM_IDLE_TIMEOUT_MS = DEFAULT_LLM_IDLE_TIMEOUT_SECONDS * 1000;

/**
 * Maximum safe timeout value (approximately 24.8 days).
 */
const MAX_SAFE_TIMEOUT_MS = 2_147_000_000;

function isLocalProviderBaseUrl(baseUrl: string): boolean {
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "::ffff:7f00:1" ||
    host === "::ffff:127.0.0.1" ||
    host.endsWith(".local")
  ) {
    return true;
  }
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) {
    return true;
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return false;
  }
  const octets = host.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = octets;
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b !== undefined && b >= 64 && b <= 127)
  );
}

function isOllamaCloudModel(model: { id?: string; provider?: string } | undefined): boolean {
  const rawModelId = model?.id;
  if (typeof rawModelId !== "string") {
    return false;
  }
  const provider = model?.provider?.trim().toLowerCase();
  if (provider && !provider.startsWith("ollama")) {
    return false;
  }
  const modelId = rawModelId.trim().toLowerCase();
  const slashIndex = modelId.indexOf("/");
  const bareModelId = slashIndex >= 0 ? modelId.slice(slashIndex + 1) : modelId;
  return bareModelId.endsWith(":cloud");
}

/**
 * Resolves the LLM idle timeout from configuration.
 * @returns Idle timeout in milliseconds, or 0 to disable
 */
export function resolveLlmIdleTimeoutMs(params?: {
  cfg?: KovaConfig;
  trigger?: EmbeddedRunTrigger;
  runTimeoutMs?: number;
  modelRequestTimeoutMs?: number;
  model?: { baseUrl?: string; id?: string; provider?: string };
}): number {
  const clampTimeoutMs = (valueMs: number) => Math.min(Math.floor(valueMs), MAX_SAFE_TIMEOUT_MS);
  const clampImplicitTimeoutMs = (valueMs: number) =>
    clampTimeoutMs(Math.min(valueMs, DEFAULT_LLM_IDLE_TIMEOUT_MS));

  const runTimeoutMs = params?.runTimeoutMs;
  if (typeof runTimeoutMs === "number" && Number.isFinite(runTimeoutMs) && runTimeoutMs > 0) {
    if (runTimeoutMs >= MAX_SAFE_TIMEOUT_MS) {
      return 0;
    }
  }

  const agentTimeoutSeconds = params?.cfg?.agents?.defaults?.timeoutSeconds;
  const agentTimeoutMs =
    typeof agentTimeoutSeconds === "number" &&
    Number.isFinite(agentTimeoutSeconds) &&
    agentTimeoutSeconds > 0
      ? agentTimeoutSeconds * 1000
      : undefined;
  const timeoutBounds = [runTimeoutMs, agentTimeoutMs].filter(
    (value): value is number =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0 &&
      value < MAX_SAFE_TIMEOUT_MS,
  );
  const baseUrl = params?.model?.baseUrl;
  const isLocalProvider =
    typeof baseUrl === "string" && baseUrl.length > 0 && isLocalProviderBaseUrl(baseUrl);

  const modelRequestTimeoutMs = params?.modelRequestTimeoutMs;
  if (
    typeof modelRequestTimeoutMs === "number" &&
    Number.isFinite(modelRequestTimeoutMs) &&
    modelRequestTimeoutMs > 0
  ) {
    // `modelRequestTimeoutMs` is wired from `models.providers.<id>.timeoutSeconds`,
    // which is an explicit per-provider opt-in. Honor it as a deliberate ceiling
    // rather than clamping cloud providers back down to the implicit default
    // network-silence watchdog. The agent/run timeout bounds still apply, so an
    // explicit shorter run timeout always wins.
    const boundedTimeoutMs = Math.min(modelRequestTimeoutMs, ...timeoutBounds);
    return clampTimeoutMs(boundedTimeoutMs);
  }

  if (typeof runTimeoutMs === "number" && Number.isFinite(runTimeoutMs) && runTimeoutMs > 0) {
    if (params?.trigger === "cron") {
      return clampTimeoutMs(runTimeoutMs);
    }
    return clampImplicitTimeoutMs(runTimeoutMs);
  }

  if (agentTimeoutMs !== undefined) {
    return clampImplicitTimeoutMs(agentTimeoutMs);
  }

  if (params?.trigger === "cron") {
    return 0;
  }

  if (isLocalProvider && !isOllamaCloudModel(params?.model)) {
    return 0;
  }

  return DEFAULT_LLM_IDLE_TIMEOUT_MS;
}

/**
 * Wraps a stream function with idle timeout detection.
 * If no token is received within the specified timeout, the request is aborted.
 *
 * @param baseFn - The base stream function to wrap
 * @param timeoutMs - Idle timeout in milliseconds
 * @param onIdleTimeout - Optional callback invoked when idle timeout triggers
 * @returns A wrapped stream function with idle timeout detection
 */
export function streamWithIdleTimeout(
  baseFn: StreamFn,
  timeoutMs: number,
  onIdleTimeout?: (error: Error) => void,
): StreamFn {
  return (model, context, options) => {
    const createIdleTimeoutError = () =>
      new Error(`LLM idle timeout (${Math.floor(timeoutMs / 1000)}s): no response from model`);

    const streamAbortController = new AbortController();
    const sourceSignal = options?.signal;
    const abortStream = (reason?: unknown) => {
      if (!streamAbortController.signal.aborted) {
        streamAbortController.abort(reason);
      }
    };
    const abortFromSourceSignal = () => abortStream(sourceSignal?.reason);
    if (sourceSignal?.aborted) {
      abortFromSourceSignal();
    } else {
      sourceSignal?.addEventListener("abort", abortFromSourceSignal, { once: true });
    }
    const cleanupSourceSignal = () => {
      sourceSignal?.removeEventListener("abort", abortFromSourceSignal);
    };
    const wrappedOptions = {
      ...options,
      signal: streamAbortController.signal,
    } as typeof options;
    const existingRequestTimeoutMs =
      typeof (model as { requestTimeoutMs?: unknown })?.requestTimeoutMs === "number" &&
      Number.isFinite((model as { requestTimeoutMs?: number }).requestTimeoutMs) &&
      (model as { requestTimeoutMs?: number }).requestTimeoutMs! > 0
        ? Math.floor((model as { requestTimeoutMs?: number }).requestTimeoutMs!)
        : timeoutMs;
    const wrappedModel =
      typeof model === "object" && model !== null
        ? ({
            ...model,
            requestTimeoutMs: Math.min(existingRequestTimeoutMs, timeoutMs),
          } as typeof model)
        : model;

    const createTimeoutPromise = (setTimer: (timer: NodeJS.Timeout) => void): Promise<never> =>
      new Promise((_, reject) => {
        const timer = setTimeout(() => {
          const error = createIdleTimeoutError();
          abortStream(error);
          onIdleTimeout?.(error);
          reject(error);
        }, timeoutMs);
        timer.unref?.();
        setTimer(timer);
      });

    let maybeStream: ReturnType<StreamFn>;
    try {
      maybeStream = baseFn(wrappedModel, context, wrappedOptions);
    } catch (error) {
      cleanupSourceSignal();
      throw error;
    }

    const wrapStream = (stream: ReturnType<typeof streamSimple>) => {
      const originalAsyncIterator = stream[Symbol.asyncIterator].bind(stream);
      (stream as { [Symbol.asyncIterator]: typeof originalAsyncIterator })[Symbol.asyncIterator] =
        function () {
          const iterator = originalAsyncIterator();
          let idleTimer: NodeJS.Timeout | null = null;

          const clearTimer = () => {
            if (idleTimer) {
              clearTimeout(idleTimer);
              idleTimer = null;
            }
          };

          return createStreamIteratorWrapper({
            iterator,
            next: async (streamIterator) => {
              clearTimer();

              try {
                // Race between the actual next() and the timeout
                const result = await Promise.race([
                  streamIterator.next(),
                  createTimeoutPromise((timer) => {
                    idleTimer = timer;
                  }),
                ]);

                if (result.done) {
                  clearTimer();
                  cleanupSourceSignal();
                  return result;
                }

                clearTimer();
                return result;
              } catch (error) {
                clearTimer();
                throw error;
              }
            },
            onReturn(streamIterator) {
              clearTimer();
              cleanupSourceSignal();
              return streamIterator.return?.() ?? Promise.resolve({ done: true, value: undefined });
            },
            onThrow(streamIterator, error) {
              clearTimer();
              cleanupSourceSignal();
              return streamIterator.throw?.(error) ?? Promise.reject(error);
            },
          });
        };

      return stream;
    };

    if (maybeStream && typeof maybeStream === "object" && "then" in maybeStream) {
      let streamPromiseTimer: NodeJS.Timeout | null = null;
      const clearStreamPromiseTimer = () => {
        if (streamPromiseTimer) {
          clearTimeout(streamPromiseTimer);
          streamPromiseTimer = null;
        }
      };
      return Promise.race([
        Promise.resolve(maybeStream),
        createTimeoutPromise((timer) => {
          streamPromiseTimer = timer;
        }),
      ]).then(
        (stream) => {
          clearStreamPromiseTimer();
          return wrapStream(stream);
        },
        (error) => {
          clearStreamPromiseTimer();
          cleanupSourceSignal();
          throw error;
        },
      );
    }
    return wrapStream(maybeStream);
  };
}
