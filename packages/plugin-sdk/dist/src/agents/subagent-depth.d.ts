import type { KovaConfig } from "../config/types.kova.js";
type SessionDepthEntry = {
    sessionId?: unknown;
    spawnDepth?: unknown;
    spawnedBy?: unknown;
};
export declare function getSubagentDepthFromSessionStore(sessionKey: string | undefined | null, opts?: {
    cfg?: KovaConfig;
    store?: Record<string, SessionDepthEntry>;
}): number;
export {};
