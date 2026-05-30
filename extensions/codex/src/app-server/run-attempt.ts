import fs from "node:fs/promises";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import {
  assembleHarnessContextEngine,
  bootstrapHarnessContextEngine,
  buildHarnessContextEngineRuntimeContext,
  buildHarnessContextEngineRuntimeContextFromUsage,
  buildEmbeddedAttemptToolRunContext,
  clearActiveEmbeddedRun,
  embeddedAgentLog,
  emitAgentEvent as emitGlobalAgentEvent,
  finalizeHarnessContextEngineTurn,
  formatErrorMessage,
  isActiveHarnessContextEngine,
  isSubagentSessionKey,
  normalizeAgentRuntimeTools,
  resolveAttemptSpawnWorkspaceDir,
  resolveAgentHarnessBeforePromptBuildResult,
  resolveModelAuthMode,
  resolveKovaAgentDir,
  resolveSandboxContext,
  resolveSessionAgentIds,
  resolveUserPath,
  runAgentHarnessAgentEndHook,
  runAgentHarnessLlmInputHook,
  runAgentHarnessLlmOutputHook,
  runAgentCleanupStep,
  runHarnessContextEngineMaintenance,
  setActiveEmbeddedRun,
  supportsModelTools,
  type EmbeddedRunAttemptParams,
  type EmbeddedRunAttemptResult,
  type NativeHookRelayEvent,
  type NativeHookRelayRegistrationHandle,
} from "getkova/plugin-sdk/agent-harness-runtime";
import { handleCodexAppServerApprovalRequest } from "./approval-bridge.js";
import {
  buildCodexAppServerPromptTimeoutOutcome,
  collectTerminalAssistantText,
  resolveCodexAppServerReplayBlockedReason,
} from "./attempt-results.js";
import {
  CODEX_APP_SERVER_STARTUP_TIMEOUT_FLOOR_MS,
  resolveCodexStartupTimeoutMs,
  resolveCodexTurnAssistantCompletionIdleTimeoutMs,
  resolveCodexTurnCompletionIdleTimeoutMs,
  resolveCodexTurnTerminalIdleTimeoutMs,
  withCodexStartupTimeout,
} from "./attempt-timeouts.js";
import {
  createCodexAttemptTurnWatchController,
  type CodexAttemptTurnWatchTimeoutKind,
} from "./attempt-turn-watches.js";
import { refreshCodexAppServerAuthTokens } from "./auth-bridge.js";
import {
  createCodexAppServerClientFactoryTestHooks,
  defaultCodexAppServerClientFactory,
} from "./client-factory.js";
import { isCodexAppServerApprovalRequest, type CodexAppServerClient } from "./client.js";
import { ensureCodexComputerUse } from "./computer-use.js";
import {
  readCodexPluginConfig,
  resolveCodexAppServerRuntimeOptions,
  type CodexPluginConfig,
} from "./config.js";
import { projectContextEngineAssemblyForCodex } from "./context-engine-projection.js";
import { createCodexDynamicToolBridge } from "./dynamic-tools.js";
import { handleCodexAppServerElicitationRequest } from "./elicitation-bridge.js";
import { CodexAppServerEventProjector } from "./event-projector.js";
import {
  buildCodexNativeHookRelayDisabledConfig,
  buildCodexNativeHookRelayConfig,
  createCodexNativeHookRelay,
  resolveCodexNativeHookRelayEvents,
  scheduleCodexNativeHookRelayUnregister,
} from "./native-hook-relay.js";
import {
  assertCodexTurnStartResponse,
  readCodexDynamicToolCallParams,
} from "./protocol-validators.js";
import {
  isJsonObject,
  type CodexServerNotification,
  type CodexDynamicToolCallParams,
  type CodexTurnStartResponse,
  type JsonObject,
  type JsonValue,
} from "./protocol.js";
import { readCodexAppServerBinding, type CodexAppServerThreadBinding } from "./session-binding.js";
import { clearSharedCodexAppServerClient } from "./shared-client.js";
import {
  buildDeveloperInstructions,
  buildTurnStartParams,
  startOrResumeThread,
} from "./thread-lifecycle.js";
import {
  createCodexTrajectoryRecorder,
  normalizeCodexTrajectoryError,
  recordCodexTrajectoryCompletion,
  recordCodexTrajectoryContext,
} from "./trajectory.js";
import { mirrorCodexAppServerTranscript } from "./transcript-mirror.js";
import { createCodexUserInputBridge } from "./user-input-bridge.js";
import { filterToolsForVisionInputs } from "./vision-tools.js";

type KovaCodingToolsOptions = NonNullable<
  Parameters<(typeof import("getkova/plugin-sdk/agent-harness"))["createKovaCodingTools"]>[0]
>;
type KovaCodingToolsFactory =
  (typeof import("getkova/plugin-sdk/agent-harness"))["createKovaCodingTools"];
type KovaDynamicTool = ReturnType<KovaCodingToolsFactory>[number];

let clientFactory = defaultCodexAppServerClientFactory;

function emitCodexAppServerEvent(
  params: EmbeddedRunAttemptParams,
  event: Parameters<NonNullable<EmbeddedRunAttemptParams["onAgentEvent"]>>[0],
): void {
  try {
    emitGlobalAgentEvent({
      runId: params.runId,
      stream: event.stream,
      data: event.data,
      ...(params.sessionKey ? { sessionKey: params.sessionKey } : {}),
    });
  } catch (error) {
    embeddedAgentLog.debug("codex app-server global agent event emit failed", { error });
  }
  try {
    const maybePromise = params.onAgentEvent?.(event);
    void Promise.resolve(maybePromise).catch((error: unknown) => {
      embeddedAgentLog.debug("codex app-server agent event handler rejected", { error });
    });
  } catch (error) {
    // Event consumers are observational; they must not abort or strand the
    // canonical app-server turn lifecycle.
    embeddedAgentLog.debug("codex app-server agent event handler threw", { error });
  }
}

export async function runCodexAppServerAttempt(
  params: EmbeddedRunAttemptParams,
  options: {
    pluginConfig?: unknown;
    startupTimeoutFloorMs?: number;
    nativeHookRelay?: {
      enabled?: boolean;
      events?: readonly NativeHookRelayEvent[];
      ttlMs?: number;
      gatewayTimeoutMs?: number;
      hookTimeoutSec?: number;
    };
  } = {},
): Promise<EmbeddedRunAttemptResult> {
  const attemptStartedAt = Date.now();
  const appServer = resolveCodexAppServerRuntimeOptions({ pluginConfig: options.pluginConfig });
  const resolvedWorkspace = resolveUserPath(params.workspaceDir);
  await fs.mkdir(resolvedWorkspace, { recursive: true });
  const sandboxSessionKey = params.sessionKey?.trim() || params.sessionId;
  const sandbox = await resolveSandboxContext({
    config: params.config,
    sessionKey: sandboxSessionKey,
    workspaceDir: resolvedWorkspace,
  });
  const effectiveWorkspace = sandbox?.enabled
    ? sandbox.workspaceAccess === "rw"
      ? resolvedWorkspace
      : sandbox.workspaceDir
    : resolvedWorkspace;
  await fs.mkdir(effectiveWorkspace, { recursive: true });

  const runAbortController = new AbortController();
  const abortFromUpstream = () => {
    runAbortController.abort(params.abortSignal?.reason ?? "upstream_abort");
  };
  if (params.abortSignal?.aborted) {
    abortFromUpstream();
  } else {
    params.abortSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  }

  const { sessionAgentId } = resolveSessionAgentIds({
    sessionKey: params.sessionKey,
    config: params.config,
    agentId: params.agentId,
  });
  const agentDir = params.agentDir ?? resolveKovaAgentDir();
  const runtimeParams = { ...params, sessionKey: sandboxSessionKey };
  const activeContextEngine = isActiveHarnessContextEngine(params.contextEngine)
    ? params.contextEngine
    : undefined;
  let yieldDetected = false;
  const startupBinding = await readCodexAppServerBinding(params.sessionFile);
  const startupAuthProfileId =
    params.runtimePlan?.auth.forwardedAuthProfileId ??
    params.authProfileId ??
    startupBinding?.authProfileId;
  const tools = await buildDynamicTools({
    params,
    resolvedWorkspace,
    effectiveWorkspace,
    sandboxSessionKey,
    sandbox,
    runAbortController,
    sessionAgentId,
    pluginConfig: options.pluginConfig,
    onYieldDetected: () => {
      yieldDetected = true;
    },
  });
  const toolBridge = createCodexDynamicToolBridge({
    tools,
    signal: runAbortController.signal,
    hookContext: {
      agentId: sessionAgentId,
      sessionId: params.sessionId,
      sessionKey: sandboxSessionKey,
      runId: params.runId,
    },
  });
  const hadSessionFile = await fileExists(params.sessionFile);
  const sessionManager = SessionManager.open(params.sessionFile);
  let historyMessages =
    readMirroredSessionHistoryMessages(params.sessionFile, sessionManager) ?? [];
  const hookContext = {
    runId: params.runId,
    agentId: sessionAgentId,
    sessionKey: sandboxSessionKey,
    sessionId: params.sessionId,
    workspaceDir: params.workspaceDir,
    messageProvider: params.messageProvider ?? undefined,
    trigger: params.trigger,
    channelId: params.messageChannel ?? params.messageProvider ?? undefined,
  };
  if (activeContextEngine) {
    await bootstrapHarnessContextEngine({
      hadSessionFile,
      contextEngine: activeContextEngine,
      sessionId: params.sessionId,
      sessionKey: sandboxSessionKey,
      sessionFile: params.sessionFile,
      sessionManager,
      runtimeContext: buildHarnessContextEngineRuntimeContext({
        attempt: runtimeParams,
        workspaceDir: effectiveWorkspace,
        agentDir,
        tokenBudget: params.contextTokenBudget,
      }),
      runMaintenance: runHarnessContextEngineMaintenance,
      warn: (message) => embeddedAgentLog.warn(message),
    });
    historyMessages = readMirroredSessionHistoryMessages(params.sessionFile) ?? historyMessages;
  }
  const baseDeveloperInstructions = buildDeveloperInstructions(params, {
    dynamicTools: toolBridge.specs,
  });
  let promptText = params.prompt;
  let developerInstructions = baseDeveloperInstructions;
  let prePromptMessageCount = historyMessages.length;
  if (activeContextEngine) {
    try {
      const assembled = await assembleHarnessContextEngine({
        contextEngine: activeContextEngine,
        sessionId: params.sessionId,
        sessionKey: sandboxSessionKey,
        messages: historyMessages,
        tokenBudget: params.contextTokenBudget,
        availableTools: new Set(toolBridge.specs.map((tool) => tool.name).filter(isNonEmptyString)),
        citationsMode: params.config?.memory?.citations,
        modelId: params.modelId,
        prompt: params.prompt,
      });
      if (!assembled) {
        throw new Error("context engine assemble returned no result");
      }
      const projection = projectContextEngineAssemblyForCodex({
        assembledMessages: assembled.messages,
        originalHistoryMessages: historyMessages,
        prompt: params.prompt,
        systemPromptAddition: assembled.systemPromptAddition,
      });
      promptText = projection.promptText;
      developerInstructions = joinPresentSections(
        baseDeveloperInstructions,
        projection.developerInstructionAddition,
      );
      prePromptMessageCount = projection.prePromptMessageCount;
    } catch (assembleErr) {
      embeddedAgentLog.warn("context engine assemble failed; using Codex baseline prompt", {
        error: formatErrorMessage(assembleErr),
      });
    }
  }
  const promptBuild = await resolveAgentHarnessBeforePromptBuildResult({
    prompt: promptText,
    developerInstructions,
    messages: historyMessages,
    ctx: hookContext,
  });
  const trajectoryRecorder = createCodexTrajectoryRecorder({
    attempt: params,
    cwd: effectiveWorkspace,
    developerInstructions: promptBuild.developerInstructions,
    prompt: promptBuild.prompt,
    tools: toolBridge.specs,
  });
  let client: CodexAppServerClient;
  let thread: CodexAppServerThreadBinding;
  let trajectoryEndRecorded = false;
  let nativeHookRelay: NativeHookRelayRegistrationHandle | undefined;
  const startupTimeoutMs = resolveCodexStartupTimeoutMs({
    timeoutMs: params.timeoutMs,
    timeoutFloorMs: options.startupTimeoutFloorMs ?? CODEX_APP_SERVER_STARTUP_TIMEOUT_FLOOR_MS,
  });
  const nativeHookRelayEvents = resolveCodexNativeHookRelayEvents({
    configuredEvents: options.nativeHookRelay?.events,
    appServer,
  });
  try {
    emitCodexAppServerEvent(params, {
      stream: "codex_app_server.lifecycle",
      data: { phase: "startup" },
    });
    nativeHookRelay = createCodexNativeHookRelay({
      options: options.nativeHookRelay,
      events: nativeHookRelayEvents,
      agentId: sessionAgentId,
      sessionId: params.sessionId,
      sessionKey: sandboxSessionKey,
      config: params.config,
      runId: params.runId,
      attemptTimeoutMs: params.timeoutMs,
      startupTimeoutMs,
      turnStartTimeoutMs: params.timeoutMs,
      signal: runAbortController.signal,
    });
    const nativeHookRelayConfig = nativeHookRelay
      ? buildCodexNativeHookRelayConfig({
          relay: nativeHookRelay,
          events: nativeHookRelayEvents,
          hookTimeoutSec: options.nativeHookRelay?.hookTimeoutSec,
        })
      : options.nativeHookRelay?.enabled === false
        ? buildCodexNativeHookRelayDisabledConfig()
        : undefined;
    ({ client, thread } = await withCodexStartupTimeout({
      timeoutMs: startupTimeoutMs,
      signal: runAbortController.signal,
      operation: async () => {
        const startupClient = await clientFactory(appServer.start, startupAuthProfileId);
        await ensureCodexComputerUse({
          client: startupClient,
          pluginConfig: options.pluginConfig,
          timeoutMs: appServer.requestTimeoutMs,
          signal: runAbortController.signal,
        });
        const startupThread = await startOrResumeThread({
          client: startupClient,
          params,
          cwd: effectiveWorkspace,
          dynamicTools: toolBridge.specs,
          appServer,
          developerInstructions: promptBuild.developerInstructions,
          config: nativeHookRelayConfig,
          sandbox,
        });
        return { client: startupClient, thread: startupThread };
      },
    }));
    emitCodexAppServerEvent(params, {
      stream: "codex_app_server.lifecycle",
      data: { phase: "thread_ready", threadId: thread.threadId },
    });
  } catch (error) {
    nativeHookRelay?.unregister();
    clearSharedCodexAppServerClient();
    params.abortSignal?.removeEventListener("abort", abortFromUpstream);
    throw error;
  }
  trajectoryRecorder?.recordEvent("session.started", {
    sessionFile: params.sessionFile,
    threadId: thread.threadId,
    authProfileId: startupAuthProfileId,
    workspaceDir: effectiveWorkspace,
    toolCount: toolBridge.specs.length,
  });
  recordCodexTrajectoryContext(trajectoryRecorder, {
    attempt: params,
    cwd: effectiveWorkspace,
    developerInstructions: promptBuild.developerInstructions,
    prompt: promptBuild.prompt,
    tools: toolBridge.specs,
  });

  let projector: CodexAppServerEventProjector | undefined;
  let turnId: string | undefined;
  const pendingNotifications: CodexServerNotification[] = [];
  let userInputBridge: ReturnType<typeof createCodexUserInputBridge> | undefined;
  let completed = false;
  let timedOut = false;
  let turnCompletionIdleTimedOut = false;
  let turnWatchTimeoutKind: CodexAttemptTurnWatchTimeoutKind | undefined;
  let turnCompletionIdleTimeoutMessage: string | undefined;
  let terminalTurnNotificationQueued = false;
  let activeAppServerTurnRequests = 0;
  let clientClosedPromptError: string | undefined;
  let clientClosedAbort = false;
  let lifecycleStarted = false;
  let lifecycleTerminalEmitted = false;
  let resolveCompletion: (() => void) | undefined;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });
  let notificationQueue: Promise<void> = Promise.resolve();
  const turnCompletionIdleTimeoutMs = resolveCodexTurnCompletionIdleTimeoutMs(
    appServer.turnCompletionIdleTimeoutMs,
  );
  const turnAssistantCompletionIdleTimeoutMs = resolveCodexTurnAssistantCompletionIdleTimeoutMs(
    appServer.postToolRawAssistantCompletionIdleTimeoutMs,
  );
  const turnTerminalIdleTimeoutMs = resolveCodexTurnTerminalIdleTimeoutMs(undefined);
  const turnWatches = createCodexAttemptTurnWatchController({
    threadId: thread.threadId,
    signal: runAbortController.signal,
    getTurnId: () => turnId,
    isCompleted: () => completed,
    isTerminalTurnNotificationQueued: () => terminalTurnNotificationQueued,
    getActiveAppServerTurnRequests: () => activeAppServerTurnRequests,
    getActiveTurnItemCount: () => 0,
    turnCompletionIdleTimeoutMs,
    turnAssistantCompletionIdleTimeoutMs,
    turnAttemptIdleTimeoutMs: Math.max(100, Math.floor(params.timeoutMs)),
    turnTerminalIdleTimeoutMs,
    interruptTimeoutMs: appServer.requestTimeoutMs,
    onInterruptTurn: (input) => interruptCodexTurnBestEffort(client, input),
    onTimeout: (timeout) => {
      timedOut = true;
      turnCompletionIdleTimedOut = true;
      turnWatchTimeoutKind = timeout.kind;
      turnCompletionIdleTimeoutMessage =
        timeout.kind === "progress"
          ? "codex app-server turn idle timed out waiting for progress"
          : timeout.kind === "terminal"
            ? "codex app-server turn idle timed out waiting for terminal event"
            : "codex app-server turn idle timed out waiting for turn/completed";
    },
    onMarkTimedOut: () => projector?.markTimedOut(),
    onAbort: (reason) => runAbortController.abort(reason),
    onCompleted: () => {
      completed = true;
    },
    onResolveCompletion: () => resolveCompletion?.(),
    onRecordEvent: (name, fields) => trajectoryRecorder?.recordEvent(name, fields),
    onAttemptProgress: () => undefined,
    onProgressDiagnostic: () => undefined,
  });

  const emitLifecycleStart = () => {
    emitCodexAppServerEvent(params, {
      stream: "lifecycle",
      data: { phase: "start", startedAt: attemptStartedAt },
    });
    lifecycleStarted = true;
  };

  const emitLifecycleTerminal = (data: Record<string, unknown> & { phase: "end" | "error" }) => {
    if (!lifecycleStarted || lifecycleTerminalEmitted) {
      return;
    }
    emitCodexAppServerEvent(params, {
      stream: "lifecycle",
      data: {
        startedAt: attemptStartedAt,
        endedAt: Date.now(),
        ...data,
      },
    });
    lifecycleTerminalEmitted = true;
  };

  const handleNotification = async (notification: CodexServerNotification) => {
    turnWatches.noteNotificationReceived(notification.method);
    userInputBridge?.handleNotification(notification);
    if (!projector || !turnId) {
      pendingNotifications.push(notification);
      return;
    }
    // Determine terminal-turn status before invoking the projector so a throw
    // inside projector.handleNotification still releases the session lane.
    // See chiragborse1/KovaLab#67996.
    const isTurnCompletion =
      notification.method === "turn/completed" &&
      isTurnNotification(notification.params, thread.threadId, turnId);
    if (isTurnCompletion) {
      terminalTurnNotificationQueued = true;
    }
    try {
      if (!isTurnCompletion) {
        turnWatches.touchActivity(`notification:${notification.method}`, { arm: true });
      }
      await projector.handleNotification(notification);
    } catch (error) {
      embeddedAgentLog.debug("codex app-server projector notification threw", {
        method: notification.method,
        error,
      });
    } finally {
      if (isTurnCompletion) {
        completed = true;
        turnWatches.clearAllTimers();
        resolveCompletion?.();
      }
    }
  };
  const enqueueNotification = (notification: CodexServerNotification): Promise<void> => {
    notificationQueue = notificationQueue.then(
      () => handleNotification(notification),
      () => handleNotification(notification),
    );
    return notificationQueue;
  };

  let closeCleanup: (() => void) | undefined;
  const notificationCleanup = client.addNotificationHandler(enqueueNotification);
  const requestCleanup = client.addRequestHandler(async (request) => {
    if (request.method === "account/chatgptAuthTokens/refresh") {
      return refreshCodexAppServerAuthTokens({
        agentDir,
        authProfileId: startupAuthProfileId,
      });
    }
    if (!turnId) {
      return undefined;
    }
    activeAppServerTurnRequests += 1;
    turnWatches.clearCompletionIdleTimer();
    turnWatches.disarmAssistantCompletionIdleWatch();
    turnWatches.touchActivity(`request:${request.method}:start`, { attemptProgress: true });
    try {
      if (request.method === "mcpServer/elicitation/request") {
        return handleCodexAppServerElicitationRequest({
          requestParams: request.params,
          paramsForRun: params,
          threadId: thread.threadId,
          turnId,
          signal: runAbortController.signal,
        });
      }
      if (request.method === "item/tool/requestUserInput") {
        return userInputBridge?.handleRequest({
          id: request.id,
          params: request.params,
        });
      }
      if (request.method !== "item/tool/call") {
        if (isCodexAppServerApprovalRequest(request.method)) {
          return handleApprovalRequest({
            method: request.method,
            params: request.params,
            paramsForRun: params,
            threadId: thread.threadId,
            turnId,
            signal: runAbortController.signal,
          });
        }
        return undefined;
      }
      const call = readDynamicToolCallParams(request.params);
      if (!call || call.threadId !== thread.threadId || call.turnId !== turnId) {
        return undefined;
      }
      trajectoryRecorder?.recordEvent("tool.call", {
        threadId: call.threadId,
        turnId: call.turnId,
        toolCallId: call.callId,
        name: call.tool,
        arguments: call.arguments,
      });
      const response = await toolBridge.handleToolCall(call);
      trajectoryRecorder?.recordEvent("tool.result", {
        threadId: call.threadId,
        turnId: call.turnId,
        toolCallId: call.callId,
        name: call.tool,
        success: response.success,
        contentItems: response.contentItems,
      });
      return response as JsonValue;
    } finally {
      activeAppServerTurnRequests = Math.max(0, activeAppServerTurnRequests - 1);
      turnWatches.touchActivity(`request:${request.method}:response`, {
        arm: true,
        attemptProgress: true,
      });
      turnWatches.scheduleProgressWatches();
    }
  });

  const llmInputEvent = {
    runId: params.runId,
    sessionId: params.sessionId,
    provider: params.provider,
    model: params.modelId,
    systemPrompt: promptBuild.developerInstructions,
    prompt: promptBuild.prompt,
    historyMessages,
    imagesCount: params.images?.length ?? 0,
  };
  const turnStartFailureMessages = [
    ...historyMessages,
    {
      role: "user",
      content: [{ type: "text", text: promptBuild.prompt }],
    },
  ];

  let turn: CodexTurnStartResponse;
  try {
    runAgentHarnessLlmInputHook({
      event: llmInputEvent,
      ctx: hookContext,
    });
    emitCodexAppServerEvent(params, {
      stream: "codex_app_server.lifecycle",
      data: { phase: "turn_starting", threadId: thread.threadId },
    });
    turn = assertCodexTurnStartResponse(
      await client.request(
        "turn/start",
        buildTurnStartParams(params, {
          threadId: thread.threadId,
          cwd: effectiveWorkspace,
          appServer,
          promptText: promptBuild.prompt,
          sandbox,
        }),
        { timeoutMs: params.timeoutMs, signal: runAbortController.signal },
      ),
    );
  } catch (error) {
    emitCodexAppServerEvent(params, {
      stream: "codex_app_server.lifecycle",
      data: { phase: "turn_start_failed", error: formatErrorMessage(error) },
    });
    trajectoryRecorder?.recordEvent("session.ended", {
      status: "error",
      threadId: thread.threadId,
      timedOut,
      aborted: runAbortController.signal.aborted,
      promptError: normalizeCodexTrajectoryError(error),
    });
    trajectoryEndRecorded = true;
    runAgentHarnessLlmOutputHook({
      event: {
        runId: params.runId,
        sessionId: params.sessionId,
        provider: params.provider,
        model: params.modelId,
        resolvedRef:
          params.runtimePlan?.observability.resolvedRef ?? `${params.provider}/${params.modelId}`,
        ...(params.runtimePlan?.observability.harnessId
          ? { harnessId: params.runtimePlan.observability.harnessId }
          : {}),
        assistantTexts: [],
      },
      ctx: hookContext,
    });
    runAgentHarnessAgentEndHook({
      event: {
        messages: turnStartFailureMessages,
        success: false,
        error: formatErrorMessage(error),
        durationMs: Date.now() - attemptStartedAt,
      },
      ctx: hookContext,
    });
    notificationCleanup();
    requestCleanup();
    nativeHookRelay?.unregister();
    await runAgentCleanupStep({
      runId: params.runId,
      sessionId: params.sessionId,
      step: "codex-trajectory-flush-startup-failure",
      log: embeddedAgentLog,
      getTimeoutDetails: () => trajectoryRecorder?.describeFlushState(),
      cleanup: async () => {
        await trajectoryRecorder?.flush();
      },
    });
    params.abortSignal?.removeEventListener("abort", abortFromUpstream);
    throw error;
  }
  turnId = turn.turn.id;
  const activeTurnId = turn.turn.id;
  userInputBridge = createCodexUserInputBridge({
    paramsForRun: params,
    threadId: thread.threadId,
    turnId: activeTurnId,
    signal: runAbortController.signal,
  });
  trajectoryRecorder?.recordEvent("prompt.submitted", {
    threadId: thread.threadId,
    turnId: activeTurnId,
    prompt: promptBuild.prompt,
    imagesCount: params.images?.length ?? 0,
  });
  projector = new CodexAppServerEventProjector(params, thread.threadId, activeTurnId);
  closeCleanup = (
    client as {
      addCloseHandler?: (handler: (client: CodexAppServerClient) => void) => () => void;
    }
  ).addCloseHandler?.(() => {
    if (completed || terminalTurnNotificationQueued || runAbortController.signal.aborted) {
      return;
    }
    clientClosedPromptError = "codex app-server client closed before turn completed";
    trajectoryRecorder?.recordEvent("turn.client_closed", {
      threadId: thread.threadId,
      turnId: activeTurnId,
    });
    embeddedAgentLog.warn("codex app-server client closed before turn completed", {
      threadId: thread.threadId,
      turnId: activeTurnId,
    });
    clientClosedAbort = true;
    runAbortController.abort("client_closed");
    completed = true;
    turnWatches.clearAllTimers();
    resolveCompletion?.();
  });
  emitLifecycleStart();
  const activeProjector = projector;
  turnWatches.armAttemptIdleWatch();
  turnWatches.armTerminalIdleWatch();
  turnWatches.touchActivity("turn:start", { arm: true, attemptProgress: true });
  for (const notification of pendingNotifications.splice(0)) {
    await enqueueNotification(notification);
  }
  if (!completed && isTerminalTurnStatus(turn.turn.status)) {
    terminalTurnNotificationQueued = true;
    await enqueueNotification({
      method: "turn/completed",
      params: {
        threadId: thread.threadId,
        turnId: activeTurnId,
        turn: turn.turn as unknown as JsonObject,
      },
    });
  }

  const handle = {
    kind: "embedded" as const,
    queueMessage: async (text: string) => {
      if (userInputBridge?.handleQueuedMessage(text)) {
        return;
      }
      await client.request("turn/steer", {
        threadId: thread.threadId,
        expectedTurnId: activeTurnId,
        input: [{ type: "text", text, text_elements: [] }],
      });
    },
    isStreaming: () => !completed,
    isCompacting: () => projector?.isCompacting() ?? false,
    cancel: () => runAbortController.abort("cancelled"),
    abort: () => runAbortController.abort("aborted"),
  };
  setActiveEmbeddedRun(params.sessionId, handle, params.sessionKey);

  const timeout = setTimeout(
    () => {
      timedOut = true;
      projector?.markTimedOut();
      runAbortController.abort("timeout");
    },
    Math.max(100, params.timeoutMs),
  );

  const abortListener = () => {
    interruptCodexTurnBestEffort(client, {
      threadId: thread.threadId,
      turnId: activeTurnId,
    });
    resolveCompletion?.();
  };
  runAbortController.signal.addEventListener("abort", abortListener, { once: true });
  if (runAbortController.signal.aborted) {
    abortListener();
  }

  try {
    await completion;
    const result = activeProjector.buildResult(toolBridge.telemetry, { yieldDetected });
    const finalAborted =
      result.aborted || (runAbortController.signal.aborted && !clientClosedAbort);
    const finalPromptError =
      clientClosedPromptError ??
      (turnCompletionIdleTimedOut
        ? (turnCompletionIdleTimeoutMessage ??
          "codex app-server turn idle timed out waiting for turn/completed")
        : timedOut
          ? "codex app-server attempt timed out"
          : result.promptError);
    const finalPromptErrorSource =
      timedOut || clientClosedPromptError || turnCompletionIdleTimedOut
        ? "prompt"
        : result.promptErrorSource;
    const codexAppServerFailureKind = clientClosedPromptError
      ? "client_closed_before_turn_completed"
      : turnCompletionIdleTimedOut
        ? "turn_completion_idle_timeout"
        : undefined;
    const codexAppServerReplayBlockedReason = codexAppServerFailureKind
      ? resolveCodexAppServerReplayBlockedReason(result)
      : undefined;
    const promptTimeoutOutcome = buildCodexAppServerPromptTimeoutOutcome({
      result,
      turnCompletionIdleTimedOut,
    });
    recordCodexTrajectoryCompletion(trajectoryRecorder, {
      attempt: params,
      result,
      threadId: thread.threadId,
      turnId: activeTurnId,
      timedOut,
      yieldDetected,
    });
    trajectoryRecorder?.recordEvent("session.ended", {
      status: finalPromptError ? "error" : finalAborted || timedOut ? "interrupted" : "success",
      threadId: thread.threadId,
      turnId: activeTurnId,
      timedOut,
      yieldDetected,
      promptError: normalizeCodexTrajectoryError(finalPromptError),
    });
    trajectoryEndRecorded = true;
    await mirrorTranscriptBestEffort({
      params,
      agentId: sessionAgentId,
      result,
      sessionKey: sandboxSessionKey,
      threadId: thread.threadId,
      turnId: activeTurnId,
    });
    const terminalAssistantText = collectTerminalAssistantText(result);
    if (terminalAssistantText && !finalAborted && !finalPromptError) {
      emitCodexAppServerEvent(params, {
        stream: "assistant",
        data: { text: terminalAssistantText },
      });
    }
    if (finalPromptError) {
      emitLifecycleTerminal({
        phase: "error",
        error: formatErrorMessage(finalPromptError),
      });
    } else {
      emitLifecycleTerminal({
        phase: "end",
        ...(finalAborted ? { aborted: true } : {}),
      });
    }
    if (activeContextEngine) {
      const finalMessages =
        readMirroredSessionHistoryMessages(params.sessionFile) ??
        historyMessages.concat(result.messagesSnapshot);
      await finalizeHarnessContextEngineTurn({
        contextEngine: activeContextEngine,
        promptError: Boolean(finalPromptError),
        aborted: finalAborted,
        yieldAborted: Boolean(result.yieldDetected),
        sessionIdUsed: params.sessionId,
        sessionKey: sandboxSessionKey,
        sessionFile: params.sessionFile,
        messagesSnapshot: finalMessages,
        prePromptMessageCount,
        tokenBudget: params.contextTokenBudget,
        runtimeContext: buildHarnessContextEngineRuntimeContextFromUsage({
          attempt: runtimeParams,
          workspaceDir: effectiveWorkspace,
          agentDir,
          tokenBudget: params.contextTokenBudget,
          lastCallUsage: result.attemptUsage,
          promptCache: result.promptCache,
        }),
        runMaintenance: runHarnessContextEngineMaintenance,
        sessionManager,
        warn: (message) => embeddedAgentLog.warn(message),
      });
    }
    runAgentHarnessLlmOutputHook({
      event: {
        runId: params.runId,
        sessionId: params.sessionId,
        provider: params.provider,
        model: params.modelId,
        resolvedRef:
          params.runtimePlan?.observability.resolvedRef ?? `${params.provider}/${params.modelId}`,
        ...(params.runtimePlan?.observability.harnessId
          ? { harnessId: params.runtimePlan.observability.harnessId }
          : {}),
        assistantTexts: result.assistantTexts,
        ...(result.lastAssistant ? { lastAssistant: result.lastAssistant } : {}),
        ...(result.attemptUsage ? { usage: result.attemptUsage } : {}),
      },
      ctx: hookContext,
    });
    runAgentHarnessAgentEndHook({
      event: {
        messages: result.messagesSnapshot,
        success: !finalAborted && !finalPromptError,
        ...(finalPromptError ? { error: formatErrorMessage(finalPromptError) } : {}),
        durationMs: Date.now() - attemptStartedAt,
      },
      ctx: hookContext,
    });
    return {
      ...result,
      timedOut,
      aborted: finalAborted,
      promptError: finalPromptError,
      promptErrorSource: finalPromptErrorSource,
      ...(codexAppServerFailureKind
        ? {
            codexAppServerFailure: {
              kind: codexAppServerFailureKind,
              ...(codexAppServerFailureKind === "turn_completion_idle_timeout" &&
              turnWatchTimeoutKind
                ? { turnWatchTimeoutKind }
                : {}),
              transport: appServer.start.transport,
              threadId: thread.threadId,
              turnId: activeTurnId,
              replaySafe: codexAppServerReplayBlockedReason === undefined,
              ...(codexAppServerReplayBlockedReason
                ? { replayBlockedReason: codexAppServerReplayBlockedReason }
                : {}),
            },
          }
        : {}),
      ...(promptTimeoutOutcome ? { promptTimeoutOutcome } : {}),
    };
  } finally {
    emitLifecycleTerminal({
      phase: "error",
      error: "codex app-server run completed without lifecycle terminal event",
    });
    if (trajectoryRecorder && !trajectoryEndRecorded) {
      trajectoryRecorder.recordEvent("session.ended", {
        status: timedOut || runAbortController.signal.aborted ? "interrupted" : "cleanup",
        threadId: thread.threadId,
        turnId: activeTurnId,
        timedOut,
        aborted: runAbortController.signal.aborted,
      });
    }
    await runAgentCleanupStep({
      runId: params.runId,
      sessionId: params.sessionId,
      step: "codex-trajectory-flush",
      log: embeddedAgentLog,
      getTimeoutDetails: () => trajectoryRecorder?.describeFlushState(),
      cleanup: async () => {
        await trajectoryRecorder?.flush();
      },
    });
    userInputBridge?.cancelPending();
    clearTimeout(timeout);
    turnWatches.clearAllTimers();
    closeCleanup?.();
    notificationCleanup();
    requestCleanup();
    if (nativeHookRelay && !timedOut && !runAbortController.signal.aborted) {
      scheduleCodexNativeHookRelayUnregister({
        relay: nativeHookRelay,
        hookTimeoutSec: options.nativeHookRelay?.hookTimeoutSec,
      });
    } else {
      nativeHookRelay?.unregister();
    }
    runAbortController.signal.removeEventListener("abort", abortListener);
    params.abortSignal?.removeEventListener("abort", abortFromUpstream);
    clearActiveEmbeddedRun(params.sessionId, handle, params.sessionKey);
  }
}

function interruptCodexTurnBestEffort(
  client: CodexAppServerClient,
  params: {
    threadId: string;
    turnId: string;
  },
): void {
  void Promise.resolve()
    .then(() => client.request("turn/interrupt", params))
    .catch((error: unknown) => {
      embeddedAgentLog.debug("codex app-server turn interrupt failed during abort", { error });
    });
}

type DynamicToolBuildParams = {
  params: EmbeddedRunAttemptParams;
  resolvedWorkspace: string;
  effectiveWorkspace: string;
  sandboxSessionKey: string;
  sandbox: Awaited<ReturnType<typeof resolveSandboxContext>>;
  runAbortController: AbortController;
  sessionAgentId: string | undefined;
  pluginConfig?: unknown;
  onYieldDetected: () => void;
};

async function buildDynamicTools(input: DynamicToolBuildParams) {
  const { params } = input;
  if (params.disableTools || !supportsModelTools(params.model)) {
    return [];
  }
  const modelHasVision = params.model.input?.includes("image") ?? false;
  const agentDir = params.agentDir ?? resolveKovaAgentDir();
  const { createKovaCodingTools } = await import("getkova/plugin-sdk/agent-harness");
  const allTools = createKovaCodingTools({
    agentId: input.sessionAgentId,
    ...buildEmbeddedAttemptToolRunContext(params),
    exec: {
      ...params.execOverrides,
      elevated: params.bashElevated,
    },
    sandbox: input.sandbox,
    messageProvider: params.messageChannel ?? params.messageProvider,
    agentAccountId: params.agentAccountId,
    messageTo: params.messageTo,
    messageThreadId: params.messageThreadId,
    groupId: params.groupId,
    groupChannel: params.groupChannel,
    groupSpace: params.groupSpace,
    spawnedBy: params.spawnedBy,
    senderId: params.senderId,
    senderName: params.senderName,
    senderUsername: params.senderUsername,
    senderE164: params.senderE164,
    senderIsOwner: params.senderIsOwner,
    allowGatewaySubagentBinding: params.allowGatewaySubagentBinding,
    sessionKey: input.sandboxSessionKey,
    sessionId: params.sessionId,
    runId: params.runId,
    agentDir,
    workspaceDir: input.effectiveWorkspace,
    spawnWorkspaceDir: resolveAttemptSpawnWorkspaceDir({
      sandbox: input.sandbox,
      resolvedWorkspace: input.resolvedWorkspace,
    }),
    config: params.config,
    authProfileStore: params.toolAuthProfileStore,
    abortSignal: input.runAbortController.signal,
    modelProvider: params.model.provider,
    modelId: params.modelId,
    modelCompat:
      params.model.compat && typeof params.model.compat === "object"
        ? (params.model.compat as KovaCodingToolsOptions["modelCompat"])
        : undefined,
    modelApi: params.model.api,
    modelContextWindowTokens: params.model.contextWindow,
    modelAuthMode: resolveModelAuthMode(params.model.provider, params.config),
    currentChannelId: params.currentChannelId,
    currentThreadTs: params.currentThreadTs,
    currentMessageId: params.currentMessageId,
    replyToMode: params.replyToMode,
    hasRepliedRef: params.hasRepliedRef,
    modelHasVision,
    requireExplicitMessageTarget:
      params.requireExplicitMessageTarget ?? isSubagentSessionKey(params.sessionKey),
    disableMessageTool: params.disableMessageTool,
    onYield: (message) => {
      input.onYieldDetected();
      emitCodexAppServerEvent(params, {
        stream: "codex_app_server.tool",
        data: { name: "sessions_yield", message },
      });
      input.runAbortController.abort("sessions_yield");
    },
  });
  const codexFilteredTools = addSandboxShellDynamicToolsIfAvailable(allTools, allTools, input);
  const visionFilteredTools = filterToolsForVisionInputs(codexFilteredTools, {
    modelHasVision,
    hasInboundImages: (params.images?.length ?? 0) > 0,
  });
  const filteredTools = filterCodexDynamicToolsForAllowlist(visionFilteredTools, params.toolsAllow);
  return normalizeAgentRuntimeTools({
    runtimePlan: params.runtimePlan,
    tools: filteredTools,
    provider: params.provider,
    config: params.config,
    workspaceDir: input.effectiveWorkspace,
    env: process.env,
    modelId: params.modelId,
    modelApi: params.model.api,
    model: params.model,
  });
}

function addSandboxShellDynamicToolsIfAvailable(
  filteredTools: KovaDynamicTool[],
  allTools: KovaDynamicTool[],
  input: DynamicToolBuildParams,
): KovaDynamicTool[] {
  const pluginConfig = readCodexPluginConfig(input.pluginConfig);
  if (
    !shouldExposeSandboxExecDynamicTool(input) ||
    isSandboxShellDynamicToolExcluded(pluginConfig)
  ) {
    return filteredTools;
  }
  const execTool = allTools.find((tool) => normalizeCodexDynamicToolName(tool.name) === "exec");
  const processTool = allTools.find(
    (tool) => normalizeCodexDynamicToolName(tool.name) === "process",
  );
  if (!execTool || !processTool) {
    return filteredTools;
  }
  const sandboxExecTool: KovaDynamicTool = {
    ...execTool,
    name: "sandbox_exec",
    description:
      "Run a shell command through Kova's configured sandbox backend for this session. Use only when the command must execute in the Kova sandbox backend, such as an SSH-backed sandbox. Use Codex's native shell for normal local workspace commands.",
    execute: async (toolCallId, args, signal, onUpdate) => {
      const result = await execTool.execute(toolCallId, args, signal, onUpdate);
      return {
        ...result,
        content: result.content.map((item) =>
          item.type === "text"
            ? Object.assign({}, item, {
                text: item.text.replace(
                  "Use process (list/poll/log/write/send-keys/submit/paste/kill/clear/remove) for follow-up.",
                  "Use sandbox_process (list/poll/log/write/send-keys/submit/paste/kill/clear/remove) for follow-up.",
                ),
              })
            : item,
        ),
      };
    },
  };
  const sandboxProcessTool: KovaDynamicTool = {
    ...processTool,
    name: "sandbox_process",
    description:
      "Manage sandbox_exec sessions that were started through Kova's configured sandbox backend for this session: list, poll, log, write, send-keys, submit, paste, kill, clear, or remove. Use only for sandbox_exec follow-up; use Codex's native shell session handling for normal native shell commands.",
  };
  return [...filteredTools, sandboxExecTool, sandboxProcessTool];
}

function shouldExposeSandboxExecDynamicTool(input: DynamicToolBuildParams): boolean {
  const backendId = input.sandbox?.enabled ? input.sandbox.backendId.trim().toLowerCase() : "";
  return Boolean(backendId && backendId !== "docker");
}

function isSandboxShellDynamicToolExcluded(config: CodexPluginConfig): boolean {
  return (config.codexDynamicToolsExclude ?? []).some((name) => {
    const normalized = normalizeCodexDynamicToolName(name);
    return (
      normalized === "exec" ||
      normalized === "sandbox_exec" ||
      normalized === "process" ||
      normalized === "sandbox_process"
    );
  });
}

function filterCodexDynamicToolsForAllowlist<T extends { name: string }>(
  tools: T[],
  toolsAllow?: string[],
): T[] {
  if (!toolsAllow) {
    return tools;
  }
  if (toolsAllow.length === 0) {
    return [];
  }
  if (hasWildcardCodexToolsAllow(toolsAllow)) {
    return tools;
  }
  const allowSet = new Set(
    toolsAllow.map((name) => normalizeCodexDynamicToolName(name)).filter(Boolean),
  );
  return tools.filter((tool) => {
    const normalized = normalizeCodexDynamicToolName(tool.name);
    return (
      allowSet.has(normalized) ||
      (normalized === "sandbox_exec" && allowSet.has("exec")) ||
      (normalized === "sandbox_process" && (allowSet.has("exec") || allowSet.has("process")))
    );
  });
}

function hasWildcardCodexToolsAllow(toolsAllow: string[]): boolean {
  return toolsAllow.some((name) => normalizeCodexDynamicToolName(name) === "*");
}

function normalizeCodexDynamicToolName(name: string): string {
  const normalized = name.trim().toLowerCase().replaceAll("-", "_");
  return normalized === "bash" ? "exec" : normalized;
}

function readDynamicToolCallParams(
  value: JsonValue | undefined,
): CodexDynamicToolCallParams | undefined {
  return readCodexDynamicToolCallParams(value);
}

function isTurnNotification(
  value: JsonValue | undefined,
  threadId: string,
  turnId: string,
): boolean {
  if (!isJsonObject(value)) {
    return false;
  }
  return readString(value, "threadId") === threadId && readNotificationTurnId(value) === turnId;
}

function isTerminalTurnStatus(status: string | undefined): boolean {
  return status === "completed" || status === "interrupted" || status === "failed";
}

function readNotificationTurnId(record: JsonObject): string | undefined {
  return readString(record, "turnId") ?? readNestedTurnId(record);
}

function readNestedTurnId(record: JsonObject): string | undefined {
  const turn = record.turn;
  return isJsonObject(turn) ? readString(turn, "id") : undefined;
}

function readString(record: JsonObject, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readMirroredSessionHistoryMessages(
  sessionFile: string,
  sessionManager?: SessionManager,
): AgentMessage[] | undefined {
  try {
    return (sessionManager ?? SessionManager.open(sessionFile)).buildSessionContext().messages;
  } catch (error) {
    embeddedAgentLog.warn("failed to read mirrored session history for codex harness hooks", {
      error,
      sessionFile,
    });
    return undefined;
  }
}

async function mirrorTranscriptBestEffort(params: {
  params: EmbeddedRunAttemptParams;
  agentId?: string;
  result: EmbeddedRunAttemptResult;
  sessionKey?: string;
  threadId: string;
  turnId: string;
}): Promise<void> {
  try {
    await mirrorCodexAppServerTranscript({
      sessionFile: params.params.sessionFile,
      agentId: params.agentId,
      sessionKey: params.sessionKey,
      messages: params.result.messagesSnapshot,
      idempotencyScope: `codex-app-server:${params.threadId}:${params.turnId}`,
    });
  } catch (error) {
    embeddedAgentLog.warn("failed to mirror codex app-server transcript", { error });
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function joinPresentSections(...sections: Array<string | undefined>): string {
  return sections.filter((section): section is string => Boolean(section?.trim())).join("\n\n");
}

function handleApprovalRequest(params: {
  method: string;
  params: JsonValue | undefined;
  paramsForRun: EmbeddedRunAttemptParams;
  threadId: string;
  turnId: string;
  signal?: AbortSignal;
}): Promise<JsonValue | undefined> {
  return handleCodexAppServerApprovalRequest({
    method: params.method,
    requestParams: params.params,
    paramsForRun: params.paramsForRun,
    threadId: params.threadId,
    turnId: params.turnId,
    signal: params.signal,
  });
}

export const __testing = {
  filterToolsForVisionInputs,
  buildDynamicTools,
  addSandboxShellDynamicToolsIfAvailable,
  filterCodexDynamicToolsForAllowlist,
  ...createCodexAppServerClientFactoryTestHooks((factory) => {
    clientFactory = factory;
  }),
} as const;
