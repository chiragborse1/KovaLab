import type { SessionEntry } from "../config/sessions.js";
import type { KovaConfig } from "../config/types.kova.js";
import { type ExecAsk, type ExecHost, type ExecSecurity, type ExecTarget } from "../infra/exec-approvals.js";
export declare function canExecRequestNode(params: {
    cfg?: KovaConfig;
    sessionEntry?: SessionEntry;
    agentId?: string;
    sessionKey?: string;
    sandboxAvailable?: boolean;
}): boolean;
export declare function resolveExecDefaults(params: {
    cfg?: KovaConfig;
    sessionEntry?: SessionEntry;
    agentId?: string;
    sessionKey?: string;
    sandboxAvailable?: boolean;
}): {
    host: ExecTarget;
    effectiveHost: ExecHost;
    security: ExecSecurity;
    ask: ExecAsk;
    node?: string;
    canRequestNode: boolean;
};
