import { listAgentIds } from "../agents/agent-scope.js";
import { getRuntimeConfig } from "../config/config.js";
import {
  loadSessionStore,
  resolveAllAgentSessionStoreTargetsSync,
  resolveAgentMainSessionKey,
  resolveStorePath,
  type SessionEntry,
  type SessionStoreTarget,
} from "../config/sessions.js";
import type { KovaConfig } from "../config/types.kova.js";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import {
  resolveSessionStoreAgentId,
  resolveSessionStoreKey,
  resolveStoredSessionKeyForAgentStore,
} from "./session-store-key.js";

export function loadSessionEntry(sessionKey: string) {
  const cfg = getRuntimeConfig();
  const key = normalizeOptionalString(sessionKey) ?? "";
  const target = resolveGatewaySessionStoreTarget({
    cfg,
    key,
  });
  const storePath = target.storePath;
  const store = loadSessionStore(storePath);
  const freshestMatch = resolveFreshestSessionStoreMatchFromStoreKeys(store, target.storeKeys);
  const legacyKey = freshestMatch?.key !== target.canonicalKey ? freshestMatch?.key : undefined;
  return {
    cfg,
    storePath,
    store,
    entry: freshestMatch?.entry,
    canonicalKey: target.canonicalKey,
    legacyKey,
  };
}

export function resolveFreshestSessionStoreMatchFromStoreKeys(
  store: Record<string, SessionEntry>,
  storeKeys: string[],
): { key: string; entry: SessionEntry } | undefined {
  let freshest: { key: string; entry: SessionEntry } | undefined;
  for (const key of storeKeys) {
    const entry = store[key];
    if (!entry) {
      continue;
    }
    const match = { key, entry };
    if (!freshest || (match.entry.updatedAt ?? 0) > (freshest.entry.updatedAt ?? 0)) {
      freshest = match;
    }
  }
  return freshest;
}

export function resolveFreshestSessionEntryFromStoreKeys(
  store: Record<string, SessionEntry>,
  storeKeys: string[],
): SessionEntry | undefined {
  return resolveFreshestSessionStoreMatchFromStoreKeys(store, storeKeys)?.entry;
}

function findFreshestStoreMatch(
  store: Record<string, SessionEntry>,
  ...candidates: string[]
): { entry: SessionEntry; key: string } | undefined {
  const matches = new Map<string, { entry: SessionEntry; key: string }>();
  for (const candidate of candidates) {
    const trimmed = normalizeOptionalString(candidate) ?? "";
    if (!trimmed) {
      continue;
    }
    const exact = store[trimmed];
    if (exact) {
      matches.set(trimmed, { entry: exact, key: trimmed });
    }
    for (const key of findStoreKeysIgnoreCase(store, trimmed)) {
      const entry = store[key];
      if (entry) {
        matches.set(key, { entry, key });
      }
    }
  }
  if (matches.size === 0) {
    return undefined;
  }
  let freshest: { entry: SessionEntry; key: string } | undefined;
  for (const match of matches.values()) {
    if (!freshest || (match.entry.updatedAt ?? 0) > (freshest.entry.updatedAt ?? 0)) {
      freshest = match;
    }
  }
  return freshest;
}

export function findStoreKeysIgnoreCase(
  store: Record<string, unknown>,
  targetKey: string,
): string[] {
  const lowered = normalizeLowercaseStringOrEmpty(targetKey);
  const matches: string[] = [];
  for (const key of Object.keys(store)) {
    if (normalizeLowercaseStringOrEmpty(key) === lowered) {
      matches.push(key);
    }
  }
  return matches;
}

function isStorePathTemplate(store?: string): boolean {
  return typeof store === "string" && store.includes("{agentId}");
}

function buildGatewaySessionStoreScanTargets(params: {
  cfg: KovaConfig;
  key: string;
  canonicalKey: string;
  agentId: string;
}): string[] {
  const targets = new Set<string>();
  if (params.canonicalKey) {
    targets.add(params.canonicalKey);
  }
  if (params.key && params.key !== params.canonicalKey) {
    targets.add(params.key);
  }
  if (params.canonicalKey === "global" || params.canonicalKey === "unknown") {
    return [...targets];
  }
  const agentMainKey = resolveAgentMainSessionKey({ cfg: params.cfg, agentId: params.agentId });
  if (params.canonicalKey === agentMainKey) {
    targets.add(`agent:${params.agentId}:main`);
  }
  return [...targets];
}

function resolveGatewaySessionStoreCandidates(
  cfg: KovaConfig,
  agentId: string,
): SessionStoreTarget[] {
  const storeConfig = cfg.session?.store;
  const defaultTarget = {
    agentId,
    storePath: resolveStorePath(storeConfig, { agentId }),
  };
  if (!isStorePathTemplate(storeConfig)) {
    return [defaultTarget];
  }
  const targets = new Map<string, SessionStoreTarget>();
  targets.set(defaultTarget.storePath, defaultTarget);
  for (const target of resolveAllAgentSessionStoreTargetsSync(cfg)) {
    if (target.agentId === agentId) {
      targets.set(target.storePath, target);
    }
  }
  return [...targets.values()];
}

function resolveGatewaySessionStoreLookup(params: {
  cfg: KovaConfig;
  key: string;
  canonicalKey: string;
  agentId: string;
  initialStore?: Record<string, SessionEntry>;
}): {
  storePath: string;
  store: Record<string, SessionEntry>;
  match: { entry: SessionEntry; key: string } | undefined;
} {
  const scanTargets = buildGatewaySessionStoreScanTargets(params);
  const candidates = resolveGatewaySessionStoreCandidates(params.cfg, params.agentId);
  const fallback = candidates[0] ?? {
    agentId: params.agentId,
    storePath: resolveStorePath(params.cfg.session?.store, { agentId: params.agentId }),
  };
  let selectedStorePath = fallback.storePath;
  let selectedStore = params.initialStore ?? loadSessionStore(fallback.storePath);
  let selectedMatch = findFreshestStoreMatch(selectedStore, ...scanTargets);
  let selectedUpdatedAt = selectedMatch?.entry.updatedAt ?? Number.NEGATIVE_INFINITY;

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate) {
      continue;
    }
    const store = loadSessionStore(candidate.storePath);
    const match = findFreshestStoreMatch(store, ...scanTargets);
    if (!match) {
      continue;
    }
    const updatedAt = match.entry.updatedAt ?? 0;
    if (!selectedMatch || updatedAt >= selectedUpdatedAt) {
      selectedStorePath = candidate.storePath;
      selectedStore = store;
      selectedMatch = match;
      selectedUpdatedAt = updatedAt;
    }
  }

  return {
    storePath: selectedStorePath,
    store: selectedStore,
    match: selectedMatch,
  };
}

function resolveExplicitDeletedLegacyMainStoreTarget(params: {
  cfg: KovaConfig;
  key: string;
  scanLegacyKeys?: boolean;
}): {
  agentId: string;
  storePath: string;
  canonicalKey: string;
  storeKeys: string[];
} | null {
  const parsed = parseAgentSessionKey(params.key);
  const legacyAgentId = normalizeAgentId(parsed?.agentId);
  if (
    !parsed ||
    legacyAgentId !== DEFAULT_AGENT_ID ||
    listAgentIds(params.cfg).includes(legacyAgentId)
  ) {
    return null;
  }

  const canonicalKey = resolveStoredSessionKeyForAgentStore({
    cfg: params.cfg,
    agentId: legacyAgentId,
    sessionKey: params.key,
  });
  const agentMainKey = resolveAgentMainSessionKey({ cfg: params.cfg, agentId: legacyAgentId });
  const legacyAgentMainKey = `agent:${legacyAgentId}:main`;
  const lookupSeeds = Array.from(
    new Set([params.key, canonicalKey, agentMainKey, legacyAgentMainKey]),
  );
  let best:
    | {
        storePath: string;
        store: Record<string, SessionEntry>;
        match: { entry: SessionEntry; key: string };
      }
    | undefined;
  for (const target of resolveAllAgentSessionStoreTargetsSync(params.cfg)) {
    if (target.agentId !== legacyAgentId) {
      continue;
    }
    const store = loadSessionStore(target.storePath);
    const match = findFreshestStoreMatch(store, ...lookupSeeds);
    if (!match) {
      continue;
    }
    if (!best || (match.entry.updatedAt ?? 0) >= (best.match.entry.updatedAt ?? 0)) {
      best = { storePath: target.storePath, store, match };
    }
  }
  if (!best) {
    return null;
  }

  const storeKeys = new Set<string>([canonicalKey]);
  if (params.key !== canonicalKey) {
    storeKeys.add(params.key);
  }
  storeKeys.add(best.match.key);
  if (params.scanLegacyKeys !== false) {
    for (const seed of lookupSeeds) {
      storeKeys.add(seed);
      for (const legacyKey of findStoreKeysIgnoreCase(best.store, seed)) {
        storeKeys.add(legacyKey);
      }
    }
  }
  return {
    agentId: legacyAgentId,
    storePath: best.storePath,
    canonicalKey,
    storeKeys: Array.from(storeKeys),
  };
}

export function resolveGatewaySessionStoreTarget(params: {
  cfg: KovaConfig;
  key: string;
  scanLegacyKeys?: boolean;
  store?: Record<string, SessionEntry>;
}): {
  agentId: string;
  storePath: string;
  canonicalKey: string;
  storeKeys: string[];
} {
  const key = normalizeOptionalString(params.key) ?? "";
  const explicitDeletedMainTarget = resolveExplicitDeletedLegacyMainStoreTarget({
    cfg: params.cfg,
    key,
    scanLegacyKeys: params.scanLegacyKeys,
  });
  if (explicitDeletedMainTarget) {
    return explicitDeletedMainTarget;
  }

  const canonicalKey = resolveSessionStoreKey({
    cfg: params.cfg,
    sessionKey: key,
  });
  const agentId = resolveSessionStoreAgentId(params.cfg, canonicalKey);
  const { storePath, store } = resolveGatewaySessionStoreLookup({
    cfg: params.cfg,
    key,
    canonicalKey,
    agentId,
    initialStore: params.store,
  });

  if (canonicalKey === "global" || canonicalKey === "unknown") {
    const storeKeys = key && key !== canonicalKey ? [canonicalKey, key] : [key];
    return { agentId, storePath, canonicalKey, storeKeys };
  }

  const storeKeys = new Set<string>();
  storeKeys.add(canonicalKey);
  if (key && key !== canonicalKey) {
    storeKeys.add(key);
  }
  if (params.scanLegacyKeys !== false) {
    const scanTargets = buildGatewaySessionStoreScanTargets({
      cfg: params.cfg,
      key,
      canonicalKey,
      agentId,
    });
    for (const seed of scanTargets) {
      for (const legacyKey of findStoreKeysIgnoreCase(store, seed)) {
        storeKeys.add(legacyKey);
      }
    }
  }
  return {
    agentId,
    storePath,
    canonicalKey,
    storeKeys: Array.from(storeKeys),
  };
}
