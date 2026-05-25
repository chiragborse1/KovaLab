import { type SessionAcpMeta, type SessionEntry } from "../../config/sessions/types.js";
import type { KovaConfig } from "../../config/types.kova.js";
export type AcpSessionStoreEntry = {
    cfg: KovaConfig;
    storePath: string;
    sessionKey: string;
    storeSessionKey: string;
    entry?: SessionEntry;
    acp?: SessionAcpMeta;
    storeReadFailed?: boolean;
};
export declare function resolveSessionStorePathForAcp(params: {
    sessionKey: string;
    cfg?: KovaConfig;
}): {
    cfg: KovaConfig;
    storePath: string;
};
export declare function readAcpSessionEntry(params: {
    sessionKey: string;
    cfg?: KovaConfig;
}): AcpSessionStoreEntry | null;
export declare function listAcpSessionEntries(params: {
    cfg?: KovaConfig;
    env?: NodeJS.ProcessEnv;
}): Promise<AcpSessionStoreEntry[]>;
export declare function upsertAcpSessionMeta(params: {
    sessionKey: string;
    cfg?: KovaConfig;
    mutate: (current: SessionAcpMeta | undefined, entry: SessionEntry | undefined) => SessionAcpMeta | null | undefined;
}): Promise<SessionEntry | null>;
