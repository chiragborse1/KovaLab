import type { KovaConfig } from "../types.kova.js";
export type SessionStoreSelectionOptions = {
    store?: string;
    agent?: string;
    allAgents?: boolean;
};
export type SessionStoreTarget = {
    agentId: string;
    storePath: string;
};
export declare function resolveAllAgentSessionStoreTargetsSync(cfg: KovaConfig, params?: {
    env?: NodeJS.ProcessEnv;
}): SessionStoreTarget[];
export declare function resolveAllAgentSessionStoreTargets(cfg: KovaConfig, params?: {
    env?: NodeJS.ProcessEnv;
}): Promise<SessionStoreTarget[]>;
export declare function resolveSessionStoreTargets(cfg: KovaConfig, opts: SessionStoreSelectionOptions, params?: {
    env?: NodeJS.ProcessEnv;
}): SessionStoreTarget[];
