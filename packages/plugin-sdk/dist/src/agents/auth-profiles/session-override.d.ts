import type { SessionEntry } from "../../config/sessions/types.js";
import type { KovaConfig } from "../../config/types.kova.js";
export declare function clearSessionAuthProfileOverride(params: {
    sessionEntry: SessionEntry;
    sessionStore: Record<string, SessionEntry>;
    sessionKey: string;
    storePath?: string;
}): Promise<void>;
export declare function resolveSessionAuthProfileOverride(params: {
    cfg: KovaConfig;
    provider: string;
    agentDir: string;
    sessionEntry?: SessionEntry;
    sessionStore?: Record<string, SessionEntry>;
    sessionKey?: string;
    storePath?: string;
    isNewSession: boolean;
}): Promise<string | undefined>;
