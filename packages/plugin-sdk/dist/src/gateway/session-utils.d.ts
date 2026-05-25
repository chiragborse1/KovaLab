import type { ModelCatalogEntry } from "../agents/model-catalog.js";
import { listThinkingLevelOptions } from "../auto-reply/thinking.js";
import { type SessionEntry, type SessionScope } from "../config/sessions.js";
import type { KovaConfig } from "../config/types.kova.js";
import type { ModelCostConfig } from "../utils/usage-format.js";
import type { GatewayAgentRow, GatewaySessionRow, GatewaySessionsDefaults, SessionsListResult } from "./session-utils.types.js";
export { archiveFileOnDisk, archiveSessionTranscripts, attachKovaTranscriptMeta, capArrayByJsonBytes, readFirstUserMessageFromTranscript, readLastMessagePreviewFromTranscript, readLatestSessionUsageFromTranscript, readSessionTitleFieldsFromTranscript, readSessionPreviewItemsFromTranscript, readSessionMessages, resolveSessionTranscriptCandidates, } from "./session-utils.fs.js";
export { canonicalizeSpawnedByForAgent, resolveSessionStoreKey } from "./session-store-key.js";
export type { GatewayAgentRow, GatewaySessionRow, GatewaySessionsDefaults, SessionsListResult, SessionsPatchResult, SessionsPreviewEntry, SessionsPreviewResult, } from "./session-utils.types.js";
export declare function deriveSessionTitle(entry: SessionEntry | undefined, firstUserMessage?: string | null): string | undefined;
type SessionListRowContext = {
    modelCostConfigByModelRef: Map<string, ModelCostConfig | undefined>;
    thinkingMetadataByModelRef: Map<string, {
        levels: ReturnType<typeof listThinkingLevelOptions>;
        defaultLevel: ReturnType<typeof resolveGatewaySessionThinkingDefault>;
    }>;
};
/**
 * Returns the owning agent id if the session key belongs to an agent that is no
 * longer present in config (deleted). Returns null for non-agent legacy/global
 * keys, or when the owning agent still exists (#65524).
 */
export declare function resolveDeletedAgentIdFromSessionKey(cfg: KovaConfig, sessionKey: string): string | null;
export declare function loadSessionEntry(sessionKey: string): {
    cfg: KovaConfig;
    storePath: string;
    store: Record<string, SessionEntry>;
    entry: SessionEntry | undefined;
    canonicalKey: string;
    legacyKey: string | undefined;
};
export declare function resolveFreshestSessionStoreMatchFromStoreKeys(store: Record<string, SessionEntry>, storeKeys: string[]): {
    key: string;
    entry: SessionEntry;
} | undefined;
export declare function resolveFreshestSessionEntryFromStoreKeys(store: Record<string, SessionEntry>, storeKeys: string[]): SessionEntry | undefined;
/**
 * Find all on-disk store keys that match the given key case-insensitively.
 * Returns every key from the store whose lowercased form equals the target's lowercased form.
 */
export declare function findStoreKeysIgnoreCase(store: Record<string, unknown>, targetKey: string): string[];
/**
 * Remove legacy key variants for one canonical session key.
 * Candidates can include aliases (for example, "agent:ops:main" when canonical is "agent:ops:work").
 */
export declare function pruneLegacyStoreKeys(params: {
    store: Record<string, unknown>;
    canonicalKey: string;
    candidates: Iterable<string>;
}): void;
export declare function migrateAndPruneGatewaySessionStoreKey(params: {
    cfg: KovaConfig;
    key: string;
    store: Record<string, SessionEntry>;
}): {
    target: {
        agentId: string;
        storePath: string;
        canonicalKey: string;
        storeKeys: string[];
    };
    primaryKey: string;
    entry: SessionEntry;
};
export declare function classifySessionKey(key: string, entry?: SessionEntry): GatewaySessionRow["kind"];
export declare function parseGroupKey(key: string): {
    channel?: string;
    kind?: "group" | "channel";
    id?: string;
} | null;
export declare function listAgentsForGateway(cfg: KovaConfig): {
    defaultId: string;
    mainKey: string;
    scope: SessionScope;
    agents: GatewayAgentRow[];
};
export declare function resolveGatewaySessionStoreTarget(params: {
    cfg: KovaConfig;
    key: string;
    scanLegacyKeys?: boolean;
    store?: Record<string, SessionEntry>;
}): {
    agentId: string;
    storePath: string;
    canonicalKey: string;
    storeKeys: string[];
};
export { loadCombinedSessionStoreForGateway } from "../config/sessions/combined-store-gateway.js";
declare function resolveGatewaySessionThinkingDefault(params: {
    cfg: KovaConfig;
    provider: string;
    model: string;
    agentId?: string;
}): "adaptive" | "high" | "low" | "max" | "medium" | "minimal" | "off" | "xhigh";
export declare function getSessionDefaults(cfg: KovaConfig): GatewaySessionsDefaults;
export declare function resolveSessionModelRef(cfg: KovaConfig, entry?: SessionEntry | Pick<SessionEntry, "model" | "modelProvider" | "modelOverride" | "providerOverride">, agentId?: string): {
    provider: string;
    model: string;
};
export declare function resolveGatewayModelSupportsImages(params: {
    loadGatewayModelCatalog: () => Promise<ModelCatalogEntry[]>;
    provider?: string;
    model?: string;
}): Promise<boolean>;
export declare function resolveSessionModelIdentityRef(cfg: KovaConfig, entry?: SessionEntry | Pick<SessionEntry, "model" | "modelProvider" | "modelOverride" | "providerOverride">, agentId?: string, fallbackModelRef?: string): {
    provider?: string;
    model: string;
};
export declare function buildGatewaySessionRow(params: {
    cfg: KovaConfig;
    storePath: string;
    store: Record<string, SessionEntry>;
    key: string;
    entry?: SessionEntry;
    now?: number;
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
    rowContext?: SessionListRowContext;
}): GatewaySessionRow;
export declare function loadGatewaySessionRow(sessionKey: string, options?: {
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
    now?: number;
}): GatewaySessionRow | null;
export declare function listSessionsFromStore(params: {
    cfg: KovaConfig;
    storePath: string;
    store: Record<string, SessionEntry>;
    opts: import("./protocol/index.js").SessionsListParams;
}): SessionsListResult;
