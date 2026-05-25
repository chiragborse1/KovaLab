import type { KovaConfig } from "../../config/types.kova.js";
import type { PluginHookSessionEndEvent, PluginHookSessionEndReason, PluginHookSessionStartEvent } from "../../plugins/hook-types.js";
export type SessionHookContext = {
    sessionId: string;
    sessionKey: string;
    agentId: string;
};
export declare function buildSessionStartHookPayload(params: {
    sessionId: string;
    sessionKey: string;
    cfg: KovaConfig;
    resumedFrom?: string;
}): {
    event: PluginHookSessionStartEvent;
    context: SessionHookContext;
};
export declare function buildSessionEndHookPayload(params: {
    sessionId: string;
    sessionKey: string;
    cfg: KovaConfig;
    messageCount?: number;
    durationMs?: number;
    reason?: PluginHookSessionEndReason;
    sessionFile?: string;
    transcriptArchived?: boolean;
    nextSessionId?: string;
    nextSessionKey?: string;
}): {
    event: PluginHookSessionEndEvent;
    context: SessionHookContext;
};
