import { type SessionEntry } from "../../config/sessions.js";
import type { KovaConfig } from "../../config/types.kova.js";
type RunResult = Awaited<ReturnType<(typeof import("../pi-embedded.js"))["runEmbeddedPiAgent"]>>;
export declare function updateSessionStoreAfterAgentRun(params: {
    cfg: KovaConfig;
    contextTokensOverride?: number;
    sessionId: string;
    sessionKey: string;
    storePath: string;
    sessionStore: Record<string, SessionEntry>;
    defaultProvider: string;
    defaultModel: string;
    fallbackProvider?: string;
    fallbackModel?: string;
    result: RunResult;
    touchInteraction?: boolean;
}): Promise<void>;
export declare function clearCliSessionInStore(params: {
    provider: string;
    sessionKey: string;
    sessionStore: Record<string, SessionEntry>;
    storePath: string;
}): Promise<SessionEntry | undefined>;
export declare function recordCliCompactionInStore(params: {
    provider: string;
    sessionKey: string;
    sessionStore: Record<string, SessionEntry>;
    storePath: string;
}): Promise<SessionEntry | undefined>;
export {};
