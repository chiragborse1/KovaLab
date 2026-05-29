import { DEFAULT_HEARTBEAT_ACK_MAX_CHARS, stripHeartbeatToken } from "../auto-reply/heartbeat.js";
import { normalizeVerboseLevel } from "../auto-reply/thinking.js";
import { getRuntimeConfig } from "../config/config.js";
import { type AgentEventPayload, getAgentRunContext } from "../infra/agent-events.js";
import { detectErrorKind, type ErrorKind } from "../infra/errors.js";
import { resolveHeartbeatVisibility } from "../infra/heartbeat-visibility.js";
import { setSafeTimeout } from "../utils/timer-delay.js";
import {
  normalizeLiveAssistantEventText,
  projectLiveAssistantBufferedText,
  resolveMergedAssistantText,
  shouldSuppressAssistantEventForLiveChat,
} from "./live-chat-projector.js";
import { loadGatewaySessionRow } from "./server-chat.load-gateway-session-row.runtime.js";
import { persistGatewaySessionLifecycleEvent } from "./server-chat.persist-session-lifecycle.runtime.js";
import { deriveGatewaySessionLifecycleSnapshot } from "./session-lifecycle-state.js";
import { loadSessionEntry } from "./session-utils.js";
import { formatForLog } from "./ws-log.js";

function resolveHeartbeatAckMaxChars(): number {
  try {
    const cfg = getRuntimeConfig();
    return Math.max(
      0,
      cfg.agents?.defaults?.pulse?.ackMaxChars ??
        cfg.agents?.defaults?.heartbeat?.ackMaxChars ??
        DEFAULT_HEARTBEAT_ACK_MAX_CHARS,
    );
  } catch {
    return DEFAULT_HEARTBEAT_ACK_MAX_CHARS;
  }
}

function resolveHeartbeatContext(runId: string, sourceRunId?: string) {
  const primary = getAgentRunContext(runId);
  if (primary?.isHeartbeat) {
    return primary;
  }
  if (sourceRunId && sourceRunId !== runId) {
    const source = getAgentRunContext(sourceRunId);
    if (source?.isHeartbeat) {
      return source;
    }
  }
  return primary;
}

/**
 * Check if heartbeat ACK/noise should be hidden from interactive chat surfaces.
 */
function shouldHideHeartbeatChatOutput(runId: string, sourceRunId?: string): boolean {
  const runContext = resolveHeartbeatContext(runId, sourceRunId);
  if (!runContext?.isHeartbeat) {
    return false;
  }

  try {
    const cfg = getRuntimeConfig();
    const visibility = resolveHeartbeatVisibility({ cfg, channel: "webchat" });
    return !visibility.showOk;
  } catch {
    // Default to suppressing if we can't load config
    return true;
  }
}

function normalizeHeartbeatChatFinalText(params: {
  runId: string;
  sourceRunId?: string;
  text: string;
}): { suppress: boolean; text: string } {
  if (!shouldHideHeartbeatChatOutput(params.runId, params.sourceRunId)) {
    return { suppress: false, text: params.text };
  }

  const stripped = stripHeartbeatToken(params.text, {
    mode: "heartbeat",
    maxAckChars: resolveHeartbeatAckMaxChars(),
  });
  if (!stripped.didStrip) {
    return { suppress: false, text: params.text };
  }
  if (stripped.shouldSkip) {
    return { suppress: true, text: "" };
  }
  return { suppress: false, text: stripped.text };
}

export type ChatRunEntry = {
  sessionKey: string;
  clientRunId: string;
};

export type BufferedAgentEvent = {
  sessionKey?: string;
  payload: AgentEventPayload & { spawnedBy?: string };
};

export type ChatRunRegistry = {
  add: (sessionId: string, entry: ChatRunEntry) => void;
  peek: (sessionId: string) => ChatRunEntry | undefined;
  shift: (sessionId: string) => ChatRunEntry | undefined;
  remove: (sessionId: string, clientRunId: string, sessionKey?: string) => ChatRunEntry | undefined;
  clear: () => void;
};

export function createChatRunRegistry(): ChatRunRegistry {
  const chatRunSessions = new Map<string, ChatRunEntry[]>();

  const add = (sessionId: string, entry: ChatRunEntry) => {
    const queue = chatRunSessions.get(sessionId);
    if (queue) {
      queue.push(entry);
    } else {
      chatRunSessions.set(sessionId, [entry]);
    }
  };

  const peek = (sessionId: string) => chatRunSessions.get(sessionId)?.[0];

  const shift = (sessionId: string) => {
    const queue = chatRunSessions.get(sessionId);
    if (!queue || queue.length === 0) {
      return undefined;
    }
    const entry = queue.shift();
    if (!queue.length) {
      chatRunSessions.delete(sessionId);
    }
    return entry;
  };

  const remove = (sessionId: string, clientRunId: string, sessionKey?: string) => {
    const queue = chatRunSessions.get(sessionId);
    if (!queue || queue.length === 0) {
      return undefined;
    }
    const idx = queue.findIndex(
      (entry) =>
        entry.clientRunId === clientRunId && (sessionKey ? entry.sessionKey === sessionKey : true),
    );
    if (idx < 0) {
      return undefined;
    }
    const [entry] = queue.splice(idx, 1);
    if (!queue.length) {
      chatRunSessions.delete(sessionId);
    }
    return entry;
  };

  const clear = () => {
    chatRunSessions.clear();
  };

  return { add, peek, shift, remove, clear };
}

export type ChatRunState = {
  registry: ChatRunRegistry;
  rawBuffers: Map<string, string>;
  buffers: Map<string, string>;
  /** Last time any buffered assistant text changed, including suppressed raw buffers. */
  bufferUpdatedAt: Map<string, number>;
  deltaSentAt: Map<string, number>;
  /** Length of text at the time of the last broadcast, used to avoid duplicate flushes. */
  deltaLastBroadcastLen: Map<string, number>;
  deltaLastBroadcastText: Map<string, string>;
  agentDeltaSentAt: Map<string, number>;
  bufferedAgentEvents: Map<string, BufferedAgentEvent>;
  abortedRuns: Map<string, number>;
  clearRun: (runId: string) => void;
  clear: () => void;
};

export function createChatRunState(): ChatRunState {
  const registry = createChatRunRegistry();
  const rawBuffers = new Map<string, string>();
  const buffers = new Map<string, string>();
  const bufferUpdatedAt = new Map<string, number>();
  const deltaSentAt = new Map<string, number>();
  const deltaLastBroadcastLen = new Map<string, number>();
  const deltaLastBroadcastText = new Map<string, string>();
  const agentDeltaSentAt = new Map<string, number>();
  const bufferedAgentEvents = new Map<string, BufferedAgentEvent>();
  const abortedRuns = new Map<string, number>();

  const clearRun = (runId: string) => {
    rawBuffers.delete(runId);
    buffers.delete(runId);
    bufferUpdatedAt.delete(runId);
    deltaSentAt.delete(runId);
    deltaLastBroadcastLen.delete(runId);
    deltaLastBroadcastText.delete(runId);
    for (const key of [runId, `${runId}:assistant`, `${runId}:thinking`]) {
      agentDeltaSentAt.delete(key);
      bufferedAgentEvents.delete(key);
    }
  };

  const clear = () => {
    registry.clear();
    rawBuffers.clear();
    buffers.clear();
    bufferUpdatedAt.clear();
    deltaSentAt.clear();
    deltaLastBroadcastLen.clear();
    deltaLastBroadcastText.clear();
    agentDeltaSentAt.clear();
    bufferedAgentEvents.clear();
    abortedRuns.clear();
  };

  return {
    registry,
    rawBuffers,
    buffers,
    bufferUpdatedAt,
    deltaSentAt,
    deltaLastBroadcastLen,
    deltaLastBroadcastText,
    agentDeltaSentAt,
    bufferedAgentEvents,
    abortedRuns,
    clearRun,
    clear,
  };
}

export type ToolEventRecipientRegistry = {
  add: (runId: string, connId: string) => void;
  get: (runId: string) => ReadonlySet<string> | undefined;
  markFinal: (runId: string) => void;
};

export type SessionEventSubscriberRegistry = {
  subscribe: (connId: string) => void;
  unsubscribe: (connId: string) => void;
  getAll: () => ReadonlySet<string>;
  clear: () => void;
};

export type SessionMessageSubscriberRegistry = {
  subscribe: (connId: string, sessionKey: string) => void;
  unsubscribe: (connId: string, sessionKey: string) => void;
  unsubscribeAll: (connId: string) => void;
  get: (sessionKey: string) => ReadonlySet<string>;
  clear: () => void;
};

type ToolRecipientEntry = {
  connIds: Set<string>;
  updatedAt: number;
  finalizedAt?: number;
};

const TOOL_EVENT_RECIPIENT_TTL_MS = 10 * 60 * 1000;
const TOOL_EVENT_RECIPIENT_FINAL_GRACE_MS = 30 * 1000;
/**
 * Keep this aligned with the agent.wait lifecycle-error grace so chat surfaces
 * do not finalize a run before fallback or retry reuses the same runId.
 */
const AGENT_LIFECYCLE_ERROR_RETRY_GRACE_MS = 15_000;

export function createSessionEventSubscriberRegistry(): SessionEventSubscriberRegistry {
  const connIds = new Set<string>();
  const empty = new Set<string>();

  return {
    subscribe: (connId: string) => {
      const normalized = connId.trim();
      if (!normalized) {
        return;
      }
      connIds.add(normalized);
    },
    unsubscribe: (connId: string) => {
      const normalized = connId.trim();
      if (!normalized) {
        return;
      }
      connIds.delete(normalized);
    },
    getAll: () => (connIds.size > 0 ? connIds : empty),
    clear: () => {
      connIds.clear();
    },
  };
}

export function createSessionMessageSubscriberRegistry(): SessionMessageSubscriberRegistry {
  const sessionToConnIds = new Map<string, Set<string>>();
  const connToSessionKeys = new Map<string, Set<string>>();
  const empty = new Set<string>();

  const normalize = (value: string): string => value.trim();

  return {
    subscribe: (connId: string, sessionKey: string) => {
      const normalizedConnId = normalize(connId);
      const normalizedSessionKey = normalize(sessionKey);
      if (!normalizedConnId || !normalizedSessionKey) {
        return;
      }
      const connIds = sessionToConnIds.get(normalizedSessionKey) ?? new Set<string>();
      connIds.add(normalizedConnId);
      sessionToConnIds.set(normalizedSessionKey, connIds);

      const sessionKeys = connToSessionKeys.get(normalizedConnId) ?? new Set<string>();
      sessionKeys.add(normalizedSessionKey);
      connToSessionKeys.set(normalizedConnId, sessionKeys);
    },
    unsubscribe: (connId: string, sessionKey: string) => {
      const normalizedConnId = normalize(connId);
      const normalizedSessionKey = normalize(sessionKey);
      if (!normalizedConnId || !normalizedSessionKey) {
        return;
      }
      const connIds = sessionToConnIds.get(normalizedSessionKey);
      if (connIds) {
        connIds.delete(normalizedConnId);
        if (connIds.size === 0) {
          sessionToConnIds.delete(normalizedSessionKey);
        }
      }
      const sessionKeys = connToSessionKeys.get(normalizedConnId);
      if (sessionKeys) {
        sessionKeys.delete(normalizedSessionKey);
        if (sessionKeys.size === 0) {
          connToSessionKeys.delete(normalizedConnId);
        }
      }
    },
    unsubscribeAll: (connId: string) => {
      const normalizedConnId = normalize(connId);
      if (!normalizedConnId) {
        return;
      }
      const sessionKeys = connToSessionKeys.get(normalizedConnId);
      if (!sessionKeys) {
        return;
      }
      for (const sessionKey of sessionKeys) {
        const connIds = sessionToConnIds.get(sessionKey);
        if (!connIds) {
          continue;
        }
        connIds.delete(normalizedConnId);
        if (connIds.size === 0) {
          sessionToConnIds.delete(sessionKey);
        }
      }
      connToSessionKeys.delete(normalizedConnId);
    },
    get: (sessionKey: string) => {
      const normalizedSessionKey = normalize(sessionKey);
      if (!normalizedSessionKey) {
        return empty;
      }
      return sessionToConnIds.get(normalizedSessionKey) ?? empty;
    },
    clear: () => {
      sessionToConnIds.clear();
      connToSessionKeys.clear();
    },
  };
}

export function createToolEventRecipientRegistry(): ToolEventRecipientRegistry {
  const recipients = new Map<string, ToolRecipientEntry>();

  const prune = () => {
    if (recipients.size === 0) {
      return;
    }
    const now = Date.now();
    for (const [runId, entry] of recipients) {
      const cutoff = entry.finalizedAt
        ? entry.finalizedAt + TOOL_EVENT_RECIPIENT_FINAL_GRACE_MS
        : entry.updatedAt + TOOL_EVENT_RECIPIENT_TTL_MS;
      if (now >= cutoff) {
        recipients.delete(runId);
      }
    }
  };

  const add = (runId: string, connId: string) => {
    if (!runId || !connId) {
      return;
    }
    const now = Date.now();
    const existing = recipients.get(runId);
    if (existing) {
      existing.connIds.add(connId);
      existing.updatedAt = now;
    } else {
      recipients.set(runId, {
        connIds: new Set([connId]),
        updatedAt: now,
      });
    }
    prune();
  };

  const get = (runId: string) => {
    const entry = recipients.get(runId);
    if (!entry) {
      return undefined;
    }
    entry.updatedAt = Date.now();
    prune();
    return entry.connIds;
  };

  const markFinal = (runId: string) => {
    const entry = recipients.get(runId);
    if (!entry) {
      return;
    }
    entry.finalizedAt = Date.now();
    prune();
  };

  return { add, get, markFinal };
}

export type ChatEventBroadcast = (
  event: string,
  payload: unknown,
  opts?: { dropIfSlow?: boolean },
) => void;

export type NodeSendToSession = (sessionKey: string, event: string, payload: unknown) => void;

const CHAT_ERROR_KINDS = new Set<ErrorKind>([
  "refusal",
  "timeout",
  "rate_limit",
  "context_length",
  "unknown",
]);

function readChatErrorKind(value: unknown): ErrorKind | undefined {
  return typeof value === "string" && CHAT_ERROR_KINDS.has(value as ErrorKind)
    ? (value as ErrorKind)
    : undefined;
}

type BroadcastDelta = { deltaText: string; replace?: true };
type AgentTextThrottleStream = "assistant" | "thinking";

function resolveBroadcastDelta(params: {
  text: string;
  previousBroadcastText: string | undefined;
}): BroadcastDelta | undefined {
  if (!params.text) {
    return undefined;
  }
  const previous = params.previousBroadcastText;
  if (previous === undefined) {
    return { deltaText: params.text };
  }
  if (!params.text.startsWith(previous)) {
    return { deltaText: params.text, replace: true };
  }
  const deltaText = params.text.slice(previous.length);
  return deltaText ? { deltaText } : undefined;
}

function agentTextThrottleKey(clientRunId: string, stream: AgentTextThrottleStream): string {
  return `${clientRunId}:${stream}`;
}

function agentTextThrottleKeys(clientRunId: string): string[] {
  return [
    clientRunId,
    agentTextThrottleKey(clientRunId, "assistant"),
    agentTextThrottleKey(clientRunId, "thinking"),
  ];
}

export type AgentEventHandlerOptions = {
  broadcast: ChatEventBroadcast;
  broadcastToConnIds: (
    event: string,
    payload: unknown,
    connIds: ReadonlySet<string>,
    opts?: { dropIfSlow?: boolean },
  ) => void;
  nodeSendToSession: NodeSendToSession;
  agentRunSeq: Map<string, number>;
  chatRunState: ChatRunState;
  resolveSessionKeyForRun: (runId: string) => string | undefined;
  clearAgentRunContext: (runId: string) => void;
  toolEventRecipients: ToolEventRecipientRegistry;
  sessionEventSubscribers: SessionEventSubscriberRegistry;
  loadGatewaySessionRowForSnapshot?: typeof loadGatewaySessionRow;
  lifecycleErrorRetryGraceMs?: number;
  isChatSendRunActive?: (runId: string) => boolean;
};

export function createAgentEventHandler({
  broadcast,
  broadcastToConnIds,
  nodeSendToSession,
  agentRunSeq,
  chatRunState,
  resolveSessionKeyForRun,
  clearAgentRunContext,
  toolEventRecipients,
  sessionEventSubscribers,
  loadGatewaySessionRowForSnapshot = loadGatewaySessionRow,
  lifecycleErrorRetryGraceMs = AGENT_LIFECYCLE_ERROR_RETRY_GRACE_MS,
  isChatSendRunActive = () => false,
}: AgentEventHandlerOptions) {
  const pendingTerminalLifecycleErrors = new Map<string, NodeJS.Timeout>();

  const clearBufferedChatState = (clientRunId: string) => {
    chatRunState.clearRun(clientRunId);
  };

  const clearPendingTerminalLifecycleError = (runId: string) => {
    const pending = pendingTerminalLifecycleErrors.get(runId);
    if (!pending) {
      return;
    }
    clearTimeout(pending);
    pendingTerminalLifecycleErrors.delete(runId);
  };

  const buildSessionEventSnapshot = (sessionKey: string, evt?: AgentEventPayload) => {
    const row = loadGatewaySessionRowForSnapshot(sessionKey);
    const lifecyclePatch = evt
      ? deriveGatewaySessionLifecycleSnapshot({
          session: row
            ? {
                updatedAt: row.updatedAt ?? undefined,
                status: row.status,
                startedAt: row.startedAt,
                endedAt: row.endedAt,
                runtimeMs: row.runtimeMs,
                abortedLastRun: row.abortedLastRun,
              }
            : undefined,
          event: evt,
        })
      : {};
    const session = row ? { ...row, ...lifecyclePatch } : undefined;
    const snapshotSource = session ?? lifecyclePatch;
    return {
      ...(session ? { session } : {}),
      updatedAt: snapshotSource.updatedAt,
      sessionId: row?.sessionId,
      kind: row?.kind,
      channel: row?.channel,
      subject: row?.subject,
      groupChannel: row?.groupChannel,
      space: row?.space,
      chatType: row?.chatType,
      origin: row?.origin,
      spawnedBy: row?.spawnedBy,
      spawnedWorkspaceDir: row?.spawnedWorkspaceDir,
      forkedFromParent: row?.forkedFromParent,
      spawnDepth: row?.spawnDepth,
      subagentRole: row?.subagentRole,
      subagentControlScope: row?.subagentControlScope,
      label: row?.label,
      displayName: row?.displayName,
      deliveryContext: row?.deliveryContext,
      parentSessionKey: row?.parentSessionKey,
      childSessions: row?.childSessions,
      thinkingLevel: row?.thinkingLevel,
      fastMode: row?.fastMode,
      verboseLevel: row?.verboseLevel,
      traceLevel: row?.traceLevel,
      reasoningLevel: row?.reasoningLevel,
      elevatedLevel: row?.elevatedLevel,
      sendPolicy: row?.sendPolicy,
      systemSent: row?.systemSent,
      inputTokens: row?.inputTokens,
      outputTokens: row?.outputTokens,
      lastChannel: row?.lastChannel,
      lastTo: row?.lastTo,
      lastAccountId: row?.lastAccountId,
      lastThreadId: row?.lastThreadId,
      totalTokens: row?.totalTokens,
      totalTokensFresh: row?.totalTokensFresh,
      contextTokens: row?.contextTokens,
      estimatedCostUsd: row?.estimatedCostUsd,
      responseUsage: row?.responseUsage,
      modelProvider: row?.modelProvider,
      model: row?.model,
      status: snapshotSource.status,
      startedAt: snapshotSource.startedAt,
      endedAt: snapshotSource.endedAt,
      runtimeMs: snapshotSource.runtimeMs,
      abortedLastRun: snapshotSource.abortedLastRun,
    };
  };

  const finalizeLifecycleEvent = (
    evt: AgentEventPayload,
    opts?: { skipChatErrorFinal?: boolean },
  ) => {
    const lifecyclePhase =
      evt.stream === "lifecycle" && typeof evt.data?.phase === "string" ? evt.data.phase : null;
    if (lifecyclePhase !== "end" && lifecyclePhase !== "error") {
      return;
    }

    clearPendingTerminalLifecycleError(evt.runId);

    const chatLink = chatRunState.registry.peek(evt.runId);
    const eventSessionKey =
      typeof evt.sessionKey === "string" && evt.sessionKey.trim() ? evt.sessionKey : undefined;
    const isOperatorClientVisible = getAgentRunContext(evt.runId)?.isOperatorClientVisible ?? true;
    const sessionKey =
      chatLink?.sessionKey ?? eventSessionKey ?? resolveSessionKeyForRun(evt.runId);
    const clientRunId = chatLink?.clientRunId ?? evt.runId;
    const eventRunId = chatLink?.clientRunId ?? evt.runId;
    const isAborted =
      chatRunState.abortedRuns.has(clientRunId) || chatRunState.abortedRuns.has(evt.runId);

    flushBufferedAgentDeltaIfNeeded(clientRunId);

    if (isOperatorClientVisible && sessionKey) {
      if (!isAborted) {
        const evtStopReason =
          typeof evt.data?.stopReason === "string" ? evt.data.stopReason : undefined;
        const evtErrorKind =
          readChatErrorKind(evt.data?.errorKind) ?? detectErrorKind(evt.data?.error);
        if (chatLink) {
          const finished = chatRunState.registry.shift(evt.runId);
          if (!finished) {
            clearAgentRunContext(evt.runId);
            return;
          }
          if (!(opts?.skipChatErrorFinal && lifecyclePhase === "error")) {
            emitChatFinal(
              finished.sessionKey,
              finished.clientRunId,
              evt.runId,
              evt.seq,
              lifecyclePhase === "error" ? "error" : "done",
              evt.data?.error,
              evtStopReason,
              evtErrorKind,
            );
          }
        } else if (!(opts?.skipChatErrorFinal && lifecyclePhase === "error")) {
          emitChatFinal(
            sessionKey,
            eventRunId,
            evt.runId,
            evt.seq,
            lifecyclePhase === "error" ? "error" : "done",
            evt.data?.error,
            evtStopReason,
            evtErrorKind,
          );
        }
      } else {
        chatRunState.abortedRuns.delete(clientRunId);
        chatRunState.abortedRuns.delete(evt.runId);
        clearBufferedChatState(clientRunId);
        if (chatLink) {
          chatRunState.registry.remove(evt.runId, clientRunId, sessionKey);
        }
      }
    }

    toolEventRecipients.markFinal(evt.runId);
    clearAgentRunContext(evt.runId);
    agentRunSeq.delete(evt.runId);
    agentRunSeq.delete(clientRunId);

    if (sessionKey) {
      void persistGatewaySessionLifecycleEvent({ sessionKey, event: evt }).catch(() => undefined);
      const sessionEventConnIds = sessionEventSubscribers.getAll();
      if (sessionEventConnIds.size > 0) {
        broadcastToConnIds(
          "sessions.changed",
          {
            sessionKey,
            phase: lifecyclePhase,
            runId: evt.runId,
            ts: evt.ts,
            ...buildSessionEventSnapshot(sessionKey, evt),
          },
          sessionEventConnIds,
          { dropIfSlow: true },
        );
      }
    }
  };

  const scheduleTerminalLifecycleError = (
    evt: AgentEventPayload,
    opts?: { skipChatErrorFinal?: boolean },
  ) => {
    clearPendingTerminalLifecycleError(evt.runId);
    const timer = setSafeTimeout(() => {
      pendingTerminalLifecycleErrors.delete(evt.runId);
      finalizeLifecycleEvent(evt, opts);
    }, lifecycleErrorRetryGraceMs);
    timer.unref?.();
    pendingTerminalLifecycleErrors.set(evt.runId, timer);
  };

  const emitChatDelta = (
    sessionKey: string,
    clientRunId: string,
    sourceRunId: string,
    seq: number,
    text: string,
    delta?: unknown,
  ) => {
    const cleaned = normalizeLiveAssistantEventText({ text, delta });
    const previousRawText = chatRunState.rawBuffers.get(clientRunId) ?? "";
    const mergedRawText = resolveMergedAssistantText({
      previousText: previousRawText,
      nextText: cleaned.text,
      nextDelta: cleaned.delta,
    });
    if (!mergedRawText) {
      return;
    }
    const now = Date.now();
    chatRunState.rawBuffers.set(clientRunId, mergedRawText);
    chatRunState.bufferUpdatedAt.set(clientRunId, now);
    const projected = projectLiveAssistantBufferedText(mergedRawText);
    const mergedText = projected.text;
    chatRunState.buffers.set(clientRunId, mergedText);
    if (projected.suppress) {
      return;
    }
    if (shouldHideHeartbeatChatOutput(clientRunId, sourceRunId)) {
      return;
    }
    const last = chatRunState.deltaSentAt.get(clientRunId) ?? 0;
    if (now - last < 150) {
      return;
    }
    const broadcastDelta = resolveBroadcastDelta({
      text: mergedText,
      previousBroadcastText: chatRunState.deltaLastBroadcastText.get(clientRunId),
    });
    if (!broadcastDelta) {
      return;
    }
    chatRunState.deltaSentAt.set(clientRunId, now);
    chatRunState.deltaLastBroadcastLen.set(clientRunId, mergedText.length);
    chatRunState.deltaLastBroadcastText.set(clientRunId, mergedText);
    const payload = {
      runId: clientRunId,
      sessionKey,
      seq,
      state: "delta" as const,
      deltaText: broadcastDelta.deltaText,
      ...(broadcastDelta.replace ? { replace: true as const } : {}),
      message: {
        role: "assistant",
        content: [{ type: "text", text: mergedText }],
        timestamp: now,
      },
    };
    broadcast("chat", payload, { dropIfSlow: true });
    nodeSendToSession(sessionKey, "chat", payload);
  };

  const resolveBufferedChatTextState = (
    clientRunId: string,
    sourceRunId: string,
    options?: { suppressLeadFragments?: boolean },
  ) => {
    const bufferedText = normalizeLiveAssistantEventText({
      text: chatRunState.buffers.get(clientRunId) ?? "",
    }).text.trim();
    const normalizedHeartbeatText = normalizeHeartbeatChatFinalText({
      runId: clientRunId,
      sourceRunId,
      text: bufferedText,
    });
    const projected = projectLiveAssistantBufferedText(normalizedHeartbeatText.text.trim(), {
      suppressLeadFragments: options?.suppressLeadFragments,
    });
    return {
      text: projected.text.trim(),
      shouldSuppressSilent: normalizedHeartbeatText.suppress || projected.suppress,
    };
  };

  const flushBufferedChatDeltaIfNeeded = (
    sessionKey: string,
    clientRunId: string,
    sourceRunId: string,
    seq: number,
  ) => {
    const { text, shouldSuppressSilent } = resolveBufferedChatTextState(clientRunId, sourceRunId, {
      suppressLeadFragments: true,
    });
    const shouldSuppressHeartbeatStreaming = shouldHideHeartbeatChatOutput(
      clientRunId,
      sourceRunId,
    );
    if (!text || shouldSuppressSilent || shouldSuppressHeartbeatStreaming) {
      return;
    }

    const delta = resolveBroadcastDelta({
      text,
      previousBroadcastText: chatRunState.deltaLastBroadcastText.get(clientRunId),
    });
    if (!delta) {
      return;
    }

    const now = Date.now();
    const flushPayload = {
      runId: clientRunId,
      sessionKey,
      seq,
      state: "delta" as const,
      deltaText: delta.deltaText,
      ...(delta.replace ? { replace: true as const } : {}),
      message: {
        role: "assistant",
        content: [{ type: "text", text }],
        timestamp: now,
      },
    };
    broadcast("chat", flushPayload, { dropIfSlow: true });
    nodeSendToSession(sessionKey, "chat", flushPayload);
    chatRunState.deltaLastBroadcastLen.set(clientRunId, text.length);
    chatRunState.deltaLastBroadcastText.set(clientRunId, text);
    chatRunState.deltaSentAt.set(clientRunId, now);
  };

  const sendAgentPayload = (payload: AgentEventPayload & { spawnedBy?: string }) => {
    broadcast("agent", payload);
  };

  const flushBufferedAgentDeltaIfNeeded = (
    clientRunId: string,
    stream?: AgentTextThrottleStream,
  ) => {
    const keys = stream
      ? [agentTextThrottleKey(clientRunId, stream)]
      : agentTextThrottleKeys(clientRunId);
    const bufferedEntries = keys.flatMap((key) => {
      const buffered = chatRunState.bufferedAgentEvents.get(key);
      if (!buffered) {
        return [];
      }
      return [{ key, buffered }];
    });
    bufferedEntries.sort((a, b) => a.buffered.payload.seq - b.buffered.payload.seq);
    for (const { key, buffered } of bufferedEntries) {
      sendAgentPayload(buffered.payload);
      chatRunState.bufferedAgentEvents.delete(key);
      chatRunState.agentDeltaSentAt.set(key, Date.now());
    }
    return bufferedEntries.length > 0;
  };

  const resolveAgentTextThrottleStream = (
    evt: AgentEventPayload,
  ): AgentTextThrottleStream | null => {
    if (evt.stream === "assistant") {
      return "assistant";
    }
    if (evt.stream === "thinking") {
      return "thinking";
    }
    return null;
  };

  const isAgentTextThrottleEvent = (evt: AgentEventPayload) =>
    resolveAgentTextThrottleStream(evt) !== null && typeof evt.data?.text === "string";

  const shouldCoalesceAgentTextEvent = (evt: AgentEventPayload) =>
    isAgentTextThrottleEvent(evt) &&
    typeof evt.data.delta === "string" &&
    evt.data.delta.length > 0 &&
    !(Array.isArray(evt.data.mediaUrls) && evt.data.mediaUrls.length > 0) &&
    typeof evt.data.mediaUrl !== "string" &&
    evt.data.replace !== true &&
    (evt.stream !== "assistant" || !shouldSuppressAssistantEventForLiveChat(evt.data));

  const shouldAdvanceAgentTextThrottle = (evt: AgentEventPayload) =>
    isAgentTextThrottleEvent(evt) &&
    (typeof evt.data.delta === "string" || evt.data.replace === true);

  const buildBufferedAgentEvent = (
    sessionKey: string | undefined,
    payload: AgentEventPayload & { spawnedBy?: string },
  ): BufferedAgentEvent => (sessionKey ? { sessionKey, payload } : { payload });

  const mergeBufferedAgentPayload = (
    previous: BufferedAgentEvent,
    next: BufferedAgentEvent,
  ): BufferedAgentEvent => {
    if (previous.payload.stream !== next.payload.stream) {
      return next;
    }
    const previousDelta = previous.payload.data.delta;
    const nextDelta = next.payload.data.delta;
    if (typeof previousDelta !== "string" || typeof nextDelta !== "string") {
      return next;
    }
    return {
      ...next,
      payload: {
        ...next.payload,
        data: {
          ...next.payload.data,
          delta: `${previousDelta}${nextDelta}`,
        },
      },
    };
  };

  const sendOrBufferAgentTextEvent = (
    clientRunId: string,
    sessionKey: string | undefined,
    payload: AgentEventPayload & { spawnedBy?: string },
  ) => {
    const stream = resolveAgentTextThrottleStream(payload);
    if (!stream) {
      sendAgentPayload(payload);
      return;
    }
    const now = Date.now();
    const key = agentTextThrottleKey(clientRunId, stream);
    const last = chatRunState.agentDeltaSentAt.get(key);
    if (last !== undefined && now - last < 150) {
      const nextBuffered = buildBufferedAgentEvent(sessionKey, payload);
      const buffered = chatRunState.bufferedAgentEvents.get(key);
      chatRunState.bufferedAgentEvents.set(
        key,
        buffered ? mergeBufferedAgentPayload(buffered, nextBuffered) : nextBuffered,
      );
      return;
    }
    flushBufferedAgentDeltaIfNeeded(clientRunId);
    sendAgentPayload(payload);
    chatRunState.agentDeltaSentAt.set(key, now);
  };

  const emitChatFinal = (
    sessionKey: string,
    clientRunId: string,
    sourceRunId: string,
    seq: number,
    jobState: "done" | "error",
    error?: unknown,
    stopReason?: string,
    errorKind?: ErrorKind,
  ) => {
    const { text, shouldSuppressSilent } = resolveBufferedChatTextState(clientRunId, sourceRunId, {
      suppressLeadFragments: false,
    });
    // Flush any throttled delta so streaming clients receive the complete text
    // before the final event. The 150 ms throttle in emitChatDelta may have
    // suppressed the most recent chunk, leaving the client with stale text.
    // Only flush if the buffer has grown since the last broadcast to avoid duplicates.
    flushBufferedChatDeltaIfNeeded(sessionKey, clientRunId, sourceRunId, seq);
    chatRunState.clearRun(clientRunId);
    if (jobState === "done") {
      const payload = {
        runId: clientRunId,
        sessionKey,
        seq,
        state: "final" as const,
        ...(stopReason && { stopReason }),
        message:
          text && !shouldSuppressSilent
            ? {
                role: "assistant",
                content: [{ type: "text", text }],
                timestamp: Date.now(),
              }
            : undefined,
      };
      broadcast("chat", payload);
      nodeSendToSession(sessionKey, "chat", payload);
      return;
    }
    const payload = {
      runId: clientRunId,
      sessionKey,
      seq,
      state: "error" as const,
      errorMessage: error ? formatForLog(error) : undefined,
      ...(errorKind && { errorKind }),
    };
    broadcast("chat", payload);
    nodeSendToSession(sessionKey, "chat", payload);
  };

  const resolveToolVerboseLevel = (runId: string, sessionKey?: string) => {
    const runContext = getAgentRunContext(runId);
    const runVerbose = normalizeVerboseLevel(runContext?.verboseLevel);
    if (runVerbose) {
      return runVerbose;
    }
    if (!sessionKey) {
      return "off";
    }
    try {
      const { cfg, entry } = loadSessionEntry(sessionKey);
      const sessionVerbose = normalizeVerboseLevel(entry?.verboseLevel);
      if (sessionVerbose) {
        return sessionVerbose;
      }
      const defaultVerbose = normalizeVerboseLevel(cfg.agents?.defaults?.verboseDefault);
      return defaultVerbose ?? "off";
    } catch {
      return "off";
    }
  };

  return (evt: AgentEventPayload) => {
    const lifecyclePhase =
      evt.stream === "lifecycle" && typeof evt.data?.phase === "string" ? evt.data.phase : null;
    if (evt.stream !== "lifecycle" || lifecyclePhase !== "error") {
      clearPendingTerminalLifecycleError(evt.runId);
    }

    const chatLink = chatRunState.registry.peek(evt.runId);
    const eventSessionKey =
      typeof evt.sessionKey === "string" && evt.sessionKey.trim() ? evt.sessionKey : undefined;
    const isOperatorClientVisible = getAgentRunContext(evt.runId)?.isOperatorClientVisible ?? true;
    const sessionKey =
      chatLink?.sessionKey ?? eventSessionKey ?? resolveSessionKeyForRun(evt.runId);
    const clientRunId = chatLink?.clientRunId ?? evt.runId;
    const eventRunId = chatLink?.clientRunId ?? evt.runId;
    const eventForClients = chatLink ? { ...evt, runId: eventRunId } : evt;
    const isAborted =
      chatRunState.abortedRuns.has(clientRunId) || chatRunState.abortedRuns.has(evt.runId);
    // Include sessionKey so clients can filter tool streams per session.
    const agentPayload = sessionKey ? { ...eventForClients, sessionKey } : eventForClients;
    const last = agentRunSeq.get(evt.runId) ?? 0;
    const isToolEvent = evt.stream === "tool";
    const isItemEvent = evt.stream === "item";
    const toolVerbose = isToolEvent ? resolveToolVerboseLevel(evt.runId, sessionKey) : "off";
    // Build tool payload: strip result/partialResult unless verbose=full
    const toolPayload =
      isToolEvent && toolVerbose !== "full"
        ? (() => {
            const data = evt.data ? { ...evt.data } : {};
            delete data.result;
            delete data.partialResult;
            return sessionKey
              ? { ...eventForClients, sessionKey, data }
              : { ...eventForClients, data };
          })()
        : agentPayload;
    if (last > 0 && evt.seq !== last + 1) {
      broadcast("agent", {
        runId: eventRunId,
        stream: "error",
        ts: Date.now(),
        sessionKey,
        data: {
          reason: "seq gap",
          expected: last + 1,
          received: evt.seq,
        },
      });
    }
    agentRunSeq.set(evt.runId, evt.seq);
    if (isToolEvent) {
      const toolPhase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
      // Flush pending assistant text before tool-start events so clients can
      // render complete pre-tool text above tool cards (not truncated by delta throttle).
      if (toolPhase === "start" && isOperatorClientVisible && sessionKey && !isAborted) {
        flushBufferedChatDeltaIfNeeded(sessionKey, clientRunId, evt.runId, evt.seq);
        flushBufferedAgentDeltaIfNeeded(clientRunId);
      }
      // Always broadcast tool events to registered WS recipients with
      // tool-events capability, regardless of verboseLevel. The verbose
      // setting only controls whether tool details are sent as channel
      // messages to messaging surfaces (Telegram, Discord, etc.).
      const recipients = toolEventRecipients.get(evt.runId);
      if (recipients && recipients.size > 0) {
        broadcastToConnIds(
          "agent",
          sessionKey ? { ...toolPayload, ...buildSessionEventSnapshot(sessionKey) } : toolPayload,
          recipients,
        );
      }
      // Session subscribers power operator UIs that attach to an existing
      // in-flight session after the run has already started. Those clients do
      // not know the runId in advance, so they cannot register as run-scoped
      // tool recipients. Mirror tool lifecycle onto a session-scoped event so
      // they can render live pending tool cards without polling history.
      if (sessionKey) {
        const sessionSubscribers = sessionEventSubscribers.getAll();
        if (sessionSubscribers.size > 0) {
          broadcastToConnIds(
            "session.tool",
            { ...toolPayload, ...buildSessionEventSnapshot(sessionKey) },
            sessionSubscribers,
            { dropIfSlow: true },
          );
        }
      }
    } else {
      const itemPhase = isItemEvent && typeof evt.data?.phase === "string" ? evt.data.phase : "";
      if (itemPhase === "start" && isOperatorClientVisible && sessionKey && !isAborted) {
        flushBufferedChatDeltaIfNeeded(sessionKey, clientRunId, evt.runId, evt.seq);
        flushBufferedAgentDeltaIfNeeded(clientRunId);
      }
      if (shouldCoalesceAgentTextEvent(evt)) {
        sendOrBufferAgentTextEvent(clientRunId, sessionKey, agentPayload);
      } else {
        flushBufferedAgentDeltaIfNeeded(clientRunId);
        sendAgentPayload(agentPayload);
        const textThrottleStream = resolveAgentTextThrottleStream(evt);
        if (textThrottleStream && shouldAdvanceAgentTextThrottle(evt)) {
          chatRunState.agentDeltaSentAt.set(
            agentTextThrottleKey(clientRunId, textThrottleStream),
            Date.now(),
          );
        }
      }
    }

    if (isOperatorClientVisible && sessionKey) {
      // Send tool events to node/channel subscribers only when verbose is enabled;
      // WS clients already received the event above via broadcastToConnIds.
      if (!isToolEvent || toolVerbose !== "off") {
        nodeSendToSession(
          sessionKey,
          "agent",
          isToolEvent ? { ...toolPayload, ...buildSessionEventSnapshot(sessionKey) } : agentPayload,
        );
      }
      if (
        !isAborted &&
        evt.stream === "assistant" &&
        typeof evt.data?.text === "string" &&
        !shouldSuppressAssistantEventForLiveChat(evt.data)
      ) {
        emitChatDelta(sessionKey, clientRunId, evt.runId, evt.seq, evt.data.text, evt.data.delta);
      }
    }

    if (lifecyclePhase === "error") {
      clearBufferedChatState(clientRunId);
      const skipChatErrorFinal = isChatSendRunActive(evt.runId) && !chatLink;
      if (isAborted || lifecycleErrorRetryGraceMs <= 0) {
        finalizeLifecycleEvent(evt, { skipChatErrorFinal });
      } else {
        scheduleTerminalLifecycleError(evt, { skipChatErrorFinal });
      }
      return;
    }

    if (lifecyclePhase === "end") {
      finalizeLifecycleEvent(evt);
      return;
    }

    if (sessionKey && lifecyclePhase === "start") {
      void persistGatewaySessionLifecycleEvent({ sessionKey, event: evt }).catch(() => undefined);
      const sessionEventConnIds = sessionEventSubscribers.getAll();
      if (sessionEventConnIds.size > 0) {
        broadcastToConnIds(
          "sessions.changed",
          {
            sessionKey,
            phase: lifecyclePhase,
            runId: evt.runId,
            ts: evt.ts,
            ...buildSessionEventSnapshot(sessionKey, evt),
          },
          sessionEventConnIds,
          { dropIfSlow: true },
        );
      }
    }
  };
}
