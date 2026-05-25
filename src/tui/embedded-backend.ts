import { randomUUID } from "node:crypto";
import type { SkillStatusReport } from "../agents/skills-status.js";
import type { ReplyPayload } from "../auto-reply/reply-payload.js";
import type { MsgContext } from "../auto-reply/templating.js";
import {
  normalizeLiveAssistantEventText,
  projectLiveAssistantBufferedText,
  resolveMergedAssistantText,
  shouldSuppressAssistantEventForLiveChat,
} from "../gateway/live-chat-projector.js";
import type { SessionsPatchResult } from "../gateway/protocol/index.js";
import { type AgentEventPayload, onAgentEvent } from "../infra/agent-events.js";
import { setEmbeddedMode } from "../infra/embedded-mode.js";
import { parseAgentSessionKey } from "../routing/session-key.js";
import { defaultRuntime } from "../runtime.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../utils/message-channel.js";
import type {
  ChatSendOptions,
  TuiAgentsList,
  TuiBackend,
  TuiEvent,
  TuiModelChoice,
  TuiSessionList,
} from "./tui-backend.js";
import { formatTuiRunError } from "./tui-error-format.js";
import { TuiTurnTrace } from "./turn-trace.js";

type LocalRunState = {
  sessionKey: string;
  controller: AbortController;
  buffer: string;
  isBtw: boolean;
  question?: string;
  finalSent: boolean;
  registered: boolean;
  trace: TuiTurnTrace;
  firstAgentEventSent: boolean;
  firstAssistantEventSent: boolean;
};

type DefaultDeps = ReturnType<(typeof import("../cli/deps.js"))["createDefaultDeps"]>;
type AgentScopeModule = typeof import("../agents/agent-scope.js");
type ConfigModule = typeof import("../config/config.js");
type ChatDisplayProjectionModule = typeof import("../gateway/chat-display-projection.js");
type CliSessionHistoryModule = typeof import("../gateway/cli-session-history.js");
type ServerConstantsModule = typeof import("../gateway/server-constants.js");
type AgentTimestampModule = typeof import("../gateway/server-methods/agent-timestamp.js");
type ChatServerMethodsModule = typeof import("../gateway/server-methods/chat.js");
type SessionUtilsFsModule = typeof import("../gateway/session-utils.fs.js");
type SessionUtilsModule = typeof import("../gateway/session-utils.js");
type SessionCheckpointActionsModule = typeof import("../gateway/session-checkpoint-actions.js");
type AgentCommandModule = typeof import("../agents/agent-command.js");

let agentScopeModulePromise: Promise<AgentScopeModule> | null = null;
let configModulePromise: Promise<ConfigModule> | null = null;
let chatDisplayProjectionModulePromise: Promise<ChatDisplayProjectionModule> | null = null;
let cliSessionHistoryModulePromise: Promise<CliSessionHistoryModule> | null = null;
let serverConstantsModulePromise: Promise<ServerConstantsModule> | null = null;
let agentTimestampModulePromise: Promise<AgentTimestampModule> | null = null;
let chatServerMethodsModulePromise: Promise<ChatServerMethodsModule> | null = null;
let sessionUtilsFsModulePromise: Promise<SessionUtilsFsModule> | null = null;
let sessionUtilsModulePromise: Promise<SessionUtilsModule> | null = null;
let sessionCheckpointActionsModulePromise: Promise<SessionCheckpointActionsModule> | null = null;
let agentCommandModulePromise: Promise<AgentCommandModule> | null = null;

const EMBEDDED_TUI_WARMUP_DELAY_MS = 16;

function getAgentScopeModule() {
  agentScopeModulePromise ??= import("../agents/agent-scope.js");
  return agentScopeModulePromise;
}

function getConfigModule() {
  configModulePromise ??= import("../config/config.js");
  return configModulePromise;
}

function getChatDisplayProjectionModule() {
  chatDisplayProjectionModulePromise ??= import("../gateway/chat-display-projection.js");
  return chatDisplayProjectionModulePromise;
}

function getCliSessionHistoryModule() {
  cliSessionHistoryModulePromise ??= import("../gateway/cli-session-history.js");
  return cliSessionHistoryModulePromise;
}

function getServerConstantsModule() {
  serverConstantsModulePromise ??= import("../gateway/server-constants.js");
  return serverConstantsModulePromise;
}

function getAgentTimestampModule() {
  agentTimestampModulePromise ??= import("../gateway/server-methods/agent-timestamp.js");
  return agentTimestampModulePromise;
}

function getChatServerMethodsModule() {
  chatServerMethodsModulePromise ??= import("../gateway/server-methods/chat.js");
  return chatServerMethodsModulePromise;
}

function getSessionUtilsFsModule() {
  sessionUtilsFsModulePromise ??= import("../gateway/session-utils.fs.js");
  return sessionUtilsFsModulePromise;
}

function getSessionUtilsModule() {
  sessionUtilsModulePromise ??= import("../gateway/session-utils.js");
  return sessionUtilsModulePromise;
}

function getSessionCheckpointActionsModule() {
  sessionCheckpointActionsModulePromise ??= import("../gateway/session-checkpoint-actions.js");
  return sessionCheckpointActionsModulePromise;
}

function getAgentCommandModule() {
  agentCommandModulePromise ??= import("../agents/agent-command.js");
  return agentCommandModulePromise;
}

const silentRuntime = {
  log: (..._args: unknown[]) => undefined,
  error: (..._args: unknown[]) => undefined,
  exit: (code: number): never => {
    throw new Error(`embedded tui runtime exit ${String(code)}`);
  },
};

function resolveBtwQuestion(message: string): string | undefined {
  const match = /^\/btw(?::|\s)+(.*)$/i.exec(message.trim());
  const question = match?.[1]?.trim();
  return question ? question : undefined;
}

function payloadText(parts: unknown): string {
  const entries = Array.isArray(parts) ? parts : parts ? [parts] : [];
  if (entries.length === 0) {
    return "";
  }
  return entries
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }
      const payload = part as { text?: unknown };
      return typeof payload.text === "string" ? payload.text.trim() : "";
    })
    .filter((text) => text.length > 0)
    .join("\n\n")
    .trim();
}

function timeoutSecondsFromMs(timeoutMs?: number): string | undefined {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return undefined;
  }
  return String(Math.max(0, Math.ceil(timeoutMs / 1000)));
}

function timeoutSecondsNumberFromMs(timeoutMs?: number): number | undefined {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return undefined;
  }
  return Math.max(0, Math.ceil(timeoutMs / 1000));
}

function shouldUseReplyCommandPipeline(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) {
    return false;
  }
  // /btw is handled as a side-result lane by the TUI so it does not disturb
  // the active chat run.
  if (/^\/btw(?::|\s|$)/i.test(trimmed)) {
    return false;
  }
  return true;
}

function buildEmbeddedStatusReply(params: {
  message: string;
  activeRunCount: number;
  sessionKey: string;
}): string | undefined {
  const command = params.message.trim().toLowerCase();
  if (command !== "/status") {
    return undefined;
  }

  const parsed = parseAgentSessionKey(params.sessionKey);
  const agentId = parsed?.agentId ?? "main";
  const sessionLabel = parsed?.rest ?? params.sessionKey;
  const otherRuns = Math.max(0, params.activeRunCount - 1);
  const lines = [
    "Kova terminal status",
    `- mode: local embedded`,
    `- agent: ${agentId}`,
    `- session: ${sessionLabel}`,
    `- activity: ${otherRuns > 0 ? `${String(otherRuns)} other active run${otherRuns === 1 ? "" : "s"}` : "idle"}`,
  ];
  lines.push("More: /gateway-status, /tools, /skills, /tasks");
  return lines.join("\n");
}

function sanitizeTraceSegment(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return fallback;
  }
  const normalized = raw.replace(/[^a-z0-9_.-]+/gi, "_").replace(/^_+|_+$/g, "");
  return normalized.slice(0, 64) || fallback;
}

function replyText(reply: ReplyPayload | ReplyPayload[] | undefined): string {
  return payloadText(reply);
}

export class EmbeddedTuiBackend implements TuiBackend {
  readonly connection = { url: "local embedded" };

  onEvent?: (evt: TuiEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;

  private deps?: DefaultDeps;
  private depsPromise?: Promise<DefaultDeps>;
  private readonly runs = new Map<string, LocalRunState>();
  private unsubscribe?: () => void;
  private warmupTimer?: ReturnType<typeof setTimeout>;
  private warmupPromise?: Promise<void>;
  private previousRuntimeLog?: typeof defaultRuntime.log;
  private previousRuntimeError?: typeof defaultRuntime.error;
  private seq = 0;

  start() {
    if (this.unsubscribe) {
      return;
    }
    setEmbeddedMode(true);
    // Suppress console output from logError/logInfo that would pollute the TUI.
    // File logger (getLogger()) still captures everything via logger.ts:35.
    this.previousRuntimeLog = defaultRuntime.log;
    this.previousRuntimeError = defaultRuntime.error;
    defaultRuntime.log = silentRuntime.log;
    defaultRuntime.error = silentRuntime.error;
    this.unsubscribe = onAgentEvent((evt) => {
      void this.handleAgentEvent(evt);
    });
    queueMicrotask(() => {
      this.onConnected?.();
      this.scheduleWarmup();
    });
  }

  stop() {
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = undefined;
    }
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const run of this.runs.values()) {
      run.controller.abort();
    }
    this.runs.clear();
    defaultRuntime.log = this.previousRuntimeLog ?? defaultRuntime.log;
    defaultRuntime.error = this.previousRuntimeError ?? defaultRuntime.error;
    this.previousRuntimeLog = undefined;
    this.previousRuntimeError = undefined;
    setEmbeddedMode(false);
  }

  async sendChat(opts: ChatSendOptions): Promise<{ runId: string }> {
    const runId = opts.runId ?? randomUUID();
    const question = resolveBtwQuestion(opts.message);
    if (!question) {
      this.abortSessionRuns(opts.sessionKey);
    }
    const controller = new AbortController();
    const trace = new TuiTurnTrace({
      runId,
      sessionKey: opts.sessionKey,
      emit: (payload) => this.emit("trace", payload),
    });
    trace.step("send.accepted", question ? "btw" : "chat");
    this.runs.set(runId, {
      sessionKey: opts.sessionKey,
      controller,
      buffer: "",
      isBtw: Boolean(question),
      question,
      finalSent: false,
      registered: false,
      trace,
      firstAgentEventSent: false,
      firstAssistantEventSent: false,
    });

    void this.runTurn({
      runId,
      sessionKey: opts.sessionKey,
      message: opts.message,
      thinking: opts.thinking,
      deliver: opts.deliver,
      timeoutMs: opts.timeoutMs,
      controller,
    });

    return { runId };
  }

  async abortChat(opts: { sessionKey: string; runId: string }) {
    const run = this.runs.get(opts.runId);
    if (!run || run.sessionKey !== opts.sessionKey) {
      return { ok: true, aborted: false };
    }
    run.controller.abort();
    return { ok: true, aborted: true };
  }

  async steerChat(opts: { sessionKey: string; message: string }) {
    const { queueEmbeddedPiMessageWithOutcome, resolveActiveEmbeddedRunSessionId } =
      await import("../agents/pi-embedded-runner/runs.js");
    const sessionId = resolveActiveEmbeddedRunSessionId(opts.sessionKey);
    if (!sessionId) {
      return { ok: false, reason: "no_active_run" };
    }
    const outcome = queueEmbeddedPiMessageWithOutcome(sessionId, opts.message, {
      steeringMode: "all",
    });
    return outcome.queued ? { ok: true } : { ok: false, reason: outcome.reason };
  }

  async loadHistory(opts: { sessionKey: string; limit?: number }) {
    const [
      { resolveSessionAgentId },
      { projectRecentChatDisplayMessages, resolveEffectiveChatHistoryMaxChars },
      { augmentChatHistoryWithCliSessionImports },
      { getMaxChatHistoryMessagesBytes },
      {
        augmentChatHistoryWithCanvasBlocks,
        CHAT_HISTORY_MAX_SINGLE_MESSAGE_BYTES,
        enforceChatHistoryFinalBudget,
        replaceOversizedChatHistoryMessages,
      },
      { capArrayByJsonBytes },
      { loadSessionEntry, readSessionMessages, resolveSessionModelRef },
    ] = await Promise.all([
      getAgentScopeModule(),
      getChatDisplayProjectionModule(),
      getCliSessionHistoryModule(),
      getServerConstantsModule(),
      getChatServerMethodsModule(),
      getSessionUtilsFsModule(),
      getSessionUtilsModule(),
    ]);
    const { cfg, storePath, entry } = loadSessionEntry(opts.sessionKey);
    const sessionId = entry?.sessionId;
    const sessionAgentId = resolveSessionAgentId({ sessionKey: opts.sessionKey, config: cfg });
    const resolvedSessionModel = resolveSessionModelRef(cfg, entry, sessionAgentId);
    const localMessages =
      sessionId && storePath ? readSessionMessages(sessionId, storePath, entry?.sessionFile) : [];
    const rawMessages = augmentChatHistoryWithCliSessionImports({
      entry,
      provider: resolvedSessionModel.provider,
      localMessages,
    });
    const max = Math.min(1000, typeof opts.limit === "number" ? opts.limit : 200);
    const effectiveMaxChars = resolveEffectiveChatHistoryMaxChars(cfg);
    const normalized = augmentChatHistoryWithCanvasBlocks(
      projectRecentChatDisplayMessages(rawMessages, {
        maxChars: effectiveMaxChars,
        maxMessages: max,
      }),
    );
    const maxHistoryBytes = getMaxChatHistoryMessagesBytes();
    const perMessageHardCap = Math.min(CHAT_HISTORY_MAX_SINGLE_MESSAGE_BYTES, maxHistoryBytes);
    const replaced = replaceOversizedChatHistoryMessages({
      messages: normalized,
      maxSingleMessageBytes: perMessageHardCap,
    });
    const capped = capArrayByJsonBytes(replaced.messages, maxHistoryBytes).items;
    const bounded = enforceChatHistoryFinalBudget({ messages: capped, maxBytes: maxHistoryBytes });
    const messages = bounded.messages;

    let thinkingLevel = entry?.thinkingLevel;
    if (!thinkingLevel) {
      const { resolveThinkingDefault } = await import("../agents/model-thinking-default.js");
      thinkingLevel = resolveThinkingDefault({
        cfg,
        provider: resolvedSessionModel.provider,
        model: resolvedSessionModel.model,
      });
    }

    return {
      sessionKey: opts.sessionKey,
      sessionId,
      messages,
      thinkingLevel,
      fastMode: entry?.fastMode,
      verboseLevel: entry?.verboseLevel ?? cfg.agents?.defaults?.verboseDefault,
    };
  }

  async listSessions(opts?: Parameters<TuiBackend["listSessions"]>[0]): Promise<TuiSessionList> {
    const { getRuntimeConfig } = await getConfigModule();
    const { listSessionsFromStore, loadCombinedSessionStoreForGateway } =
      await getSessionUtilsModule();
    const cfg = getRuntimeConfig();
    const { storePath, store } = loadCombinedSessionStoreForGateway(cfg);
    return listSessionsFromStore({
      cfg,
      storePath,
      store,
      opts: opts ?? {},
    }) as TuiSessionList;
  }

  async listAgents(): Promise<TuiAgentsList> {
    const [{ getRuntimeConfig }, { listAgentsForGateway }] = await Promise.all([
      getConfigModule(),
      getSessionUtilsModule(),
    ]);
    return listAgentsForGateway(getRuntimeConfig()) as TuiAgentsList;
  }

  async patchSession(
    opts: Parameters<TuiBackend["patchSession"]>[0],
  ): Promise<SessionsPatchResult> {
    const [
      { resolveSessionAgentId },
      { getRuntimeConfig },
      {
        migrateAndPruneGatewaySessionStoreKey,
        resolveGatewaySessionStoreTarget,
        resolveSessionModelRef,
      },
    ] = await Promise.all([getAgentScopeModule(), getConfigModule(), getSessionUtilsModule()]);
    const cfg = getRuntimeConfig();
    const target = resolveGatewaySessionStoreTarget({ cfg, key: opts.key });
    const [{ updateSessionStore }, { applySessionsPatchToStore }, { loadGatewayModelCatalog }] =
      await Promise.all([
        import("../config/sessions.js"),
        import("../gateway/sessions-patch.js"),
        import("../gateway/server-model-catalog.js"),
      ]);
    const applied = await updateSessionStore(target.storePath, async (store) => {
      const { primaryKey } = migrateAndPruneGatewaySessionStoreKey({
        cfg,
        key: opts.key,
        store,
      });
      return await applySessionsPatchToStore({
        cfg,
        store,
        storeKey: primaryKey,
        patch: opts,
        loadGatewayModelCatalog,
      });
    });
    if (!applied.ok) {
      throw new Error(applied.error.message);
    }

    const agentId = resolveSessionAgentId({
      sessionKey: target.canonicalKey ?? opts.key,
      config: cfg,
    });
    const resolved = resolveSessionModelRef(cfg, applied.entry, agentId);
    return {
      ok: true as const,
      path: target.storePath,
      key: target.canonicalKey ?? opts.key,
      entry: applied.entry,
      resolved: {
        modelProvider: resolved.provider,
        model: resolved.model,
      },
    };
  }

  async resetSession(key: string, reason?: "new" | "reset") {
    const { performGatewaySessionReset } = await import("../gateway/session-reset-service.js");
    const result = await performGatewaySessionReset({
      key,
      reason: reason === "new" ? "new" : "reset",
      commandSource: "tui:embedded",
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return { ok: true, key: result.key, entry: result.entry };
  }

  async getGatewayStatus() {
    return `local embedded mode${this.runs.size > 0 ? ` (${String(this.runs.size)} active run${this.runs.size === 1 ? "" : "s"})` : ""}`;
  }

  async listModels(): Promise<TuiModelChoice[]> {
    const [
      { DEFAULT_PROVIDER },
      { buildAllowedModelSet },
      { getRuntimeConfig },
      { loadGatewayModelCatalog },
    ] = await Promise.all([
      import("../agents/defaults.js"),
      import("../agents/model-selection.js"),
      getConfigModule(),
      import("../gateway/server-model-catalog.js"),
    ]);
    const catalog = await loadGatewayModelCatalog();
    const cfg = getRuntimeConfig();
    const { allowedCatalog } = buildAllowedModelSet({
      cfg,
      catalog,
      defaultProvider: DEFAULT_PROVIDER,
    });
    const entries = allowedCatalog.length > 0 ? allowedCatalog : catalog;
    return entries.map((entry) => ({
      id: entry.id,
      name: entry.name ?? entry.id,
      provider: entry.provider,
      contextWindow: entry.contextWindow,
      reasoning: entry.reasoning,
    }));
  }

  async listCommands(opts = {}) {
    const [{ getRuntimeConfig }, { buildCommandsListResult }, { resolveDefaultAgentId }] =
      await Promise.all([
        getConfigModule(),
        import("../gateway/server-methods/commands.js"),
        getAgentScopeModule(),
      ]);
    const params = opts as {
      agentId?: string;
      provider?: string;
      scope?: "native" | "text" | "both";
      includeArgs?: boolean;
    };
    const cfg = getRuntimeConfig();
    const result = buildCommandsListResult({
      cfg,
      agentId: params.agentId?.trim() || resolveDefaultAgentId(cfg),
      provider: params.provider,
      scope: params.scope,
      includeArgs: params.includeArgs,
    });
    return result.commands;
  }

  async listPlugins() {
    const [
      { getRuntimeConfig },
      { loadInstalledPluginIndexInstallRecords },
      { createPluginsStatusResult },
    ] = await Promise.all([
      getConfigModule(),
      import("../plugins/installed-plugin-index-records.js"),
      import("../gateway/server-methods/plugins.js"),
    ]);
    const installRecords = await loadInstalledPluginIndexInstallRecords();
    return createPluginsStatusResult(getRuntimeConfig(), { installRecords });
  }

  async listTools(opts: { agentId: string; includePlugins?: boolean }) {
    const [{ getRuntimeConfig }, { buildToolsCatalogResult }] = await Promise.all([
      getConfigModule(),
      import("../gateway/server-methods/tools-catalog.js"),
    ]);
    return buildToolsCatalogResult({
      cfg: getRuntimeConfig(),
      agentId: opts.agentId,
      includePlugins: opts.includePlugins,
    });
  }

  async listSkills(opts: { agentId: string }): Promise<SkillStatusReport> {
    const [
      { resolveAgentWorkspaceDir },
      { canExecRequestNode },
      { buildWorkspaceSkillStatus },
      { getRemoteSkillEligibility },
    ] = await Promise.all([
      getAgentScopeModule(),
      import("../agents/exec-defaults.js"),
      import("../agents/skills-status.js"),
      import("../infra/skills-remote.js"),
    ]);
    const { getRuntimeConfig } = await getConfigModule();
    const cfg = getRuntimeConfig();
    const workspaceDir = resolveAgentWorkspaceDir(cfg, opts.agentId);
    return buildWorkspaceSkillStatus(workspaceDir, {
      config: cfg,
      eligibility: {
        remote: getRemoteSkillEligibility({
          advertiseExecNode: canExecRequestNode({
            cfg,
            agentId: opts.agentId,
          }),
        }),
      },
    });
  }

  async listTasks(opts: { status?: string; runtime?: string; limit?: number } = {}) {
    const [
      { getRuntimeConfig },
      { resolveCronStorePath },
      { mapTaskRunAggregateSummary, mapTaskRunView },
      { configureTaskRegistryMaintenance, reconcileInspectableTasks },
      { summarizeTaskRecords },
    ] = await Promise.all([
      getConfigModule(),
      import("../cron/store.js"),
      import("../tasks/task-domain-views.js"),
      import("../tasks/task-registry.maintenance.js"),
      import("../tasks/task-registry.summary.js"),
    ]);
    const cfg = getRuntimeConfig();
    configureTaskRegistryMaintenance({
      cronStorePath: resolveCronStorePath(cfg.cron?.store),
    });
    const status = opts.status?.trim();
    const runtime = opts.runtime?.trim();
    const limit =
      typeof opts.limit === "number" && Number.isFinite(opts.limit)
        ? Math.max(1, Math.min(500, Math.floor(opts.limit)))
        : 50;
    const allRecords = reconcileInspectableTasks();
    const records = allRecords
      .filter((task) => (!status || status === "all" ? true : task.status === status))
      .filter((task) => (!runtime || runtime === "all" ? true : task.runtime === runtime))
      .slice(0, limit);
    return {
      tasks: records.map((task) => mapTaskRunView(task)),
      summary: mapTaskRunAggregateSummary(summarizeTaskRecords(allRecords)),
      count: records.length,
    };
  }

  async auditTasks() {
    const [
      { getRuntimeConfig },
      { resolveCronStorePath },
      { configureTaskRegistryMaintenance, getInspectableTaskAuditSummary },
      { getInspectableTaskFlowAuditSummary },
    ] = await Promise.all([
      getConfigModule(),
      import("../cron/store.js"),
      import("../tasks/task-registry.maintenance.js"),
      import("../tasks/task-flow-registry.maintenance.js"),
    ]);
    const cfg = getRuntimeConfig();
    configureTaskRegistryMaintenance({
      cronStorePath: resolveCronStorePath(cfg.cron?.store),
    });
    return {
      tasks: getInspectableTaskAuditSummary(),
      flows: getInspectableTaskFlowAuditSummary(),
    };
  }

  async maintainTasks(opts: { apply?: boolean } = {}) {
    const [
      { getRuntimeConfig },
      { resolveCronStorePath },
      {
        configureTaskRegistryMaintenance,
        previewTaskRegistryMaintenance,
        runTaskRegistryMaintenance,
      },
      { previewTaskFlowRegistryMaintenance, runTaskFlowRegistryMaintenance },
    ] = await Promise.all([
      getConfigModule(),
      import("../cron/store.js"),
      import("../tasks/task-registry.maintenance.js"),
      import("../tasks/task-flow-registry.maintenance.js"),
    ]);
    const cfg = getRuntimeConfig();
    configureTaskRegistryMaintenance({
      cronStorePath: resolveCronStorePath(cfg.cron?.store),
    });
    const apply = opts.apply === true;
    const [tasks, flows] = apply
      ? await Promise.all([runTaskRegistryMaintenance(), runTaskFlowRegistryMaintenance()])
      : [previewTaskRegistryMaintenance(), previewTaskFlowRegistryMaintenance()];
    return { apply, tasks, flows };
  }

  async listSessionCheckpoints(opts: { key: string }) {
    const [{ loadSessionEntry }, { listSessionCompactionCheckpoints }] = await Promise.all([
      getSessionUtilsModule(),
      import("../gateway/session-compaction-checkpoints.js"),
    ]);
    const { entry, canonicalKey } = loadSessionEntry(opts.key);
    return {
      key: canonicalKey,
      checkpoints: listSessionCompactionCheckpoints(entry),
    };
  }

  async getSessionCheckpoint(opts: { key: string; checkpointId: string }) {
    const [{ loadSessionEntry }, { getSessionCompactionCheckpoint }] = await Promise.all([
      getSessionUtilsModule(),
      import("../gateway/session-compaction-checkpoints.js"),
    ]);
    const checkpointId = opts.checkpointId.trim();
    if (!checkpointId) {
      throw new Error("checkpointId required");
    }
    const { entry, canonicalKey } = loadSessionEntry(opts.key);
    const checkpoint = getSessionCompactionCheckpoint({ entry, checkpointId });
    if (!checkpoint) {
      throw new Error(`checkpoint not found: ${checkpointId}`);
    }
    return {
      key: canonicalKey,
      checkpoint,
    };
  }

  async branchSessionCheckpoint(opts: { key: string; checkpointId: string }) {
    const { branchSessionCompactionCheckpoint } = await getSessionCheckpointActionsModule();
    return await branchSessionCompactionCheckpoint(opts);
  }

  async restoreSessionCheckpoint(opts: { key: string; checkpointId: string }) {
    const { restoreSessionCompactionCheckpoint } = await getSessionCheckpointActionsModule();
    return await restoreSessionCompactionCheckpoint(opts);
  }

  private async getDeps(): Promise<DefaultDeps> {
    if (!this.deps) {
      this.depsPromise ??= import("../cli/deps.js")
        .then(({ createDefaultDeps }) => {
          this.deps = createDefaultDeps();
          return this.deps;
        })
        .catch((error: unknown) => {
          this.depsPromise = undefined;
          throw error;
        });
      await this.depsPromise;
    }
    return this.deps as DefaultDeps;
  }

  private scheduleWarmup() {
    if (this.warmupTimer || this.warmupPromise) {
      return;
    }
    this.warmupTimer = setTimeout(() => {
      this.warmupTimer = undefined;
      this.warmupPromise = Promise.allSettled([
        getConfigModule(),
        getSessionUtilsModule(),
        getAgentTimestampModule(),
        getAgentCommandModule(),
        this.getDeps(),
      ]).then(() => undefined);
    }, EMBEDDED_TUI_WARMUP_DELAY_MS);
    this.warmupTimer.unref?.();
  }

  private abortSessionRuns(sessionKey: string) {
    for (const run of this.runs.values()) {
      if (run.sessionKey === sessionKey && !run.isBtw) {
        run.controller.abort();
      }
    }
  }

  private nextSeq() {
    this.seq += 1;
    return this.seq;
  }

  private emit(event: string, payload: unknown) {
    this.onEvent?.({
      event,
      payload,
      seq: this.nextSeq(),
    });
  }

  private emitChatDelta(runId: string, run: LocalRunState) {
    const projected = projectLiveAssistantBufferedText(run.buffer.trim(), {
      suppressLeadFragments: true,
    });
    const text = projected.text.trim();
    if (!text || projected.suppress) {
      return;
    }
    run.registered = true;
    this.emit("chat", {
      runId,
      sessionKey: run.sessionKey,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      },
    });
  }

  private emitChatFinal(runId: string, run: LocalRunState, stopReason?: string) {
    if (run.finalSent) {
      return;
    }
    run.trace.step("turn.final", stopReason ? `stop ${stopReason}` : undefined);
    run.finalSent = true;
    run.registered = true;
    const projected = projectLiveAssistantBufferedText(run.buffer.trim(), {
      suppressLeadFragments: false,
    });
    const text = projected.text.trim();
    const shouldIncludeMessage = Boolean(text) && !projected.suppress;
    this.emit("chat", {
      runId,
      sessionKey: run.sessionKey,
      state: "final",
      ...(stopReason ? { stopReason } : {}),
      ...(shouldIncludeMessage
        ? {
            message: {
              role: "assistant",
              content: [{ type: "text", text }],
              timestamp: Date.now(),
            },
          }
        : {}),
    });
    run.trace.summary("final");
  }

  private emitChatAborted(runId: string, run: LocalRunState) {
    if (run.finalSent) {
      return;
    }
    run.trace.step("turn.aborted");
    run.finalSent = true;
    run.registered = true;
    this.emit("chat", {
      runId,
      sessionKey: run.sessionKey,
      state: "aborted",
    });
    run.trace.summary("aborted");
  }

  private emitChatError(runId: string, run: LocalRunState, errorMessage?: string) {
    if (run.finalSent) {
      return;
    }
    run.trace.step("turn.error", errorMessage?.slice(0, 160));
    run.finalSent = true;
    run.registered = true;
    this.emit("chat", {
      runId,
      sessionKey: run.sessionKey,
      state: "error",
      ...(errorMessage ? { errorMessage } : {}),
    });
    run.trace.summary("error");
  }

  private emitChatCommandFinal(runId: string, run: LocalRunState, text: string) {
    if (run.finalSent) {
      return;
    }
    run.trace.step("turn.final", "command");
    run.finalSent = true;
    run.registered = true;
    this.emit("chat", {
      runId,
      sessionKey: run.sessionKey,
      state: "final",
      message: {
        role: "assistant",
        command: true,
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      },
    });
    run.trace.summary("command");
  }

  private ensureRunRegistered(runId: string, run: LocalRunState) {
    if (run.registered || run.isBtw) {
      return;
    }
    run.registered = true;
    this.emit("chat", {
      runId,
      sessionKey: run.sessionKey,
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "" }],
        timestamp: Date.now(),
      },
    });
  }

  private async handleAgentEvent(evt: AgentEventPayload) {
    const run = this.runs.get(evt.runId);
    if (!run) {
      return;
    }
    if (!run.firstAgentEventSent) {
      run.firstAgentEventSent = true;
      run.trace.step("agent.event.first", evt.stream);
    }
    if (evt.stream === "lifecycle") {
      const phase = sanitizeTraceSegment(evt.data?.phase, "event");
      if (phase === "start" || phase === "end" || phase === "error") {
        run.trace.step(`lifecycle.${phase}`);
      }
    } else if (evt.stream === "tool") {
      const phase = sanitizeTraceSegment(evt.data?.phase, "event");
      if (phase === "start" || phase === "result") {
        const toolName = sanitizeTraceSegment(evt.data?.name, "tool");
        const isError = evt.data?.isError === true ? "error" : undefined;
        run.trace.step(`tool.${toolName}.${phase}`, isError);
      }
    }

    if (evt.stream !== "assistant") {
      this.ensureRunRegistered(evt.runId, run);
    }

    this.emit("agent", {
      runId: evt.runId,
      stream: evt.stream,
      data: evt.data,
    });

    if (
      evt.stream === "assistant" &&
      !run.isBtw &&
      typeof evt.data?.text === "string" &&
      !shouldSuppressAssistantEventForLiveChat(evt.data)
    ) {
      const cleaned = normalizeLiveAssistantEventText({
        text: evt.data.text,
        delta: evt.data.delta,
      });
      if (!run.firstAssistantEventSent) {
        run.firstAssistantEventSent = true;
        run.trace.step("assistant.text.first");
      }
      run.buffer = resolveMergedAssistantText({
        previousText: run.buffer,
        nextText: cleaned.text,
        nextDelta: cleaned.delta,
      });
      this.emitChatDelta(evt.runId, run);
      return;
    }

    if (evt.stream !== "lifecycle") {
      return;
    }

    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
    const aborted = evt.data?.aborted === true || run.controller.signal.aborted;
    if (phase === "end") {
      if (aborted) {
        this.emitChatAborted(evt.runId, run);
        return;
      }
      if (!run.isBtw) {
        const stopReason =
          typeof evt.data?.stopReason === "string" ? evt.data.stopReason : undefined;
        this.emitChatFinal(evt.runId, run, stopReason);
      }
      return;
    }

    if (phase === "error") {
      if (aborted) {
        this.emitChatAborted(evt.runId, run);
        return;
      }
      // Embedded model fallback can emit a lifecycle error for a failed
      // candidate and then continue with the next candidate. The runTurn
      // promise is the terminal authority; it will emit a final error if the
      // whole run actually fails.
      return;
    }
  }

  private async runTextCommandTurn(params: {
    runId: string;
    sessionKey: string;
    message: string;
    timeoutMs?: number;
    controller: AbortController;
  }) {
    const trace = this.runs.get(params.runId)?.trace;
    trace?.step("command.session.load.start");
    const [{ loadSessionEntry }, { injectTimestamp, timestampOptsFromConfig }] = await Promise.all([
      getSessionUtilsModule(),
      getAgentTimestampModule(),
    ]);
    const { cfg, canonicalKey } = loadSessionEntry(params.sessionKey);
    trace?.step("command.session.load.end");
    const commandBody = params.message;
    const stampedMessage = injectTimestamp(params.message, timestampOptsFromConfig(cfg));
    const ctx: MsgContext = {
      Body: params.message,
      BodyForAgent: stampedMessage,
      BodyForCommands: commandBody,
      RawBody: params.message,
      CommandBody: commandBody,
      InputProvenance: { kind: "external_user", sourceChannel: INTERNAL_MESSAGE_CHANNEL },
      SessionKey: canonicalKey,
      Provider: INTERNAL_MESSAGE_CHANNEL,
      Surface: INTERNAL_MESSAGE_CHANNEL,
      OriginatingChannel: INTERNAL_MESSAGE_CHANNEL,
      ChatType: "direct",
      CommandSource: "text",
      CommandAuthorized: true,
      MessageSid: params.runId,
      SenderId: "tui-local",
      SenderName: "TUI",
      SenderUsername: "tui",
    };
    let agentRunStarted = false;
    trace?.step("command.pipeline.import.start");
    const { getReplyFromConfig } = await import("../auto-reply/reply/get-reply.js");
    trace?.step("command.pipeline.import.end");
    trace?.step("command.pipeline.start");
    const reply = await getReplyFromConfig(
      ctx,
      {
        runId: params.runId,
        abortSignal: params.controller.signal,
        timeoutOverrideSeconds: timeoutSecondsNumberFromMs(params.timeoutMs),
        onAgentRunStart: () => {
          agentRunStarted = true;
        },
      },
      cfg,
    );
    trace?.step("command.pipeline.end");
    const run = this.runs.get(params.runId);
    if (!run) {
      return;
    }
    const text = replyText(reply);
    if (!agentRunStarted) {
      this.emitChatCommandFinal(params.runId, run, text || "(no output)");
      return;
    }
    if (text && !run.buffer) {
      run.buffer = text;
    }
    this.emitChatFinal(params.runId, run);
  }

  private async runTurn(params: {
    runId: string;
    sessionKey: string;
    message: string;
    thinking?: string;
    deliver?: boolean;
    timeoutMs?: number;
    controller: AbortController;
  }) {
    try {
      this.runs.get(params.runId)?.trace.step("turn.start");
      const fastCommandReply = buildEmbeddedStatusReply({
        message: params.message,
        activeRunCount: this.runs.size,
        sessionKey: params.sessionKey,
      });
      if (fastCommandReply) {
        const run = this.runs.get(params.runId);
        if (run) {
          this.runs.get(params.runId)?.trace.step("command.fast", "/status");
          this.emitChatCommandFinal(params.runId, run, fastCommandReply);
        }
        return;
      }
      this.runs.get(params.runId)?.trace.step("session.load.start");
      const [sessionUtils, { injectTimestamp, timestampOptsFromConfig }] = await Promise.all([
        getSessionUtilsModule(),
        getAgentTimestampModule(),
      ]);
      const session = sessionUtils.loadSessionEntry(params.sessionKey);
      const { cfg, canonicalKey, entry } = session;
      this.runs
        .get(params.runId)
        ?.trace.step("session.load.end", entry?.sessionId ? "existing session" : "new session");
      if (shouldUseReplyCommandPipeline(params.message)) {
        this.runs.get(params.runId)?.trace.step("command.route");
        await this.runTextCommandTurn({
          runId: params.runId,
          sessionKey: params.sessionKey,
          message: params.message,
          timeoutMs: params.timeoutMs,
          controller: params.controller,
        });
        return;
      }
      this.runs.get(params.runId)?.trace.step("agent.imports.start");
      const [{ agentCommandFromIngress }, deps] = await Promise.all([
        getAgentCommandModule(),
        this.getDeps(),
      ]);
      this.runs.get(params.runId)?.trace.step("agent.imports.end");
      this.runs.get(params.runId)?.trace.step("agent.dispatch.start");
      const result = await agentCommandFromIngress(
        {
          message: injectTimestamp(params.message, timestampOptsFromConfig(cfg)),
          sessionKey: canonicalKey,
          ...(entry?.sessionId ? { sessionId: entry.sessionId } : {}),
          thinking: params.thinking,
          deliver: params.deliver,
          channel: INTERNAL_MESSAGE_CHANNEL,
          runContext: {
            surface: "tui",
            messageChannel: INTERNAL_MESSAGE_CHANNEL,
          },
          interactiveFailover: true,
          timeout: timeoutSecondsFromMs(params.timeoutMs),
          runId: params.runId,
          abortSignal: params.controller.signal,
          senderIsOwner: true,
          allowModelOverride: false,
        },
        silentRuntime,
        deps,
      );
      this.runs.get(params.runId)?.trace.step("agent.dispatch.end");
      const run = this.runs.get(params.runId);
      if (!run) {
        return;
      }

      if (run.isBtw) {
        const text = payloadText(result?.payloads);
        if (run.question && text) {
          this.emit("chat.side_result", {
            kind: "btw",
            runId: params.runId,
            sessionKey: run.sessionKey,
            question: run.question,
            text,
          });
        }
        this.emitChatFinal(params.runId, run);
        return;
      }

      if (!run.finalSent) {
        const normalizedText = payloadText(result?.payloads);
        if (normalizedText && !run.buffer) {
          run.buffer = normalizedText;
        }
        this.emitChatFinal(params.runId, run);
      }
    } catch (error) {
      const run = this.runs.get(params.runId);
      if (!run) {
        return;
      }
      if (params.controller.signal.aborted) {
        this.emitChatAborted(params.runId, run);
        return;
      }
      const errorMessage = formatTuiRunError(error);
      this.emitChatError(params.runId, run, errorMessage);
    } finally {
      this.runs.delete(params.runId);
    }
  }
}
