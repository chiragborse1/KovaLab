import { randomUUID } from "node:crypto";
import { resolveSessionAgentId } from "../agents/agent-scope.js";
import type { SkillStatusReport } from "../agents/skills-status.js";
import type { ReplyPayload } from "../auto-reply/reply-payload.js";
import type { MsgContext } from "../auto-reply/templating.js";
import { getRuntimeConfig } from "../config/config.js";
import {
  projectRecentChatDisplayMessages,
  resolveEffectiveChatHistoryMaxChars,
} from "../gateway/chat-display-projection.js";
import { augmentChatHistoryWithCliSessionImports } from "../gateway/cli-session-history.js";
import {
  normalizeLiveAssistantEventText,
  projectLiveAssistantBufferedText,
  resolveMergedAssistantText,
  shouldSuppressAssistantEventForLiveChat,
} from "../gateway/live-chat-projector.js";
import type { SessionsPatchResult } from "../gateway/protocol/index.js";
import { getMaxChatHistoryMessagesBytes } from "../gateway/server-constants.js";
import {
  injectTimestamp,
  timestampOptsFromConfig,
} from "../gateway/server-methods/agent-timestamp.js";
import {
  augmentChatHistoryWithCanvasBlocks,
  CHAT_HISTORY_MAX_SINGLE_MESSAGE_BYTES,
  enforceChatHistoryFinalBudget,
  replaceOversizedChatHistoryMessages,
} from "../gateway/server-methods/chat.js";
import { capArrayByJsonBytes } from "../gateway/session-utils.fs.js";
import {
  listAgentsForGateway,
  listSessionsFromStore,
  loadCombinedSessionStoreForGateway,
  loadSessionEntry,
  migrateAndPruneGatewaySessionStoreKey,
  resolveGatewaySessionStoreTarget,
  resolveSessionModelRef,
  readSessionMessages,
} from "../gateway/session-utils.js";
import { type AgentEventPayload, onAgentEvent } from "../infra/agent-events.js";
import { setEmbeddedMode } from "../infra/embedded-mode.js";
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

type LocalRunState = {
  sessionKey: string;
  controller: AbortController;
  buffer: string;
  isBtw: boolean;
  question?: string;
  finalSent: boolean;
  registered: boolean;
};

type DefaultDeps = ReturnType<(typeof import("../cli/deps.js"))["createDefaultDeps"]>;

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
    .filter(Boolean)
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
  private readonly runs = new Map<string, LocalRunState>();
  private unsubscribe?: () => void;
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
    });
  }

  stop() {
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
    this.runs.set(runId, {
      sessionKey: opts.sessionKey,
      controller,
      buffer: "",
      isBtw: Boolean(question),
      question,
      finalSent: false,
      registered: false,
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

  async loadHistory(opts: { sessionKey: string; limit?: number }) {
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
    return listAgentsForGateway(getRuntimeConfig()) as TuiAgentsList;
  }

  async patchSession(
    opts: Parameters<TuiBackend["patchSession"]>[0],
  ): Promise<SessionsPatchResult> {
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
    const [{ DEFAULT_PROVIDER }, { buildAllowedModelSet }, { loadGatewayModelCatalog }] =
      await Promise.all([
        import("../agents/defaults.js"),
        import("../agents/model-selection.js"),
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

  async listTools(opts: { agentId: string; includePlugins?: boolean }) {
    const { buildToolsCatalogResult } = await import("../gateway/server-methods/tools-catalog.js");
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
      import("../agents/agent-scope.js"),
      import("../agents/exec-defaults.js"),
      import("../agents/skills-status.js"),
      import("../infra/skills-remote.js"),
    ]);
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

  private async getDeps(): Promise<DefaultDeps> {
    if (!this.deps) {
      const { createDefaultDeps } = await import("../cli/deps.js");
      this.deps = createDefaultDeps();
    }
    return this.deps;
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
  }

  private emitChatAborted(runId: string, run: LocalRunState) {
    if (run.finalSent) {
      return;
    }
    run.finalSent = true;
    run.registered = true;
    this.emit("chat", {
      runId,
      sessionKey: run.sessionKey,
      state: "aborted",
    });
  }

  private emitChatError(runId: string, run: LocalRunState, errorMessage?: string) {
    if (run.finalSent) {
      return;
    }
    run.finalSent = true;
    run.registered = true;
    this.emit("chat", {
      runId,
      sessionKey: run.sessionKey,
      state: "error",
      ...(errorMessage ? { errorMessage } : {}),
    });
  }

  private emitChatCommandFinal(runId: string, run: LocalRunState, text: string) {
    if (run.finalSent) {
      return;
    }
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
    const { cfg, canonicalKey } = loadSessionEntry(params.sessionKey);
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
    const { getReplyFromConfig } = await import("../auto-reply/reply/get-reply.js");
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
      const { cfg, canonicalKey, entry } = loadSessionEntry(params.sessionKey);
      if (shouldUseReplyCommandPipeline(params.message)) {
        await this.runTextCommandTurn({
          runId: params.runId,
          sessionKey: params.sessionKey,
          message: params.message,
          timeoutMs: params.timeoutMs,
          controller: params.controller,
        });
        return;
      }
      const [{ agentCommandFromIngress }, deps] = await Promise.all([
        import("../agents/agent-command.js"),
        this.getDeps(),
      ]);
      const result = await agentCommandFromIngress(
        {
          message: injectTimestamp(params.message, timestampOptsFromConfig(cfg)),
          sessionKey: canonicalKey,
          ...(entry?.sessionId ? { sessionId: entry.sessionId } : {}),
          thinking: params.thinking,
          deliver: params.deliver,
          channel: INTERNAL_MESSAGE_CHANNEL,
          runContext: {
            messageChannel: INTERNAL_MESSAGE_CHANNEL,
          },
          timeout: timeoutSecondsFromMs(params.timeoutMs),
          runId: params.runId,
          abortSignal: params.controller.signal,
          senderIsOwner: true,
          allowModelOverride: false,
        },
        silentRuntime,
        deps,
      );
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emitChatError(params.runId, run, errorMessage);
    } finally {
      this.runs.delete(params.runId);
    }
  }
}
