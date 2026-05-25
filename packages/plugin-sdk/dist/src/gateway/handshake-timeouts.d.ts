export declare const DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS = 10000;
export declare const MIN_CONNECT_CHALLENGE_TIMEOUT_MS = 250;
export declare const MAX_CONNECT_CHALLENGE_TIMEOUT_MS = 10000;
export declare const PREAUTH_HANDSHAKE_TIMER_DELAY_GRACE_MS = 5000;
export type PreauthHandshakeTimeoutAction = {
    action: "close";
    timerDelayMs: number;
} | {
    action: "extend";
    graceMs: number;
    timerDelayMs: number;
};
export declare function clampConnectChallengeTimeoutMs(timeoutMs: number): number;
export declare function getConnectChallengeTimeoutMsFromEnv(env?: NodeJS.ProcessEnv): number | undefined;
export declare function resolveConnectChallengeTimeoutMs(timeoutMs?: number | null): number;
export declare function getPreauthHandshakeTimeoutMsFromEnv(env?: NodeJS.ProcessEnv): number;
export declare function resolvePreauthHandshakeTimeoutAction(params: {
    elapsedMs: number;
    timeoutMs: number;
    alreadyExtendedForTimerDelay: boolean;
}): PreauthHandshakeTimeoutAction;
