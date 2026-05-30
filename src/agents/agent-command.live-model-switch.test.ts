import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_RUNTIME_CONTEXT_BEGIN, INTERNAL_RUNTIME_CONTEXT_END } from "./internal-events.js";
import { LiveSessionModelSwitchError } from "./live-model-switch-error.js";

const state = vi.hoisted(() => ({
  acpResolveSessionMock: vi.fn((..._args: unknown[]): unknown => null),
  acpRunTurnMock: vi.fn((..._args: unknown[]): unknown => undefined),
  buildAcpResultMock: vi.fn(),
  createAcpVisibleTextAccumulatorMock: vi.fn(),
  persistCliTurnTranscriptMock: vi.fn(),
  persistAcpTurnTranscriptMock: vi.fn(),
  runCliTurnCompactionLifecycleMock: vi.fn(),
  runWithModelFallbackMock: vi.fn(),
  runAgentAttemptMock: vi.fn(),
  resolveEffectiveModelFallbacksMock: vi.fn().mockReturnValue(undefined),
  emitAgentEventMock: vi.fn(),
  registerAgentRunContextMock: vi.fn(),
  clearAgentRunContextMock: vi.fn(),
  updateSessionStoreAfterAgentRunMock: vi.fn(),
  deliverAgentCommandResultMock: vi.fn(),
  clearSessionAuthProfileOverrideMock: vi.fn(),
  authProfileStoreMock: { profiles: {} } as { profiles: Record<string, unknown> },
  sessionEntryMock: undefined as unknown,
  sessionStoreMock: undefined as unknown,
}));

vi.mock("./model-fallback.js", () => ({
  runWithModelFallback: (params: unknown) => state.runWithModelFallbackMock(params),
}));

vi.mock("./command/attempt-execution.runtime.js", () => ({
  buildAcpResult: (...args: unknown[]) => state.buildAcpResultMock(...args),
  createAcpVisibleTextAccumulator: () => state.createAcpVisibleTextAccumulatorMock(),
  emitAcpAssistantDelta: vi.fn(),
  emitAcpLifecycleEnd: vi.fn(),
  emitAcpLifecycleError: vi.fn(),
  emitAcpLifecycleStart: vi.fn(),
  persistCliTurnTranscript: (...args: unknown[]) => state.persistCliTurnTranscriptMock(...args),
  persistAcpTurnTranscript: (...args: unknown[]) => state.persistAcpTurnTranscriptMock(...args),
  persistSessionEntry: vi.fn(),
  prependInternalEventContext: (_body: string) => _body,
  runAgentAttempt: (...args: unknown[]) => state.runAgentAttemptMock(...args),
  sessionFileHasContent: vi.fn(async () => false),
}));

vi.mock("./command/delivery.runtime.js", () => ({
  deliverAgentCommandResult: (...args: unknown[]) => state.deliverAgentCommandResultMock(...args),
}));

vi.mock("./command/cli-compaction.js", () => ({
  runCliTurnCompactionLifecycle: (...args: unknown[]) =>
    state.runCliTurnCompactionLifecycleMock(...args),
}));

vi.mock("./command/run-context.js", () => ({
  resolveAgentRunContext: () => ({
    messageChannel: "test",
    accountId: "acct",
    groupId: undefined,
    groupChannel: undefined,
    groupSpace: undefined,
    currentChannelId: undefined,
    currentThreadTs: undefined,
    replyToMode: undefined,
    hasRepliedRef: { current: false },
  }),
}));

vi.mock("./command/session-store.runtime.js", () => ({
  updateSessionStoreAfterAgentRun: (...args: unknown[]) =>
    state.updateSessionStoreAfterAgentRunMock(...args),
}));

vi.mock("./command/session.js", () => ({
  resolveSession: () => ({
    sessionId: "session-1",
    sessionKey: "agent:main",
    sessionEntry: state.sessionEntryMock ?? {
      sessionId: "session-1",
      updatedAt: Date.now(),
      skillsSnapshot: { prompt: "", skills: [], version: 0 },
    },
    sessionStore: state.sessionStoreMock,
    storePath: undefined,
    isNewSession: false,
    persistedThinking: undefined,
    persistedVerbose: undefined,
  }),
}));

vi.mock("./command/types.js", () => ({}));

vi.mock("../acp/policy.js", () => ({
  resolveAcpAgentPolicyError: () => null,
  resolveAcpDispatchPolicyError: () => null,
}));

vi.mock("../acp/runtime/errors.js", () => ({
  toAcpRuntimeError: vi.fn(),
}));

vi.mock("../acp/runtime/session-identifiers.js", () => ({
  resolveAcpSessionCwd: () => "/tmp",
}));

vi.mock("../auto-reply/thinking.js", () => ({
  formatThinkingLevels: () => "low, medium, high",
  formatXHighModelHint: () => "model-x",
  normalizeThinkLevel: (v?: string) => v || undefined,
  normalizeVerboseLevel: (v?: string) => v || undefined,
  isThinkingLevelSupported: () => true,
  resolveSupportedThinkingLevel: ({ level }: { level?: string }) => level,
  supportsXHighThinking: () => false,
}));

vi.mock("../cli/command-format.js", () => ({
  formatCliCommand: (cmd: string) => cmd,
}));

vi.mock("../cli/command-secret-gateway.js", () => ({
  resolveCommandSecretRefsViaGateway: async (params: { config: unknown }) => ({
    resolvedConfig: params.config,
    diagnostics: [],
  }),
}));

vi.mock("../cli/command-secret-targets.js", () => ({
  getAgentRuntimeCommandSecretTargetIds: () => [],
}));

vi.mock("../cli/deps.js", () => ({
  createDefaultDeps: () => ({}),
}));

vi.mock("../config/io.js", () => ({
  getRuntimeConfig: () => ({
    agents: {
      defaults: {
        models: {
          "anthropic/claude": {},
          "openai/claude": {},
          "openai/gpt-5.4": {},
        },
      },
    },
  }),
  readConfigFileSnapshotForWrite: async () => ({
    snapshot: { valid: false },
  }),
}));

vi.mock("./agent-runtime-config.js", () => {
  const cfg = {
    agents: {
      defaults: {
        models: {
          "anthropic/claude": {},
          "openai/claude": {},
          "openai/gpt-5.4": {},
        },
      },
    },
  };
  return {
    resolveAgentRuntimeConfig: async () => ({
      loadedRaw: cfg,
      sourceConfig: cfg,
      cfg,
    }),
  };
});

vi.mock("../config/runtime-snapshot.js", () => ({
  setRuntimeConfigSnapshot: vi.fn(),
}));

vi.mock("../config/sessions.js", () => ({
  resolveAgentIdFromSessionKey: () => "default",
  mergeSessionEntry: (a: unknown, b: unknown) => ({ ...(a as object), ...(b as object) }),
  updateSessionStore: vi.fn(
    async (_path: string, fn: (store: Record<string, unknown>) => unknown) => {
      const store: Record<string, unknown> = {};
      return fn(store);
    },
  ),
}));

vi.mock("../config/sessions/store.js", () => ({
  updateSessionStore: vi.fn(
    async (_storePath: string, mutator: (store: Record<string, unknown>) => unknown) => {
      const store: Record<string, unknown> = {};
      return mutator(store);
    },
  ),
}));

vi.mock("../config/sessions/transcript-resolve.runtime.js", () => ({
  resolveSessionTranscriptFile: async () => ({
    sessionFile: "/tmp/session.jsonl",
    sessionEntry: { sessionId: "session-1", updatedAt: Date.now() },
  }),
}));

vi.mock("../infra/agent-events.js", () => ({
  clearAgentRunContext: (...args: unknown[]) => state.clearAgentRunContextMock(...args),
  emitAgentEvent: (...args: unknown[]) => state.emitAgentEventMock(...args),
  onAgentEvent: vi.fn(),
  registerAgentRunContext: (...args: unknown[]) => state.registerAgentRunContextMock(...args),
}));

vi.mock("../infra/outbound/session-context.js", () => ({
  buildOutboundSessionContext: () => ({}),
}));

vi.mock("../infra/skills-remote.js", () => ({
  getRemoteSkillEligibility: () => ({ eligible: false }),
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      raw: vi.fn(),
      child: vi.fn(() => logger),
    };
    return logger;
  },
}));

vi.mock("../routing/session-key.js", () => ({
  normalizeAgentId: (id: string) => id,
  normalizeMainKey: (key?: string | null) => key?.trim() || "main",
}));

vi.mock("../runtime.js", () => ({
  defaultRuntime: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock("../sessions/level-overrides.js", () => ({
  applyVerboseOverride: vi.fn(),
}));

vi.mock("../sessions/model-overrides.js", () => ({
  applyModelOverrideToSessionEntry: () => ({ updated: false }),
}));

vi.mock("../sessions/send-policy.js", () => ({
  resolveSendPolicy: () => "allow",
}));

vi.mock("../terminal/ansi.js", () => ({
  sanitizeForLog: (s: string) => s,
}));

vi.mock("../utils/message-channel.js", () => ({
  resolveMessageChannel: () => "test",
}));

vi.mock("./agent-scope.js", () => ({
  listAgentEntries: () => [],
  listAgentIds: () => ["default"],
  resolveAgentConfig: () => undefined,
  resolveAgentDir: () => "/tmp/agent",
  resolveEffectiveModelFallbacks: state.resolveEffectiveModelFallbacksMock,
  resolveSessionAgentId: () => "default",
  resolveSessionAgentIds: () => ({ defaultAgentId: "default", sessionAgentId: "default" }),
  resolveAgentSkillsFilter: () => undefined,
  resolveAgentWorkspaceDir: () => "/tmp/workspace",
}));

vi.mock("./auth-profiles.js", () => ({
  ensureAuthProfileStore: () => ({ profiles: {} }),
}));

vi.mock("./auth-profiles/store.js", () => ({
  ensureAuthProfileStore: () => state.authProfileStoreMock,
}));

vi.mock("./auth-profiles/session-override.js", () => ({
  clearSessionAuthProfileOverride: (...args: unknown[]) =>
    state.clearSessionAuthProfileOverrideMock(...args),
}));

vi.mock("./defaults.js", () => ({
  DEFAULT_MODEL: "claude",
  DEFAULT_PROVIDER: "anthropic",
}));

vi.mock("./lanes.js", () => ({
  AGENT_LANE_SUBAGENT: "subagent",
}));

vi.mock("./model-catalog.js", () => ({
  getCachedModelCatalog: () => [],
  loadModelCatalog: async () => [],
}));

vi.mock("./model-selection.js", () => ({
  buildAllowedModelSet: () => ({
    allowedKeys: new Set<string>([
      "anthropic/claude",
      "codex-cli/gpt-5.4",
      "openai/claude",
      "openai/gpt-5.4",
    ]),
    allowedCatalog: [],
    allowAny: false,
  }),
  modelKey: (p: string, m: string) => `${p}/${m}`,
  normalizeModelRef: (p: string, m: string) => ({ provider: p, model: m }),
  parseModelRef: (m: string, p: string) => ({ provider: p, model: m }),
  resolveConfiguredModelRef: () => ({ provider: "anthropic", model: "claude" }),
  resolveDefaultModelForAgent: () => ({ provider: "anthropic", model: "claude" }),
  resolveThinkingDefault: () => "low",
}));

vi.mock("./provider-auth-aliases.js", () => ({
  resolveProviderAuthAliasMap: () => ({}),
  resolveProviderIdForAuth: (provider: string) =>
    provider.trim().toLowerCase() === "codex-cli" ? "openai-codex" : provider.trim().toLowerCase(),
}));

vi.mock("./skills.js", () => ({
  buildWorkspaceSkillSnapshot: () => ({}),
}));

vi.mock("./skills/session-snapshot.js", () => ({
  resolveReusableWorkspaceSkillSnapshot: () => ({
    snapshot: { prompt: "", skills: [], resolvedSkills: [] },
    shouldRefresh: false,
    snapshotVersion: 0,
  }),
}));

vi.mock("./skills/filter.js", () => ({
  matchesSkillFilter: () => true,
}));

vi.mock("./skills/refresh-state.js", () => ({
  getSkillsSnapshotVersion: () => 0,
  setSkillsChangeListenerErrorHandler: () => {},
  shouldRefreshSnapshotForVersion: () => false,
}));

vi.mock("./spawned-context.js", () => ({
  normalizeSpawnedRunMetadata: (meta: unknown) => meta ?? {},
}));

vi.mock("./timeout.js", () => ({
  resolveAgentTimeoutMs: () => 30_000,
}));

vi.mock("./workspace.js", () => ({
  ensureAgentWorkspace: async () => ({ dir: "/tmp/workspace" }),
}));

vi.mock("../acp/control-plane/manager.js", () => ({
  getAcpSessionManager: () => ({
    resolveSession: (...args: unknown[]) => state.acpResolveSessionMock(...args),
    runTurn: (...args: unknown[]) => state.acpRunTurnMock(...args),
  }),
}));

let agentCommand: typeof import("./agent-command.js").agentCommand;

beforeAll(async () => {
  agentCommand ??= (await import("./agent-command.js")).agentCommand;
});

type FallbackRunnerParams = {
  provider: string;
  model: string;
  run: (provider: string, model: string) => Promise<unknown>;
};

type ModelSwitchOptions = ConstructorParameters<typeof LiveSessionModelSwitchError>[0];

function makeSuccessResult(provider: string, model: string) {
  return {
    payloads: [{ text: "ok" }],
    meta: {
      durationMs: 100,
      aborted: false,
      stopReason: "end_turn",
      agentMeta: { provider, model },
    },
  };
}

function setupModelSwitchRetry(switchOptions: ModelSwitchOptions) {
  let invocation = 0;
  state.runWithModelFallbackMock.mockImplementation(async (params: FallbackRunnerParams) => {
    invocation += 1;
    if (invocation === 1) {
      throw new LiveSessionModelSwitchError(switchOptions);
    }
    const result = await params.run(params.provider, params.model);
    return {
      result,
      provider: params.provider,
      model: params.model,
      attempts: [],
    };
  });
}

function setupSingleAttemptFallback() {
  state.runWithModelFallbackMock.mockImplementation(async (params: FallbackRunnerParams) => {
    const result = await params.run(params.provider, params.model);
    return {
      result,
      provider: params.provider,
      model: params.model,
      attempts: [],
    };
  });
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`expected ${label} to be an object`);
  }
  return value as Record<string, unknown>;
}

function mockCallArg(mock: ReturnType<typeof vi.fn>, callIndex = 0, argIndex = 0): unknown {
  const call = mock.mock.calls[callIndex] as unknown[] | undefined;
  if (!call) {
    throw new Error(`expected mock call ${callIndex}`);
  }
  return call[argIndex];
}

function expectRecordFields(value: unknown, expected: Record<string, unknown>): void {
  const actual = requireRecord(value, "record");
  for (const [key, expectedValue] of Object.entries(expected)) {
    expect(actual[key]).toEqual(expectedValue);
  }
}

function setupSessionTouchStore(): void {
  const sessionEntry = {
    sessionId: "session-1",
    updatedAt: 1,
    skillsSnapshot: { prompt: "", skills: [], version: 0 },
  };
  state.sessionEntryMock = sessionEntry;
  state.sessionStoreMock = { "agent:main": sessionEntry };
}

async function runBasicAgentCommand() {
  await agentCommand({
    message: "hello",
    to: "+1234567890",
    senderIsOwner: true,
  });
}

function expectFallbackOverrideCalls(first: boolean, second: boolean) {
  expect(state.resolveEffectiveModelFallbacksMock).toHaveBeenCalledTimes(2);
  expect(state.resolveEffectiveModelFallbacksMock.mock.calls[0][0]).toMatchObject({
    hasSessionModelOverride: first,
  });
  expect(state.resolveEffectiveModelFallbacksMock.mock.calls[1][0]).toMatchObject({
    hasSessionModelOverride: second,
  });
}

describe("agentCommand – LiveSessionModelSwitchError retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.acpResolveSessionMock.mockReturnValue(null);
    state.acpRunTurnMock.mockImplementation(async (params: unknown) => {
      const onEvent = (params as { onEvent?: (event: unknown) => void }).onEvent;
      onEvent?.({ type: "text_delta", stream: "output", text: "done" });
      onEvent?.({ type: "done", stopReason: "end_turn" });
    });
    state.createAcpVisibleTextAccumulatorMock.mockImplementation(() => {
      let text = "";
      return {
        consume(chunk: string) {
          text += chunk;
          return { text, delta: chunk };
        },
        finalizeRaw: () => text,
        finalize: () => text,
      };
    });
    state.buildAcpResultMock.mockImplementation((params: { payloadText?: string }) => ({
      payloads: params.payloadText ? [{ text: params.payloadText }] : [],
      meta: { durationMs: 0, stopReason: "end_turn" },
    }));
    state.persistCliTurnTranscriptMock.mockImplementation(
      async (params: { sessionEntry?: unknown }) => params.sessionEntry,
    );
    state.persistAcpTurnTranscriptMock.mockImplementation(
      async (params: { sessionEntry?: unknown }) => params.sessionEntry,
    );
    state.runCliTurnCompactionLifecycleMock.mockImplementation(
      async (params: { sessionEntry?: unknown }) => params.sessionEntry,
    );
    state.authProfileStoreMock = { profiles: {} };
    state.sessionEntryMock = undefined;
    state.sessionStoreMock = undefined;
    state.deliverAgentCommandResultMock.mockResolvedValue(undefined);
    state.updateSessionStoreAfterAgentRunMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries with the switched provider/model when LiveSessionModelSwitchError is thrown", async () => {
    setupModelSwitchRetry({
      provider: "openai",
      model: "gpt-5.4",
    });

    state.runAgentAttemptMock.mockResolvedValue(makeSuccessResult("openai", "gpt-5.4"));

    await runBasicAgentCommand();

    expect(state.runWithModelFallbackMock).toHaveBeenCalledTimes(2);

    const secondCall = state.runWithModelFallbackMock.mock.calls[1]?.[0] as
      | FallbackRunnerParams
      | undefined;
    expect(secondCall?.provider).toBe("openai");
    expect(secondCall?.model).toBe("gpt-5.4");

    const lifecycleEndCalls = state.emitAgentEventMock.mock.calls.filter((call: unknown[]) => {
      const arg = call[0] as { stream?: string; data?: { phase?: string } };
      return arg?.stream === "lifecycle" && arg?.data?.phase === "end";
    });
    expect(lifecycleEndCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("propagates non-switch errors without retrying and emits lifecycle error", async () => {
    state.runWithModelFallbackMock.mockRejectedValueOnce(new Error("provider down"));

    await expect(
      agentCommand({
        message: "hello",
        to: "+1234567890",
        senderIsOwner: true,
      }),
    ).rejects.toThrow("provider down");

    expect(state.runWithModelFallbackMock).toHaveBeenCalledTimes(1);

    const lifecycleErrorCalls = state.emitAgentEventMock.mock.calls.filter((call: unknown[]) => {
      const arg = call[0] as { stream?: string; data?: { phase?: string } };
      return arg?.stream === "lifecycle" && arg?.data?.phase === "error";
    });
    expect(lifecycleErrorCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("propagates authProfileId from the switch error to the retried session entry", async () => {
    let capturedAuthProfileProvider: string | undefined;
    setupModelSwitchRetry({
      provider: "openai",
      model: "gpt-5.4",
      authProfileId: "profile-openai-prod",
      authProfileIdSource: "user",
    });

    state.runAgentAttemptMock.mockImplementation(async (...args: unknown[]) => {
      const attemptParams = args[0] as { authProfileProvider?: string } | undefined;
      capturedAuthProfileProvider = attemptParams?.authProfileProvider;
      return makeSuccessResult("openai", "gpt-5.4");
    });

    await runBasicAgentCommand();

    expect(capturedAuthProfileProvider).toBe("openai");
    expect(state.runWithModelFallbackMock).toHaveBeenCalledTimes(2);
  });

  it("keeps aliased session auth profiles for codex-cli runs", async () => {
    let capturedAuthProfileProvider: string | undefined;
    const sessionEntry = {
      sessionId: "session-1",
      updatedAt: Date.now(),
      providerOverride: "codex-cli",
      modelOverride: "gpt-5.4",
      authProfileOverride: "openai-codex:work",
      authProfileOverrideSource: "user",
      skillsSnapshot: { prompt: "", skills: [], version: 0 },
    };
    state.sessionEntryMock = sessionEntry;
    state.authProfileStoreMock = {
      profiles: {
        "openai-codex:work": {
          type: "api_key",
          provider: "openai-codex",
          key: "sk-test",
        },
      },
    };
    state.runWithModelFallbackMock.mockImplementation(async (params: FallbackRunnerParams) => {
      const result = await params.run(params.provider, params.model);
      return {
        result,
        provider: params.provider,
        model: params.model,
        attempts: [],
      };
    });
    state.runAgentAttemptMock.mockImplementation(async (...args: unknown[]) => {
      const attemptParams = args[0] as { authProfileProvider?: string } | undefined;
      capturedAuthProfileProvider = attemptParams?.authProfileProvider;
      return makeSuccessResult("codex-cli", "gpt-5.4");
    });

    await runBasicAgentCommand();

    expect(capturedAuthProfileProvider).toBe("codex-cli");
    expect(state.clearSessionAuthProfileOverrideMock).not.toHaveBeenCalled();
  });

  it("updates hasSessionModelOverride for fallback resolution after switch", async () => {
    setupModelSwitchRetry({
      provider: "openai",
      model: "gpt-5.4",
    });
    state.runAgentAttemptMock.mockResolvedValue(makeSuccessResult("openai", "gpt-5.4"));

    state.resolveEffectiveModelFallbacksMock.mockClear();

    await runBasicAgentCommand();

    expectFallbackOverrideCalls(false, true);
  });

  it("does not flip hasSessionModelOverride on auth-only switch with same model", async () => {
    setupModelSwitchRetry({
      provider: "anthropic",
      model: "claude",
      authProfileId: "profile-99",
      authProfileIdSource: "user",
    });
    state.runAgentAttemptMock.mockResolvedValue(makeSuccessResult("anthropic", "claude"));

    state.resolveEffectiveModelFallbacksMock.mockClear();

    await runBasicAgentCommand();

    expectFallbackOverrideCalls(false, false);
  });

  it("sends internal completion wakes to ACP sessions as plain prompt text", async () => {
    state.acpResolveSessionMock.mockReturnValue({
      kind: "ready",
      meta: {
        agent: "claude",
        cwd: "/tmp/workspace",
      },
    });

    await agentCommand({
      message: [
        INTERNAL_RUNTIME_CONTEXT_BEGIN,
        "Kova runtime context (internal):",
        "hidden task completion event",
        INTERNAL_RUNTIME_CONTEXT_END,
      ].join("\n"),
      sessionKey: "agent:main",
      senderIsOwner: true,
      internalEvents: [
        {
          type: "task_completion",
          source: "subagent",
          childSessionKey: "agent:main:subagent:child",
          childSessionId: "child-session-id",
          announceType: "subagent task",
          taskLabel: "inspect ACP delivery",
          status: "ok",
          statusLabel: "completed successfully",
          result: "child output",
          replyInstruction: "Summarize the result for the user.",
        },
      ],
    });

    expect(state.acpRunTurnMock).toHaveBeenCalledTimes(1);
    const runTurnParams = state.acpRunTurnMock.mock.calls[0]?.[0] as { text?: string };
    expect(runTurnParams.text).toContain("A background task completed.");
    expect(runTurnParams.text).toContain("inspect ACP delivery");
    expect(runTurnParams.text).toContain("child output");
    expect(runTurnParams.text).not.toContain(INTERNAL_RUNTIME_CONTEXT_BEGIN);
    expect(runTurnParams.text).not.toContain(INTERNAL_RUNTIME_CONTEXT_END);

    expect(state.persistAcpTurnTranscriptMock).toHaveBeenCalledTimes(1);
    const transcriptParams = state.persistAcpTurnTranscriptMock.mock.calls[0]?.[0] as {
      body?: string;
      transcriptBody?: string;
    };
    expect(transcriptParams.body).toBe(runTurnParams.text);
    expect(transcriptParams.transcriptBody).toContain("A background task completed.");
    expect(transcriptParams.transcriptBody).not.toContain(INTERNAL_RUNTIME_CONTEXT_BEGIN);
    expect(transcriptParams.transcriptBody).not.toContain(INTERNAL_RUNTIME_CONTEXT_END);
  });

  it("uses rotated session identity for all post-run session persistence", async () => {
    setupSingleAttemptFallback();
    setupSessionTouchStore();
    const rotatedEntry = {
      sessionId: "rotated-session",
      sessionFile: "/tmp/rotated-session.jsonl",
      updatedAt: 2,
      skillsSnapshot: { prompt: "", skills: [], version: 0 },
    };
    const result = makeSuccessResult("openai", "gpt-5.4") as ReturnType<
      typeof makeSuccessResult
    > & {
      meta: Record<string, unknown> & { agentMeta: Record<string, unknown> };
    };
    result.meta.executionTrace = {
      runner: "cli",
      fallbackUsed: false,
      winnerProvider: "openai",
      winnerModel: "gpt-5.4",
    };
    result.meta.finalAssistantVisibleText = "ok";
    result.meta.agentMeta = {
      ...result.meta.agentMeta,
      sessionId: "rotated-session",
      sessionFile: "/tmp/rotated-session.jsonl",
    };
    state.runAgentAttemptMock.mockResolvedValue(result);
    state.updateSessionStoreAfterAgentRunMock.mockImplementation(async (params: unknown) => {
      const record = requireRecord(params, "update params");
      const sessionStore = requireRecord(record.sessionStore, "session store");
      sessionStore["agent:main"] = rotatedEntry;
    });
    state.persistCliTurnTranscriptMock.mockResolvedValue(rotatedEntry);
    state.runCliTurnCompactionLifecycleMock.mockResolvedValue(rotatedEntry);

    await runBasicAgentCommand();

    expectRecordFields(mockCallArg(state.updateSessionStoreAfterAgentRunMock), {
      sessionId: "rotated-session",
    });
    expectRecordFields(mockCallArg(state.persistCliTurnTranscriptMock), {
      sessionId: "rotated-session",
      sessionKey: "agent:main",
    });
    expectRecordFields(mockCallArg(state.runCliTurnCompactionLifecycleMock), {
      sessionId: "rotated-session",
      sessionKey: "agent:main",
    });
    const transcriptParams = requireRecord(
      mockCallArg(state.persistCliTurnTranscriptMock),
      "transcript params",
    );
    expectRecordFields(transcriptParams.sessionEntry, {
      sessionId: "rotated-session",
      sessionFile: "/tmp/rotated-session.jsonl",
    });
    expectRecordFields(mockCallArg(state.deliverAgentCommandResultMock), {
      expectedSessionIdForFreshDelivery: "rotated-session",
    });
  });

  it("does not treat backend CLI session id as Kova session identity", async () => {
    setupSingleAttemptFallback();
    setupSessionTouchStore();
    const result = makeSuccessResult("openai", "gpt-5.4") as ReturnType<
      typeof makeSuccessResult
    > & {
      meta: Record<string, unknown> & { agentMeta: Record<string, unknown> };
    };
    result.meta.executionTrace = {
      runner: "cli",
      fallbackUsed: false,
      winnerProvider: "openai",
      winnerModel: "gpt-5.4",
    };
    result.meta.agentMeta = {
      ...result.meta.agentMeta,
      sessionId: "backend-cli-session",
    };
    state.runAgentAttemptMock.mockResolvedValue(result);

    await runBasicAgentCommand();

    expectRecordFields(mockCallArg(state.updateSessionStoreAfterAgentRunMock), {
      sessionId: "session-1",
    });
    expectRecordFields(mockCallArg(state.deliverAgentCommandResultMock), {
      expectedSessionIdForFreshDelivery: "session-1",
    });
  });

  it("flips hasSessionModelOverride on provider-only switch with same model", async () => {
    setupModelSwitchRetry({
      provider: "openai",
      model: "claude",
    });
    state.runAgentAttemptMock.mockResolvedValue(makeSuccessResult("openai", "claude"));

    state.resolveEffectiveModelFallbacksMock.mockClear();

    await runBasicAgentCommand();

    expectFallbackOverrideCalls(false, true);
  });
});
