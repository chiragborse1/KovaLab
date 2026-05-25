import type { SessionEntry } from "../../config/sessions/types.js";
import type { KovaConfig } from "../../config/types.kova.js";
export declare function resolveCronSession(params: {
    cfg: KovaConfig;
    sessionKey: string;
    nowMs: number;
    agentId: string;
    forceNew?: boolean;
}): {
    storePath: string;
    store: Record<string, SessionEntry>;
    sessionEntry: SessionEntry;
    systemSent: boolean;
    isNewSession: boolean;
    previousSessionId: string | undefined;
};
