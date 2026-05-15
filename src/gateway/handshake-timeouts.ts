export const DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS = 10_000;
export const MIN_CONNECT_CHALLENGE_TIMEOUT_MS = 250;
export const MAX_CONNECT_CHALLENGE_TIMEOUT_MS = DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
export const PREAUTH_HANDSHAKE_TIMER_DELAY_GRACE_MS = 5_000;

export type PreauthHandshakeTimeoutAction =
  | { action: "close"; timerDelayMs: number }
  | { action: "extend"; graceMs: number; timerDelayMs: number };

export function clampConnectChallengeTimeoutMs(timeoutMs: number): number {
  return Math.max(
    MIN_CONNECT_CHALLENGE_TIMEOUT_MS,
    Math.min(MAX_CONNECT_CHALLENGE_TIMEOUT_MS, timeoutMs),
  );
}

export function getConnectChallengeTimeoutMsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): number | undefined {
  const raw = env.KOVA_CONNECT_CHALLENGE_TIMEOUT_MS;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

export function resolveConnectChallengeTimeoutMs(timeoutMs?: number | null): number {
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs)) {
    return clampConnectChallengeTimeoutMs(timeoutMs);
  }
  const envOverride = getConnectChallengeTimeoutMsFromEnv();
  if (envOverride !== undefined) {
    return clampConnectChallengeTimeoutMs(envOverride);
  }
  return DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
}

export function getPreauthHandshakeTimeoutMsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const configuredTimeout =
    env.KOVA_HANDSHAKE_TIMEOUT_MS || (env.VITEST && env.KOVA_TEST_HANDSHAKE_TIMEOUT_MS);
  if (configuredTimeout) {
    const parsed = Number(configuredTimeout);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
}

export function resolvePreauthHandshakeTimeoutAction(params: {
  elapsedMs: number;
  timeoutMs: number;
  alreadyExtendedForTimerDelay: boolean;
}): PreauthHandshakeTimeoutAction {
  const timeoutMs = Math.max(1, Math.floor(params.timeoutMs));
  const elapsedMs = Math.max(0, Math.floor(params.elapsedMs));
  const timerDelayMs = Math.max(0, elapsedMs - timeoutMs);
  const delayThresholdMs = Math.max(1_000, timeoutMs * 0.5);
  if (!params.alreadyExtendedForTimerDelay && timerDelayMs >= delayThresholdMs) {
    return {
      action: "extend",
      graceMs: Math.min(PREAUTH_HANDSHAKE_TIMER_DELAY_GRACE_MS, delayThresholdMs),
      timerDelayMs,
    };
  }
  return { action: "close", timerDelayMs };
}
