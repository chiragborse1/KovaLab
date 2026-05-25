import type { KovaConfig } from "../config/types.kova.js";
export type CancelAcpSessionAdmin = (params: {
    cfg: KovaConfig;
    sessionKey: string;
    reason: string;
}) => Promise<void>;
export type KillSubagentRunAdminResult = {
    found: boolean;
    killed: boolean;
    runId?: string;
    sessionKey?: string;
    cascadeKilled?: number;
    cascadeLabels?: string[];
};
export type KillSubagentRunAdmin = (params: {
    cfg: KovaConfig;
    sessionKey: string;
}) => Promise<KillSubagentRunAdminResult>;
export type TaskRegistryControlRuntime = {
    getAcpSessionManager: () => {
        cancelSession: CancelAcpSessionAdmin;
    };
    killSubagentRunAdmin: KillSubagentRunAdmin;
};
