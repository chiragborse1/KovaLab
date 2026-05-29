import fs from "node:fs";
import path from "node:path";
import {
  listAgentIds,
  resolveAgentConfig,
  resolveAgentEffectiveModelPrimary,
  resolveAgentModelFallbacksOverride,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../agents/agent-scope.js";
import { resolveContextTokensForModel } from "../agents/context.js";
import { DEFAULT_CONTEXT_TOKENS, DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import type { ModelCatalogEntry } from "../agents/model-catalog.js";
import {
  inferUniqueProviderFromConfiguredModels,
  normalizeStoredOverrideModel,
  parseModelRef,
  resolveConfiguredModelRef,
  resolveDefaultModelForAgent,
  resolvePersistedSelectedModelRef,
  resolveThinkingDefault,
} from "../agents/model-selection.js";
import {
  countActiveDescendantRuns,
  getSessionDisplaySubagentRunByChildSessionKey,
  getSubagentSessionRuntimeMs,
  getSubagentSessionStartedAt,
  isSubagentRunLive,
  listSubagentRunsForController,
  resolveSubagentSessionStatus,
} from "../agents/subagent-registry-read.js";
import {
  RECENT_ENDED_SUBAGENT_CHILD_SESSION_MS,
  shouldKeepSubagentRunChildLink,
} from "../agents/subagent-run-liveness.js";
import { listThinkingLevelOptions } from "../auto-reply/thinking.js";
import { resolveAgentModelFallbackValues } from "../config/model-input.js";
import { resolveStateDir } from "../config/paths.js";
import {
  buildGroupDisplayName,
  resolveFreshSessionTotalTokens,
  type SessionEntry,
  type SessionScope,
} from "../config/sessions.js";
import type { KovaConfig } from "../config/types.kova.js";
import { openBoundaryFileSync } from "../infra/boundary-file-read.js";
import {
  normalizeAgentId,
  normalizeMainKey,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { isCronRunSessionKey } from "../sessions/session-key-utils.js";
import {
  AVATAR_MAX_BYTES,
  isAvatarDataUrl,
  isAvatarHttpUrl,
  isPathWithinRoot,
  isWorkspaceRelativeAvatarPath,
  resolveAvatarMime,
} from "../shared/avatar-policy.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import { normalizeSessionDeliveryFields } from "../utils/delivery-context.shared.js";
import type { ModelCostConfig } from "../utils/usage-format.js";
import { estimateUsageCost, resolveModelCostConfig } from "../utils/usage-format.js";
import {
  findStoreKeysIgnoreCase,
  loadSessionEntry,
  resolveFreshestSessionStoreMatchFromStoreKeys,
  resolveGatewaySessionStoreTarget,
} from "./session-entry.js";
import {
  readLatestSessionUsageFromTranscript,
  readSessionTitleFieldsFromTranscript,
} from "./session-utils.fs.js";
import type {
  GatewayAgentRow,
  GatewaySessionRow,
  GatewaySessionsDefaults,
  SessionRunStatus,
  SessionsListResult,
} from "./session-utils.types.js";

export {
  archiveFileOnDisk,
  archiveSessionTranscripts,
  attachKovaTranscriptMeta,
  capArrayByJsonBytes,
  readFirstUserMessageFromTranscript,
  readLastMessagePreviewFromTranscript,
  readLatestSessionUsageFromTranscript,
  readSessionTitleFieldsFromTranscript,
  readSessionPreviewItemsFromTranscript,
  readSessionMessages,
  resolveSessionTranscriptCandidates,
} from "./session-utils.fs.js";
export { canonicalizeSpawnedByForAgent, resolveSessionStoreKey } from "./session-store-key.js";
export {
  findStoreKeysIgnoreCase,
  loadSessionEntry,
  resolveFreshestSessionEntryFromStoreKeys,
  resolveFreshestSessionStoreMatchFromStoreKeys,
  resolveGatewaySessionStoreTarget,
} from "./session-entry.js";
export type {
  GatewayAgentRow,
  GatewaySessionRow,
  GatewaySessionsDefaults,
  SessionsListResult,
  SessionsPatchResult,
  SessionsPreviewEntry,
  SessionsPreviewResult,
} from "./session-utils.types.js";

const DERIVED_TITLE_MAX_LEN = 60;

function tryResolveExistingPath(value: string): string | null {
  try {
    return fs.realpathSync(value);
  } catch {
    return null;
  }
}

function resolveIdentityAvatarUrl(
  cfg: KovaConfig,
  agentId: string,
  avatar: string | undefined,
): string | undefined {
  if (!avatar) {
    return undefined;
  }
  const trimmed = normalizeOptionalString(avatar) ?? "";
  if (!trimmed) {
    return undefined;
  }
  if (isAvatarDataUrl(trimmed) || isAvatarHttpUrl(trimmed)) {
    return trimmed;
  }
  if (!isWorkspaceRelativeAvatarPath(trimmed)) {
    return undefined;
  }
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const workspaceRoot = tryResolveExistingPath(workspaceDir) ?? path.resolve(workspaceDir);
  const resolvedCandidate = path.resolve(workspaceRoot, trimmed);
  if (!isPathWithinRoot(workspaceRoot, resolvedCandidate)) {
    return undefined;
  }
  try {
    const opened = openBoundaryFileSync({
      absolutePath: resolvedCandidate,
      rootPath: workspaceRoot,
      rootRealPath: workspaceRoot,
      boundaryLabel: "workspace root",
      maxBytes: AVATAR_MAX_BYTES,
      skipLexicalRootCheck: true,
    });
    if (!opened.ok) {
      return undefined;
    }
    try {
      const buffer = fs.readFileSync(opened.fd);
      const mime = resolveAvatarMime(resolvedCandidate);
      return `data:${mime};base64,${buffer.toString("base64")}`;
    } finally {
      fs.closeSync(opened.fd);
    }
  } catch {
    return undefined;
  }
}

function formatSessionIdPrefix(sessionId: string, updatedAt?: number | null): string {
  const prefix = sessionId.slice(0, 8);
  if (updatedAt && updatedAt > 0) {
    const d = new Date(updatedAt);
    const date = d.toISOString().slice(0, 10);
    return `${prefix} (${date})`;
  }
  return prefix;
}

function truncateTitle(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  const cut = text.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.6) {
    return cut.slice(0, lastSpace) + "…";
  }
  return cut + "…";
}

export function deriveSessionTitle(
  entry: SessionEntry | undefined,
  firstUserMessage?: string | null,
): string | undefined {
  if (!entry) {
    return undefined;
  }

  if (normalizeOptionalString(entry.displayName)) {
    return normalizeOptionalString(entry.displayName);
  }

  if (normalizeOptionalString(entry.subject)) {
    return normalizeOptionalString(entry.subject);
  }

  if (firstUserMessage?.trim()) {
    const normalized = firstUserMessage.replace(/\s+/g, " ").trim();
    return truncateTitle(normalized, DERIVED_TITLE_MAX_LEN);
  }

  if (entry.sessionId) {
    return formatSessionIdPrefix(entry.sessionId, entry.updatedAt);
  }

  return undefined;
}

function resolveSessionRuntimeMs(
  run: { startedAt?: number; endedAt?: number; accumulatedRuntimeMs?: number } | null,
  now: number,
) {
  return getSubagentSessionRuntimeMs(run, now);
}

function resolvePositiveNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function resolveNonNegativeNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function resolveLatestCompactionCheckpoint(
  entry?: Pick<SessionEntry, "compactionCheckpoints"> | null,
): NonNullable<SessionEntry["compactionCheckpoints"]>[number] | undefined {
  const checkpoints = entry?.compactionCheckpoints;
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    return undefined;
  }
  return checkpoints.reduce((latest, checkpoint) =>
    !latest || checkpoint.createdAt > latest.createdAt ? checkpoint : latest,
  );
}

type SessionListRowContext = {
  // Per-list memoization for deterministic resolvers that scale linearly with
  // session count but only depend on (provider, model[, agentId]).
  modelCostConfigByModelRef: Map<string, ModelCostConfig | undefined>;
  thinkingMetadataByModelRef: Map<
    string,
    {
      levels: ReturnType<typeof listThinkingLevelOptions>;
      defaultLevel: ReturnType<typeof resolveGatewaySessionThinkingDefault>;
    }
  >;
};

function createSessionRowModelCacheKey(provider: string | undefined, model: string | undefined) {
  return `${normalizeOptionalString(provider) ?? ""}\u0000${normalizeOptionalString(model) ?? ""}`;
}

function createSessionListRowContext(): SessionListRowContext {
  return {
    modelCostConfigByModelRef: new Map(),
    thinkingMetadataByModelRef: new Map(),
  };
}

function resolveModelCostConfigCached(
  provider: string | undefined,
  model: string | undefined,
  cfg: KovaConfig,
  rowContext?: SessionListRowContext,
): ModelCostConfig | undefined {
  if (!rowContext) {
    return resolveModelCostConfig({ provider, model, config: cfg });
  }
  const key = createSessionRowModelCacheKey(provider, model);
  if (rowContext.modelCostConfigByModelRef.has(key)) {
    return rowContext.modelCostConfigByModelRef.get(key);
  }
  const value = resolveModelCostConfig({ provider, model, config: cfg });
  rowContext.modelCostConfigByModelRef.set(key, value);
  return value;
}

function resolveEstimatedSessionCostUsd(params: {
  cfg: KovaConfig;
  provider?: string;
  model?: string;
  entry?: Pick<
    SessionEntry,
    "estimatedCostUsd" | "inputTokens" | "outputTokens" | "cacheRead" | "cacheWrite"
  >;
  explicitCostUsd?: number;
  rowContext?: SessionListRowContext;
}): number | undefined {
  const explicitCostUsd = resolveNonNegativeNumber(
    params.explicitCostUsd ?? params.entry?.estimatedCostUsd,
  );
  if (explicitCostUsd !== undefined) {
    return explicitCostUsd;
  }
  const input = resolvePositiveNumber(params.entry?.inputTokens);
  const output = resolvePositiveNumber(params.entry?.outputTokens);
  const cacheRead = resolvePositiveNumber(params.entry?.cacheRead);
  const cacheWrite = resolvePositiveNumber(params.entry?.cacheWrite);
  if (
    input === undefined &&
    output === undefined &&
    cacheRead === undefined &&
    cacheWrite === undefined
  ) {
    return undefined;
  }
  const cost = resolveModelCostConfigCached(
    params.provider,
    params.model,
    params.cfg,
    params.rowContext,
  );
  if (!cost) {
    return undefined;
  }
  const estimated = estimateUsageCost({
    usage: {
      ...(input !== undefined ? { input } : {}),
      ...(output !== undefined ? { output } : {}),
      ...(cacheRead !== undefined ? { cacheRead } : {}),
      ...(cacheWrite !== undefined ? { cacheWrite } : {}),
    },
    cost,
  });
  return resolveNonNegativeNumber(estimated);
}

const STALE_STORE_ONLY_CHILD_LINK_MS = 60 * 60 * 1_000;

function isFinitePositiveTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isTerminalSessionStatus(status: unknown): status is Exclude<SessionRunStatus, "running"> {
  return status === "done" || status === "failed" || status === "killed" || status === "timeout";
}

function shouldKeepStoreOnlyChildLink(entry: SessionEntry, now: number): boolean {
  if (isTerminalSessionStatus(entry.status) || isFinitePositiveTimestamp(entry.endedAt)) {
    const endedAt = isFinitePositiveTimestamp(entry.endedAt) ? entry.endedAt : entry.updatedAt;
    return (
      isFinitePositiveTimestamp(endedAt) && now - endedAt <= RECENT_ENDED_SUBAGENT_CHILD_SESSION_MS
    );
  }
  if (entry.status === "running" || isFinitePositiveTimestamp(entry.startedAt)) {
    return true;
  }
  return (
    isFinitePositiveTimestamp(entry.updatedAt) &&
    now - entry.updatedAt <= STALE_STORE_ONLY_CHILD_LINK_MS
  );
}

function resolveChildSessionKeys(
  controllerSessionKey: string,
  store: Record<string, SessionEntry>,
  now = Date.now(),
): string[] | undefined {
  const childSessionKeys = new Set<string>();
  for (const entry of listSubagentRunsForController(controllerSessionKey)) {
    const childSessionKey = normalizeOptionalString(entry.childSessionKey);
    if (!childSessionKey) {
      continue;
    }
    const latest = getSessionDisplaySubagentRunByChildSessionKey(childSessionKey);
    if (!latest) {
      continue;
    }
    const latestControllerSessionKey =
      normalizeOptionalString(latest?.controllerSessionKey) ||
      normalizeOptionalString(latest?.requesterSessionKey);
    if (latestControllerSessionKey !== controllerSessionKey) {
      continue;
    }
    if (
      !shouldKeepSubagentRunChildLink(latest, {
        activeDescendants: countActiveDescendantRuns(childSessionKey),
        now,
      })
    ) {
      continue;
    }
    childSessionKeys.add(childSessionKey);
  }
  for (const [key, entry] of Object.entries(store)) {
    if (!entry || key === controllerSessionKey) {
      continue;
    }
    const spawnedBy = normalizeOptionalString(entry.spawnedBy);
    const parentSessionKey = normalizeOptionalString(entry.parentSessionKey);
    if (spawnedBy !== controllerSessionKey && parentSessionKey !== controllerSessionKey) {
      continue;
    }
    const latest = getSessionDisplaySubagentRunByChildSessionKey(key);
    if (latest) {
      const latestControllerSessionKey =
        normalizeOptionalString(latest.controllerSessionKey) ||
        normalizeOptionalString(latest.requesterSessionKey);
      if (latestControllerSessionKey !== controllerSessionKey) {
        continue;
      }
      if (
        !shouldKeepSubagentRunChildLink(latest, {
          activeDescendants: countActiveDescendantRuns(key),
          now,
        })
      ) {
        continue;
      }
    } else if (!shouldKeepStoreOnlyChildLink(entry, now)) {
      continue;
    }
    childSessionKeys.add(key);
  }
  const childSessions = Array.from(childSessionKeys);
  return childSessions.length > 0 ? childSessions : undefined;
}

function resolveTranscriptUsageFallback(params: {
  cfg: KovaConfig;
  key: string;
  entry?: SessionEntry;
  storePath: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  rowContext?: SessionListRowContext;
}): {
  estimatedCostUsd?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  contextTokens?: number;
  modelProvider?: string;
  model?: string;
} | null {
  const entry = params.entry;
  if (!entry?.sessionId) {
    return null;
  }
  const parsed = parseAgentSessionKey(params.key);
  const agentId = parsed?.agentId
    ? normalizeAgentId(parsed.agentId)
    : resolveDefaultAgentId(params.cfg);
  const snapshot = readLatestSessionUsageFromTranscript(
    entry.sessionId,
    params.storePath,
    entry.sessionFile,
    agentId,
  );
  if (!snapshot) {
    return null;
  }
  const modelProvider = snapshot.modelProvider ?? params.fallbackProvider;
  const model = snapshot.model ?? params.fallbackModel;
  const contextTokens = resolveContextTokensForModel({
    cfg: params.cfg,
    provider: modelProvider,
    model,
    // Gateway/session listing is read-only; don't start async model discovery.
    allowAsyncLoad: false,
  });
  const estimatedCostUsd = resolveEstimatedSessionCostUsd({
    cfg: params.cfg,
    provider: modelProvider,
    model,
    explicitCostUsd: snapshot.costUsd,
    entry: {
      inputTokens: snapshot.inputTokens,
      outputTokens: snapshot.outputTokens,
      cacheRead: snapshot.cacheRead,
      cacheWrite: snapshot.cacheWrite,
    },
    rowContext: params.rowContext,
  });
  return {
    modelProvider,
    model,
    totalTokens: resolvePositiveNumber(snapshot.totalTokens),
    totalTokensFresh: snapshot.totalTokensFresh === true,
    contextTokens: resolvePositiveNumber(contextTokens),
    estimatedCostUsd,
  };
}

/**
 * Returns the owning agent id if the session key belongs to an agent that is no
 * longer present in config (deleted). Returns null for non-agent legacy/global
 * keys, or when the owning agent still exists (#65524).
 */
export function resolveDeletedAgentIdFromSessionKey(
  cfg: KovaConfig,
  sessionKey: string,
): string | null {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed) {
    return null;
  }
  const agentId = normalizeAgentId(parsed.agentId);
  if (listAgentIds(cfg).includes(agentId)) {
    return null;
  }
  return agentId;
}

/**
 * Remove legacy key variants for one canonical session key.
 * Candidates can include aliases (for example, "agent:ops:main" when canonical is "agent:ops:work").
 */
export function pruneLegacyStoreKeys(params: {
  store: Record<string, unknown>;
  canonicalKey: string;
  candidates: Iterable<string>;
}) {
  const keysToDelete = new Set<string>();
  for (const candidate of params.candidates) {
    const trimmed = normalizeOptionalString(candidate ?? "") ?? "";
    if (!trimmed) {
      continue;
    }
    if (trimmed !== params.canonicalKey) {
      keysToDelete.add(trimmed);
    }
    for (const match of findStoreKeysIgnoreCase(params.store, trimmed)) {
      if (match !== params.canonicalKey) {
        keysToDelete.add(match);
      }
    }
  }
  for (const key of keysToDelete) {
    delete params.store[key];
  }
}

export function migrateAndPruneGatewaySessionStoreKey(params: {
  cfg: KovaConfig;
  key: string;
  store: Record<string, SessionEntry>;
}) {
  const target = resolveGatewaySessionStoreTarget({
    cfg: params.cfg,
    key: params.key,
    store: params.store,
  });
  const primaryKey = target.canonicalKey;
  const freshestMatch = resolveFreshestSessionStoreMatchFromStoreKeys(
    params.store,
    target.storeKeys,
  );
  if (freshestMatch) {
    const currentPrimary = params.store[primaryKey];
    if (!currentPrimary || (freshestMatch.entry.updatedAt ?? 0) > (currentPrimary.updatedAt ?? 0)) {
      params.store[primaryKey] = freshestMatch.entry;
    }
  }
  pruneLegacyStoreKeys({
    store: params.store,
    canonicalKey: primaryKey,
    candidates: target.storeKeys,
  });
  return { target, primaryKey, entry: params.store[primaryKey] };
}

export function classifySessionKey(key: string, entry?: SessionEntry): GatewaySessionRow["kind"] {
  if (key === "global") {
    return "global";
  }
  if (key === "unknown") {
    return "unknown";
  }
  if (entry?.chatType === "group" || entry?.chatType === "channel") {
    return "group";
  }
  if (key.includes(":group:") || key.includes(":channel:")) {
    return "group";
  }
  return "direct";
}

export function parseGroupKey(
  key: string,
): { channel?: string; kind?: "group" | "channel"; id?: string } | null {
  const agentParsed = parseAgentSessionKey(key);
  const rawKey = agentParsed?.rest ?? key;
  const parts = rawKey.split(":").filter(Boolean);
  if (parts.length >= 3) {
    const [channel, kind, ...rest] = parts;
    if (kind === "group" || kind === "channel") {
      const id = rest.join(":");
      return { channel, kind, id };
    }
  }
  return null;
}

function listExistingAgentIdsFromDisk(): string[] {
  const root = resolveStateDir();
  const agentsDir = path.join(root, "agents");
  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => normalizeAgentId(entry.name))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listConfiguredAgentIds(cfg: KovaConfig): string[] {
  const ids = new Set<string>();
  const defaultId = normalizeAgentId(resolveDefaultAgentId(cfg));
  ids.add(defaultId);

  for (const entry of cfg.agents?.list ?? []) {
    if (entry?.id) {
      ids.add(normalizeAgentId(entry.id));
    }
  }

  for (const id of listExistingAgentIdsFromDisk()) {
    ids.add(id);
  }

  const sorted = Array.from(ids).filter(Boolean);
  sorted.sort((a, b) => a.localeCompare(b));
  return sorted.includes(defaultId)
    ? [defaultId, ...sorted.filter((id) => id !== defaultId)]
    : sorted;
}

function normalizeFallbackList(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = normalizeLowercaseStringOrEmpty(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function resolveGatewayAgentModel(
  cfg: KovaConfig,
  agentId: string,
): GatewayAgentRow["model"] | undefined {
  const primary = resolveAgentEffectiveModelPrimary(cfg, agentId)?.trim();
  const fallbackOverride = resolveAgentModelFallbacksOverride(cfg, agentId);
  const defaultFallbacks = resolveAgentModelFallbackValues(cfg.agents?.defaults?.model);
  const fallbacks = normalizeFallbackList(fallbackOverride ?? defaultFallbacks);
  if (!primary && fallbacks.length === 0) {
    return undefined;
  }
  return {
    ...(primary ? { primary } : {}),
    ...(fallbacks.length > 0 ? { fallbacks } : {}),
  };
}

export function listAgentsForGateway(cfg: KovaConfig): {
  defaultId: string;
  mainKey: string;
  scope: SessionScope;
  agents: GatewayAgentRow[];
} {
  const defaultId = normalizeAgentId(resolveDefaultAgentId(cfg));
  const mainKey = normalizeMainKey(cfg.session?.mainKey);
  const scope = cfg.session?.scope ?? "per-sender";
  const configuredById = new Map<
    string,
    { name?: string; identity?: GatewayAgentRow["identity"] }
  >();
  for (const entry of cfg.agents?.list ?? []) {
    if (!entry?.id) {
      continue;
    }
    const identity = entry.identity
      ? {
          name: normalizeOptionalString(entry.identity.name),
          theme: normalizeOptionalString(entry.identity.theme),
          emoji: normalizeOptionalString(entry.identity.emoji),
          avatar: normalizeOptionalString(entry.identity.avatar),
          avatarUrl: resolveIdentityAvatarUrl(
            cfg,
            normalizeAgentId(entry.id),
            normalizeOptionalString(entry.identity.avatar),
          ),
        }
      : undefined;
    configuredById.set(normalizeAgentId(entry.id), {
      name: normalizeOptionalString(entry.name),
      identity,
    });
  }
  const explicitIds = new Set(
    (cfg.agents?.list ?? [])
      .map((entry) => (entry?.id ? normalizeAgentId(entry.id) : ""))
      .filter(Boolean),
  );
  const allowedIds = explicitIds.size > 0 ? new Set([...explicitIds, defaultId]) : null;
  let agentIds = listConfiguredAgentIds(cfg).filter((id) =>
    allowedIds ? allowedIds.has(id) : true,
  );
  if (mainKey && !agentIds.includes(mainKey) && (!allowedIds || allowedIds.has(mainKey))) {
    agentIds = [...agentIds, mainKey];
  }
  const agents = agentIds.map((id) => {
    const meta = configuredById.get(id);
    const model = resolveGatewayAgentModel(cfg, id);
    return Object.assign(
      {
        id,
        name: meta?.name,
        identity: meta?.identity,
        workspace: resolveAgentWorkspaceDir(cfg, id),
      },
      model ? { model } : {},
    );
  });
  return { defaultId, mainKey, scope, agents };
}

export { loadCombinedSessionStoreForGateway } from "../config/sessions/combined-store-gateway.js";

function resolveGatewaySessionThinkingDefault(params: {
  cfg: KovaConfig;
  provider: string;
  model: string;
  agentId?: string;
}) {
  const agentThinkingDefault = params.agentId
    ? resolveAgentConfig(params.cfg, params.agentId)?.thinkingDefault
    : undefined;
  return (
    agentThinkingDefault ??
    resolveThinkingDefault({
      cfg: params.cfg,
      provider: params.provider,
      model: params.model,
    })
  );
}

function resolveSessionRowThinkingMetadata(params: {
  cfg: KovaConfig;
  agentId: string;
  provider: string;
  model: string;
  rowContext?: SessionListRowContext;
}) {
  if (!params.rowContext) {
    const levels = listThinkingLevelOptions(params.provider, params.model);
    return {
      levels,
      defaultLevel: resolveGatewaySessionThinkingDefault({
        cfg: params.cfg,
        provider: params.provider,
        model: params.model,
        agentId: params.agentId,
      }),
    };
  }
  const key = `${params.agentId}\u0000${createSessionRowModelCacheKey(
    params.provider,
    params.model,
  )}`;
  const cached = params.rowContext.thinkingMetadataByModelRef.get(key);
  if (cached) {
    return cached;
  }
  const value = {
    levels: listThinkingLevelOptions(params.provider, params.model),
    defaultLevel: resolveGatewaySessionThinkingDefault({
      cfg: params.cfg,
      provider: params.provider,
      model: params.model,
      agentId: params.agentId,
    }),
  };
  params.rowContext.thinkingMetadataByModelRef.set(key, value);
  return value;
}

export function getSessionDefaults(cfg: KovaConfig): GatewaySessionsDefaults {
  const resolved = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  const contextTokens =
    cfg.agents?.defaults?.contextTokens ??
    resolveContextTokensForModel({
      cfg,
      provider: resolved.provider,
      model: resolved.model,
      allowAsyncLoad: false,
    }) ??
    DEFAULT_CONTEXT_TOKENS;
  const thinkingLevels = listThinkingLevelOptions(resolved.provider, resolved.model);
  return {
    modelProvider: resolved.provider ?? null,
    model: resolved.model ?? null,
    contextTokens: contextTokens ?? null,
    thinkingLevels,
    thinkingOptions: thinkingLevels.map((level) => level.label),
    thinkingDefault: resolveGatewaySessionThinkingDefault({
      cfg,
      provider: resolved.provider,
      model: resolved.model,
    }),
  };
}

export function resolveSessionModelRef(
  cfg: KovaConfig,
  entry?:
    | SessionEntry
    | Pick<SessionEntry, "model" | "modelProvider" | "modelOverride" | "providerOverride">,
  agentId?: string,
): { provider: string; model: string } {
  const resolved = agentId
    ? resolveDefaultModelForAgent({ cfg, agentId })
    : resolveConfiguredModelRef({
        cfg,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL,
      });

  const normalizedOverride = normalizeStoredOverrideModel({
    providerOverride: entry?.providerOverride,
    modelOverride: entry?.modelOverride,
  });

  const persisted = resolvePersistedSelectedModelRef({
    defaultProvider: resolved.provider || DEFAULT_PROVIDER,
    runtimeProvider: entry?.modelProvider,
    runtimeModel: entry?.model,
    overrideProvider: normalizedOverride.providerOverride,
    overrideModel: normalizedOverride.modelOverride,
  });
  if (persisted) {
    return persisted;
  }
  return resolved;
}

export async function resolveGatewayModelSupportsImages(params: {
  loadGatewayModelCatalog: () => Promise<ModelCatalogEntry[]>;
  provider?: string;
  model?: string;
}): Promise<boolean> {
  if (!params.model) {
    return true;
  }

  try {
    const catalog = await params.loadGatewayModelCatalog();
    const modelEntry = catalog.find(
      (entry) =>
        entry.id === params.model && (!params.provider || entry.provider === params.provider),
    );
    const normalizedProvider = normalizeOptionalLowercaseString(params.provider);
    const normalizedCandidates = [
      normalizeLowercaseStringOrEmpty(params.model),
      normalizeLowercaseStringOrEmpty(modelEntry?.name),
    ].filter(Boolean);
    if (modelEntry) {
      if (modelEntry.input?.includes("image")) {
        return true;
      }
      // Legacy safety shim for stale persisted Foundry rows that predate
      // provider-owned capability normalization.
      if (
        normalizedProvider === "microsoft-foundry" &&
        normalizedCandidates.some(
          (candidate) =>
            candidate.startsWith("gpt-") ||
            candidate.startsWith("o1") ||
            candidate.startsWith("o3") ||
            candidate.startsWith("o4") ||
            candidate === "computer-use-preview",
        )
      ) {
        return true;
      }
      if (
        normalizedProvider === "claude-cli" &&
        normalizedCandidates.some(
          (candidate) =>
            candidate === "opus" ||
            candidate === "sonnet" ||
            candidate === "haiku" ||
            candidate.startsWith("claude-"),
        )
      ) {
        return true;
      }
      return false;
    }
    if (
      normalizedProvider === "claude-cli" &&
      normalizedCandidates.some(
        (candidate) =>
          candidate === "opus" ||
          candidate === "sonnet" ||
          candidate === "haiku" ||
          candidate.startsWith("claude-"),
      )
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function resolveSessionModelIdentityRef(
  cfg: KovaConfig,
  entry?:
    | SessionEntry
    | Pick<SessionEntry, "model" | "modelProvider" | "modelOverride" | "providerOverride">,
  agentId?: string,
  fallbackModelRef?: string,
): { provider?: string; model: string } {
  const runtimeModel = entry?.model?.trim();
  const runtimeProvider = entry?.modelProvider?.trim();
  if (runtimeModel) {
    if (runtimeProvider) {
      return { provider: runtimeProvider, model: runtimeModel };
    }
    const inferredProvider = inferUniqueProviderFromConfiguredModels({
      cfg,
      model: runtimeModel,
    });
    if (inferredProvider) {
      return { provider: inferredProvider, model: runtimeModel };
    }
    if (runtimeModel.includes("/")) {
      const parsedRuntime = parseModelRef(runtimeModel, DEFAULT_PROVIDER);
      if (parsedRuntime) {
        return { provider: parsedRuntime.provider, model: parsedRuntime.model };
      }
      return { model: runtimeModel };
    }
    return { model: runtimeModel };
  }
  const fallbackRef = fallbackModelRef?.trim();
  if (fallbackRef) {
    const parsedFallback = parseModelRef(fallbackRef, DEFAULT_PROVIDER);
    if (parsedFallback) {
      return { provider: parsedFallback.provider, model: parsedFallback.model };
    }
    const inferredProvider = inferUniqueProviderFromConfiguredModels({
      cfg,
      model: fallbackRef,
    });
    if (inferredProvider) {
      return { provider: inferredProvider, model: fallbackRef };
    }
    return { model: fallbackRef };
  }
  const resolved = resolveSessionModelRef(cfg, entry, agentId);
  return { provider: resolved.provider, model: resolved.model };
}

export function buildGatewaySessionRow(params: {
  cfg: KovaConfig;
  storePath: string;
  store: Record<string, SessionEntry>;
  key: string;
  entry?: SessionEntry;
  now?: number;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  rowContext?: SessionListRowContext;
}): GatewaySessionRow {
  const { cfg, storePath, store, key, entry } = params;
  const now = params.now ?? Date.now();
  const updatedAt = entry?.updatedAt ?? null;
  const parsed = parseGroupKey(key);
  const channel = entry?.channel ?? parsed?.channel;
  const subject = entry?.subject;
  const groupChannel = entry?.groupChannel;
  const space = entry?.space;
  const id = parsed?.id;
  const origin = entry?.origin;
  const originLabel = origin?.label;
  const displayName =
    entry?.displayName ??
    (channel
      ? buildGroupDisplayName({
          provider: channel,
          subject,
          groupChannel,
          space,
          id,
          key,
        })
      : undefined) ??
    entry?.label ??
    originLabel;
  const deliveryFields = normalizeSessionDeliveryFields(entry);
  const parsedAgent = parseAgentSessionKey(key);
  const sessionAgentId = normalizeAgentId(parsedAgent?.agentId ?? resolveDefaultAgentId(cfg));
  const subagentRun = getSessionDisplaySubagentRunByChildSessionKey(key);
  const subagentOwner =
    normalizeOptionalString(subagentRun?.controllerSessionKey) ||
    normalizeOptionalString(subagentRun?.requesterSessionKey);
  const liveSubagentRunActive = isSubagentRunLive(subagentRun);
  const persistedSessionStatus = entry?.status;
  const persistedSessionEndedAt = entry?.endedAt;
  const persistedSessionStartedAt = entry?.startedAt;
  const persistedSessionRuntimeMs = entry?.runtimeMs;
  const subagentRunState = subagentRun
    ? liveSubagentRunActive
      ? "active"
      : typeof subagentRun.endedAt === "number" ||
          persistedSessionStatus === "done" ||
          persistedSessionStatus === "failed" ||
          persistedSessionStatus === "killed" ||
          persistedSessionStatus === "timeout" ||
          typeof persistedSessionEndedAt === "number"
        ? "historical"
        : "interrupted"
    : undefined;
  const subagentStatus = subagentRun
    ? liveSubagentRunActive
      ? resolveSubagentSessionStatus(subagentRun)
      : persistedSessionStatus === "running"
        ? undefined
        : (persistedSessionStatus ??
          (typeof subagentRun.endedAt === "number"
            ? resolveSubagentSessionStatus(subagentRun)
            : undefined))
    : undefined;
  const subagentStartedAt = subagentRun
    ? liveSubagentRunActive
      ? getSubagentSessionStartedAt(subagentRun)
      : (persistedSessionStartedAt ?? getSubagentSessionStartedAt(subagentRun))
    : undefined;
  const subagentEndedAt = subagentRun
    ? liveSubagentRunActive
      ? subagentRun.endedAt
      : (persistedSessionEndedAt ?? subagentRun.endedAt)
    : undefined;
  const subagentRuntimeMs = subagentRun
    ? liveSubagentRunActive
      ? resolveSessionRuntimeMs(subagentRun, now)
      : (persistedSessionRuntimeMs ??
        (typeof subagentRun.endedAt === "number"
          ? resolveSessionRuntimeMs(subagentRun, now)
          : undefined))
    : undefined;
  const selectedModel = entry?.modelOverride?.trim()
    ? resolveSessionModelRef(cfg, entry, sessionAgentId)
    : null;
  const resolvedModel = resolveSessionModelIdentityRef(
    cfg,
    entry,
    sessionAgentId,
    subagentRun?.model,
  );
  const runtimeModelPresent =
    Boolean(entry?.model?.trim()) || Boolean(entry?.modelProvider?.trim());
  const needsTranscriptTotalTokens =
    resolvePositiveNumber(resolveFreshSessionTotalTokens(entry)) === undefined;
  const needsTranscriptContextTokens = resolvePositiveNumber(entry?.contextTokens) === undefined;
  const needsTranscriptEstimatedCostUsd =
    resolveEstimatedSessionCostUsd({
      cfg,
      provider: resolvedModel.provider,
      model: resolvedModel.model ?? DEFAULT_MODEL,
      entry,
      rowContext: params.rowContext,
    }) === undefined;
  const transcriptUsage =
    needsTranscriptTotalTokens || needsTranscriptContextTokens || needsTranscriptEstimatedCostUsd
      ? resolveTranscriptUsageFallback({
          cfg,
          key,
          entry,
          storePath,
          fallbackProvider: resolvedModel.provider,
          fallbackModel: resolvedModel.model ?? DEFAULT_MODEL,
          rowContext: params.rowContext,
        })
      : null;
  const preferLiveSubagentModelIdentity =
    Boolean(subagentRun?.model?.trim()) && subagentStatus === "running";
  const shouldUseTranscriptModelIdentity =
    runtimeModelPresent &&
    !preferLiveSubagentModelIdentity &&
    (needsTranscriptTotalTokens || needsTranscriptContextTokens);
  const resolvedModelIdentity = {
    provider: resolvedModel.provider,
    model: resolvedModel.model ?? DEFAULT_MODEL,
  };
  const modelIdentity = shouldUseTranscriptModelIdentity
    ? {
        provider: transcriptUsage?.modelProvider ?? resolvedModelIdentity.provider,
        model: transcriptUsage?.model ?? resolvedModelIdentity.model,
      }
    : resolvedModelIdentity;
  const { provider: modelProvider, model } = modelIdentity;
  const totalTokens =
    resolvePositiveNumber(resolveFreshSessionTotalTokens(entry)) ??
    resolvePositiveNumber(transcriptUsage?.totalTokens);
  const totalTokensFresh =
    typeof totalTokens === "number" && Number.isFinite(totalTokens) && totalTokens > 0
      ? true
      : transcriptUsage?.totalTokensFresh === true;
  const childSessions = resolveChildSessionKeys(key, store, now);
  const latestCompactionCheckpoint = resolveLatestCompactionCheckpoint(entry);
  const estimatedCostUsd =
    resolveEstimatedSessionCostUsd({
      cfg,
      provider: modelProvider,
      model,
      entry,
      rowContext: params.rowContext,
    }) ?? resolveNonNegativeNumber(transcriptUsage?.estimatedCostUsd);
  const contextTokens =
    resolvePositiveNumber(entry?.contextTokens) ??
    resolvePositiveNumber(transcriptUsage?.contextTokens) ??
    resolvePositiveNumber(
      resolveContextTokensForModel({
        cfg,
        provider: modelProvider,
        model,
        // Gateway/session listing is read-only; don't start async model discovery.
        allowAsyncLoad: false,
      }),
    );

  let derivedTitle: string | undefined;
  let lastMessagePreview: string | undefined;
  if (entry?.sessionId && (params.includeDerivedTitles || params.includeLastMessage)) {
    const fields = readSessionTitleFieldsFromTranscript(
      entry.sessionId,
      storePath,
      entry.sessionFile,
      sessionAgentId,
    );
    if (params.includeDerivedTitles) {
      derivedTitle = deriveSessionTitle(entry, fields.firstUserMessage);
    }
    if (params.includeLastMessage && fields.lastMessagePreview) {
      lastMessagePreview = fields.lastMessagePreview;
    }
  }

  const rowModelProvider = selectedModel?.provider ?? modelProvider;
  const rowModel = selectedModel?.model ?? model;
  const thinkingProvider = rowModelProvider ?? DEFAULT_PROVIDER;
  const thinkingModel = rowModel ?? DEFAULT_MODEL;
  const thinkingMetadata = resolveSessionRowThinkingMetadata({
    cfg,
    agentId: sessionAgentId,
    provider: thinkingProvider,
    model: thinkingModel,
    rowContext: params.rowContext,
  });
  const thinkingLevels = thinkingMetadata.levels;

  return {
    key,
    spawnedBy: subagentOwner || entry?.spawnedBy,
    spawnedWorkspaceDir: entry?.spawnedWorkspaceDir,
    forkedFromParent: entry?.forkedFromParent,
    spawnDepth: entry?.spawnDepth,
    subagentRole: entry?.subagentRole,
    subagentControlScope: entry?.subagentControlScope,
    kind: classifySessionKey(key, entry),
    label: entry?.label,
    displayName,
    derivedTitle,
    lastMessagePreview,
    channel,
    subject,
    groupChannel,
    space,
    chatType: entry?.chatType,
    origin,
    updatedAt,
    sessionId: entry?.sessionId,
    systemSent: entry?.systemSent,
    abortedLastRun: entry?.abortedLastRun,
    thinkingLevel: entry?.thinkingLevel,
    thinkingLevels,
    thinkingOptions: thinkingLevels.map((level) => level.label),
    thinkingDefault: thinkingMetadata.defaultLevel,
    fastMode: entry?.fastMode,
    verboseLevel: entry?.verboseLevel,
    traceLevel: entry?.traceLevel,
    reasoningLevel: entry?.reasoningLevel,
    elevatedLevel: entry?.elevatedLevel,
    sendPolicy: entry?.sendPolicy,
    inputTokens: entry?.inputTokens,
    outputTokens: entry?.outputTokens,
    totalTokens,
    totalTokensFresh,
    estimatedCostUsd,
    status: subagentRun ? subagentStatus : entry?.status,
    subagentRunState,
    hasActiveSubagentRun: subagentRun ? liveSubagentRunActive : undefined,
    startedAt: subagentRun ? subagentStartedAt : entry?.startedAt,
    endedAt: subagentRun ? subagentEndedAt : entry?.endedAt,
    runtimeMs: subagentRun ? subagentRuntimeMs : entry?.runtimeMs,
    parentSessionKey: subagentOwner || entry?.parentSessionKey,
    childSessions,
    responseUsage: entry?.responseUsage,
    modelProvider: rowModelProvider,
    model: rowModel,
    contextTokens,
    deliveryContext: deliveryFields.deliveryContext,
    lastChannel: deliveryFields.lastChannel ?? entry?.lastChannel,
    lastTo: deliveryFields.lastTo ?? entry?.lastTo,
    lastAccountId: deliveryFields.lastAccountId ?? entry?.lastAccountId,
    lastThreadId: deliveryFields.lastThreadId ?? entry?.lastThreadId,
    compactionCheckpointCount: entry?.compactionCheckpoints?.length,
    latestCompactionCheckpoint,
  };
}

export function loadGatewaySessionRow(
  sessionKey: string,
  options?: { includeDerivedTitles?: boolean; includeLastMessage?: boolean; now?: number },
): GatewaySessionRow | null {
  const { cfg, storePath, store, entry, canonicalKey } = loadSessionEntry(sessionKey);
  if (!entry) {
    return null;
  }
  return buildGatewaySessionRow({
    cfg,
    storePath,
    store,
    key: canonicalKey,
    entry,
    now: options?.now,
    includeDerivedTitles: options?.includeDerivedTitles,
    includeLastMessage: options?.includeLastMessage,
  });
}

export function listSessionsFromStore(params: {
  cfg: KovaConfig;
  storePath: string;
  store: Record<string, SessionEntry>;
  opts: import("./protocol/index.js").SessionsListParams;
}): SessionsListResult {
  const { cfg, storePath, store, opts } = params;
  const now = Date.now();

  const includeGlobal = opts.includeGlobal === true;
  const includeUnknown = opts.includeUnknown === true;
  const includeDerivedTitles = opts.includeDerivedTitles === true;
  const includeLastMessage = opts.includeLastMessage === true;
  const spawnedBy = typeof opts.spawnedBy === "string" ? opts.spawnedBy : "";
  const label = normalizeOptionalString(opts.label) ?? "";
  const agentId = typeof opts.agentId === "string" ? normalizeAgentId(opts.agentId) : "";
  const search = normalizeLowercaseStringOrEmpty(opts.search);
  const activeMinutes =
    typeof opts.activeMinutes === "number" && Number.isFinite(opts.activeMinutes)
      ? Math.max(1, Math.floor(opts.activeMinutes))
      : undefined;
  const rowContext = createSessionListRowContext();

  let sessions = Object.entries(store)
    .filter(([key]) => {
      if (isCronRunSessionKey(key)) {
        return false;
      }
      if (!includeGlobal && key === "global") {
        return false;
      }
      if (!includeUnknown && key === "unknown") {
        return false;
      }
      if (agentId) {
        if (key === "global" || key === "unknown") {
          return false;
        }
        const parsed = parseAgentSessionKey(key);
        if (!parsed) {
          return false;
        }
        return normalizeAgentId(parsed.agentId) === agentId;
      }
      return true;
    })
    .filter(([key, entry]) => {
      if (!spawnedBy) {
        return true;
      }
      if (key === "unknown" || key === "global") {
        return false;
      }
      const latest = getSessionDisplaySubagentRunByChildSessionKey(key);
      if (latest) {
        const latestControllerSessionKey =
          normalizeOptionalString(latest.controllerSessionKey) ||
          normalizeOptionalString(latest.requesterSessionKey);
        return (
          latestControllerSessionKey === spawnedBy &&
          shouldKeepSubagentRunChildLink(latest, {
            activeDescendants: countActiveDescendantRuns(key),
            now,
          })
        );
      }
      return (
        shouldKeepStoreOnlyChildLink(entry, now) &&
        (entry?.spawnedBy === spawnedBy || entry?.parentSessionKey === spawnedBy)
      );
    })
    .filter(([, entry]) => {
      if (!label) {
        return true;
      }
      return entry?.label === label;
    })
    .map(([key, entry]) =>
      buildGatewaySessionRow({
        cfg,
        storePath,
        store,
        key,
        entry,
        now,
        includeDerivedTitles,
        includeLastMessage,
        rowContext,
      }),
    )
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  if (search) {
    sessions = sessions.filter((s) => {
      const fields = [
        s.displayName,
        s.label,
        s.subject,
        s.sessionId,
        s.key,
        s.derivedTitle,
        s.lastMessagePreview,
      ];
      return fields.some(
        (f) => typeof f === "string" && normalizeLowercaseStringOrEmpty(f).includes(search),
      );
    });
  }

  if (activeMinutes !== undefined) {
    const cutoff = now - activeMinutes * 60_000;
    sessions = sessions.filter((s) => (s.updatedAt ?? 0) >= cutoff);
  }

  if (typeof opts.limit === "number" && Number.isFinite(opts.limit)) {
    const limit = Math.max(1, Math.floor(opts.limit));
    sessions = sessions.slice(0, limit);
  }

  return {
    ts: now,
    path: storePath,
    count: sessions.length,
    defaults: getSessionDefaults(cfg),
    sessions,
  };
}
