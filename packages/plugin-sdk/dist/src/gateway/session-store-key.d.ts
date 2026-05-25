import type { KovaConfig } from "../config/types.kova.js";
export declare function canonicalizeSessionKeyForAgent(agentId: string, key: string): string;
export declare function resolveSessionStoreKey(params: {
    cfg: KovaConfig;
    sessionKey: string;
    storeAgentId?: string;
}): string;
export declare function resolveSessionStoreAgentId(cfg: KovaConfig, canonicalKey: string): string;
export declare function resolveStoredSessionKeyForAgentStore(params: {
    cfg: KovaConfig;
    agentId: string;
    sessionKey: string;
}): string;
export declare function resolveStoredSessionOwnerAgentId(params: {
    cfg: KovaConfig;
    agentId: string;
    sessionKey: string;
}): string | null;
export declare function canonicalizeSpawnedByForAgent(cfg: KovaConfig, agentId: string, spawnedBy?: string): string | undefined;
