import type { SessionEntry } from "../config/sessions.js";
import type { KovaConfig } from "../config/types.kova.js";
export type FastModeState = {
    enabled: boolean;
    source: "session" | "agent" | "config" | "default";
};
export declare function resolveFastModeState(params: {
    cfg: KovaConfig | undefined;
    provider: string;
    model: string;
    agentId?: string;
    sessionEntry?: Pick<SessionEntry, "fastMode"> | undefined;
}): FastModeState;
