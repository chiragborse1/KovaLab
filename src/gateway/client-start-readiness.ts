import type { GatewayClientOptions } from "./client.js";
import { waitForEventLoopReady, type EventLoopReadyResult } from "./event-loop-ready.js";
import { resolveConnectChallengeTimeoutMs } from "./handshake-timeouts.js";

export type GatewayClientStartable = {
  start(): void;
};

export type EventLoopReadyWaiter = (
  options?: Parameters<typeof waitForEventLoopReady>[0],
) => Promise<EventLoopReadyResult>;

export type GatewayClientStartReadinessOptions = {
  timeoutMs?: number;
  clientOptions?: Pick<GatewayClientOptions, "connectChallengeTimeoutMs" | "connectDelayMs">;
  intervalMs?: number;
  driftThresholdMs?: number;
  consecutiveReadyChecks?: number;
  signal?: AbortSignal;
};

function resolveGatewayClientStartReadinessTimeoutMs(
  options: GatewayClientStartReadinessOptions = {},
): number {
  if (typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)) {
    return options.timeoutMs;
  }
  const clientOptions = options.clientOptions ?? {};
  const timeoutOverride =
    typeof clientOptions.connectChallengeTimeoutMs === "number" &&
    Number.isFinite(clientOptions.connectChallengeTimeoutMs)
      ? clientOptions.connectChallengeTimeoutMs
      : typeof clientOptions.connectDelayMs === "number" &&
          Number.isFinite(clientOptions.connectDelayMs)
        ? clientOptions.connectDelayMs
        : undefined;
  return resolveConnectChallengeTimeoutMs(timeoutOverride);
}

export async function startGatewayClientWithReadinessWait(
  waitForReady: EventLoopReadyWaiter,
  client: GatewayClientStartable,
  options: GatewayClientStartReadinessOptions = {},
): Promise<EventLoopReadyResult> {
  const readiness = await waitForReady({
    maxWaitMs: resolveGatewayClientStartReadinessTimeoutMs(options),
    intervalMs: options.intervalMs,
    driftThresholdMs: options.driftThresholdMs,
    consecutiveReadyChecks: options.consecutiveReadyChecks,
    signal: options.signal,
  });
  if (readiness.ready && !readiness.aborted && options.signal?.aborted !== true) {
    client.start();
  }
  return readiness;
}

export async function startGatewayClientWhenEventLoopReady(
  client: GatewayClientStartable,
  options: GatewayClientStartReadinessOptions = {},
): Promise<EventLoopReadyResult> {
  return startGatewayClientWithReadinessWait(waitForEventLoopReady, client, options);
}
