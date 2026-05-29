import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEmbeddedMode, setEmbeddedMode } from "../infra/embedded-mode.js";
import { defaultRuntime } from "../runtime.js";

const agentCommandFromIngressMock = vi.fn();
const getReplyFromConfigMock = vi.fn();
const createDefaultDepsMock = vi.fn(() => ({}));
let registeredListener: ((evt: unknown) => void) | undefined;

function withoutProgressEvents(events: Array<{ event: string; payload: unknown }>) {
  return events.filter(
    (entry) =>
      !(
        entry.event === "agent" &&
        typeof entry.payload === "object" &&
        entry.payload !== null &&
        (entry.payload as { stream?: string }).stream === "progress"
      ),
  );
}

vi.mock("../agents/agent-command.js", () => ({
  agentCommandFromIngress: (...args: unknown[]) => agentCommandFromIngressMock(...args),
}));

vi.mock("../auto-reply/reply/get-reply.js", () => ({
  getReplyFromConfig: (...args: unknown[]) => getReplyFromConfigMock(...args),
}));

vi.mock("../infra/agent-events.js", () => ({
  onAgentEvent: (listener: (evt: unknown) => void) => {
    registeredListener = listener;
    return () => {
      if (registeredListener === listener) {
        registeredListener = undefined;
      }
    };
  },
}));

vi.mock("../cli/deps.js", () => ({
  createDefaultDeps: () => createDefaultDepsMock(),
}));

vi.mock("../config/sessions.js", () => ({
  resolveAgentMainSessionKey: () => "agent:main:main",
  resolveStorePath: () => "/tmp/kova-sessions.json",
  updateSessionStore: vi.fn(),
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveSessionAgentId: () => "main",
}));

vi.mock("../agents/defaults.js", () => ({
  DEFAULT_MODEL: "gpt-5.5",
  DEFAULT_PROVIDER: "openai",
}));

vi.mock("../agents/model-selection.js", () => ({
  buildAllowedModelSet: ({ catalog }: { catalog: unknown[] }) => ({ allowedCatalog: catalog }),
  resolveConfiguredModelRef: () => null,
  resolveThinkingDefault: () => undefined,
}));

vi.mock("../config/config.js", () => ({
  getRuntimeConfig: () => ({}),
  loadConfig: () => ({}),
}));

vi.mock("../gateway/cli-session-history.js", () => ({
  augmentChatHistoryWithCliSessionImports: ({ localMessages }: { localMessages?: unknown[] }) =>
    localMessages ?? [],
}));

vi.mock("../gateway/chat-display-projection.js", () => ({
  projectChatDisplayMessages: (messages: unknown[]) => messages,
  projectRecentChatDisplayMessages: (messages: unknown[]) => messages,
  resolveEffectiveChatHistoryMaxChars: () => 100_000,
}));

vi.mock("../gateway/server-constants.js", () => ({
  getMaxChatHistoryMessagesBytes: () => 100_000,
}));

vi.mock("../gateway/server-methods/chat.js", () => ({
  CHAT_HISTORY_MAX_SINGLE_MESSAGE_BYTES: 100_000,
  augmentChatHistoryWithCanvasBlocks: (messages: unknown[]) => messages,
  enforceChatHistoryFinalBudget: ({ messages }: { messages: unknown[] }) => ({ messages }),
  replaceOversizedChatHistoryMessages: ({ messages }: { messages: unknown[] }) => ({ messages }),
}));

vi.mock("../gateway/session-utils.js", () => ({
  listAgentsForGateway: () => [],
  listSessionsFromStore: () => ({ sessions: [] }),
  loadCombinedSessionStoreForGateway: () => ({
    storePath: "/tmp/kova-sessions.json",
    store: {},
  }),
  loadSessionEntry: (sessionKey: string) => ({
    cfg: {},
    canonicalKey: sessionKey,
    entry: {},
  }),
  migrateAndPruneGatewaySessionStoreKey: ({ key }: { key: string }) => ({ primaryKey: key }),
  readSessionMessages: () => [],
  resolveGatewaySessionStoreTarget: ({ key }: { key: string }) => ({
    canonicalKey: key,
    storePath: "/tmp/kova-sessions.json",
  }),
  resolveSessionModelRef: () => ({ provider: "openai", model: "gpt-5.4" }),
}));

vi.mock("../gateway/session-entry.js", () => ({
  loadSessionEntry: (sessionKey: string) => ({
    cfg: {},
    canonicalKey: sessionKey,
    entry: {},
  }),
}));

vi.mock("../gateway/server-model-catalog.js", () => ({
  loadGatewayModelCatalog: () => [],
}));

vi.mock("../gateway/session-reset-service.js", () => ({
  performGatewaySessionReset: () => ({ ok: true, key: "agent:main:main", entry: {} }),
}));

vi.mock("../gateway/session-utils.fs.js", () => ({
  capArrayByJsonBytes: (items: unknown[]) => ({ items }),
  readSessionMessagesAsync: () => [],
}));

vi.mock("../gateway/sessions-patch.js", () => ({
  applySessionsPatchToStore: () => ({ entry: {} }),
}));

vi.mock("../gateway/server-methods/agent-timestamp.js", () => ({
  injectTimestamp: (message: string) => message,
  timestampOptsFromConfig: () => ({}),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushAsyncTurn() {
  await flushMicrotasks();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await flushMicrotasks();
}

async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 20; i++) {
    if (predicate()) {
      return;
    }
    await flushAsyncTurn();
  }
  expect(predicate()).toBe(true);
}

describe("EmbeddedTuiBackend", () => {
  const originalRuntimeLog = defaultRuntime.log;
  const originalRuntimeError = defaultRuntime.error;
  const originalTrace = process.env.KOVA_TUI_TRACE;

  beforeEach(() => {
    agentCommandFromIngressMock.mockReset();
    getReplyFromConfigMock.mockReset();
    createDefaultDepsMock.mockClear();
    registeredListener = undefined;
    setEmbeddedMode(false);
    defaultRuntime.log = originalRuntimeLog;
    defaultRuntime.error = originalRuntimeError;
    delete process.env.KOVA_TUI_TRACE;
  });

  afterEach(() => {
    setEmbeddedMode(false);
    defaultRuntime.log = originalRuntimeLog;
    defaultRuntime.error = originalRuntimeError;
    if (originalTrace === undefined) {
      delete process.env.KOVA_TUI_TRACE;
    } else {
      process.env.KOVA_TUI_TRACE = originalTrace;
    }
  });

  it("bridges assistant and lifecycle events into chat events", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const pending = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    agentCommandFromIngressMock.mockReturnValueOnce(pending.promise);

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    const onConnected = vi.fn();
    backend.onConnected = onConnected;
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await flushMicrotasks();
    expect(onConnected).toHaveBeenCalledTimes(1);

    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "hello",
      runId: "run-local-1",
    });

    registeredListener?.({
      runId: "run-local-1",
      stream: "assistant",
      data: { text: "hello", delta: "hello" },
    });
    registeredListener?.({
      runId: "run-local-1",
      stream: "lifecycle",
      data: { phase: "end", stopReason: "stop" },
    });

    pending.resolve({ payloads: [{ text: "hello" }], meta: {} });
    await flushMicrotasks();

    expect(withoutProgressEvents(events)).toEqual([
      {
        event: "agent",
        payload: {
          runId: "run-local-1",
          stream: "assistant",
          data: { text: "hello", delta: "hello" },
        },
      },
      {
        event: "chat",
        payload: {
          runId: "run-local-1",
          sessionKey: "agent:main:main",
          state: "delta",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "hello" }],
            timestamp: expect.any(Number),
          },
        },
      },
      {
        event: "agent",
        payload: {
          runId: "run-local-1",
          stream: "lifecycle",
          data: { phase: "end", stopReason: "stop" },
        },
      },
      {
        event: "chat",
        payload: {
          runId: "run-local-1",
          sessionKey: "agent:main:main",
          state: "final",
          stopReason: "stop",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "hello" }],
            timestamp: expect.any(Number),
          },
        },
      },
    ]);
  });

  it("warms embedded chat imports shortly after connect without blocking connection", async () => {
    vi.useFakeTimers();
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const backend = new EmbeddedTuiBackend();
    const onConnected = vi.fn();
    backend.onConnected = onConnected;

    try {
      backend.start();
      await flushMicrotasks();

      expect(onConnected).toHaveBeenCalledTimes(1);
      expect(createDefaultDepsMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(15);
      expect(createDefaultDepsMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();

      expect(createDefaultDepsMock).toHaveBeenCalledTimes(1);
    } finally {
      await backend.stop();
      vi.useRealTimers();
    }
  });

  it("waits for finishing local runs before tearing down embedded mode", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const pending = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    let abortSignal: AbortSignal | undefined;
    agentCommandFromIngressMock.mockImplementationOnce((params: { abortSignal?: AbortSignal }) => {
      abortSignal = params.abortSignal;
      return pending.promise;
    });

    const backend = new EmbeddedTuiBackend();
    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "hello",
      runId: "run-finishing-stop",
    });
    await waitFor(() => agentCommandFromIngressMock.mock.calls.length === 1);

    registeredListener?.({
      runId: "run-finishing-stop",
      stream: "lifecycle",
      data: { phase: "finishing" },
    });
    const stopPromise = backend.stop();
    await flushMicrotasks();

    expect(abortSignal?.aborted).toBe(false);
    expect(isEmbeddedMode()).toBe(true);

    pending.resolve({ payloads: [{ text: "done" }], meta: {} });
    await stopPromise;

    expect(isEmbeddedMode()).toBe(false);
  });

  it("aborts finishing local runs immediately when shutdown grace is disabled", async () => {
    const previous = process.env.KOVA_TUI_LOCAL_RUN_SHUTDOWN_GRACE_MS;
    process.env.KOVA_TUI_LOCAL_RUN_SHUTDOWN_GRACE_MS = "0";
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const pending = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    let abortSignal: AbortSignal | undefined;
    agentCommandFromIngressMock.mockImplementationOnce((params: { abortSignal?: AbortSignal }) => {
      abortSignal = params.abortSignal;
      return pending.promise;
    });

    const backend = new EmbeddedTuiBackend();
    try {
      backend.start();
      await backend.sendChat({
        sessionKey: "agent:main:main",
        message: "hello",
        runId: "run-finishing-stop-now",
      });
      await waitFor(() => agentCommandFromIngressMock.mock.calls.length === 1);

      registeredListener?.({
        runId: "run-finishing-stop-now",
        stream: "lifecycle",
        data: { phase: "finishing" },
      });
      await backend.stop();

      expect(abortSignal?.aborted).toBe(true);
      expect(isEmbeddedMode()).toBe(false);
    } finally {
      pending.resolve({ payloads: [], meta: {} });
      if (previous === undefined) {
        delete process.env.KOVA_TUI_LOCAL_RUN_SHUTDOWN_GRACE_MS;
      } else {
        process.env.KOVA_TUI_LOCAL_RUN_SHUTDOWN_GRACE_MS = previous;
      }
    }
  });

  it("keeps final short replies like No after suppressing lead-fragment deltas", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const pending = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    agentCommandFromIngressMock.mockReturnValueOnce(pending.promise);

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "answer shortly",
      runId: "run-local-no",
    });

    registeredListener?.({
      runId: "run-local-no",
      stream: "assistant",
      data: { text: "No", delta: "No" },
    });
    registeredListener?.({
      runId: "run-local-no",
      stream: "lifecycle",
      data: { phase: "end", stopReason: "stop" },
    });

    pending.resolve({ payloads: [{ text: "No" }], meta: {} });
    await flushMicrotasks();

    const chatPayloads = events
      .filter((entry) => entry.event === "chat")
      .map(
        (entry) =>
          entry.payload as { state?: string; message?: { content?: Array<{ text?: string }> } },
      );
    const nonEmptyDeltas = chatPayloads.filter(
      (payload) => payload.state === "delta" && payload.message?.content?.[0]?.text,
    );
    expect(nonEmptyDeltas).toHaveLength(0);
    expect(chatPayloads.at(-1)).toEqual(
      expect.objectContaining({
        state: "final",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "No" }],
          timestamp: expect.any(Number),
        },
      }),
    );
  });

  it("marks local chat turns for interactive failover", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    agentCommandFromIngressMock.mockResolvedValueOnce({
      payloads: [{ text: "ok" }],
      meta: {},
    });

    const backend = new EmbeddedTuiBackend();
    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "hello",
      runId: "run-interactive-failover",
    });
    await waitFor(() => agentCommandFromIngressMock.mock.calls.length === 1);

    expect(agentCommandFromIngressMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        interactiveFailover: true,
      }),
    );
  });

  it("emits side-result events for local /btw runs", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    agentCommandFromIngressMock.mockResolvedValueOnce({
      payloads: [{ text: "nothing important" }],
      meta: {},
    });

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "/btw what changed?",
      runId: "run-btw-1",
    });
    await waitFor(() => events.length >= 2);

    expect(withoutProgressEvents(events)).toEqual([
      {
        event: "chat.side_result",
        payload: {
          kind: "btw",
          runId: "run-btw-1",
          sessionKey: "agent:main:main",
          question: "what changed?",
          text: "nothing important",
        },
      },
      {
        event: "chat",
        payload: {
          runId: "run-btw-1",
          sessionKey: "agent:main:main",
          state: "final",
        },
      },
    ]);
  });

  it("does not route local text slash commands through the reply command pipeline", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    agentCommandFromIngressMock.mockResolvedValueOnce({
      payloads: [{ text: "Memory status:" }],
      meta: {},
    });

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "/memory",
      runId: "run-memory-command",
    });
    await waitFor(() => agentCommandFromIngressMock.mock.calls.length === 1);

    expect(agentCommandFromIngressMock).toHaveBeenCalledOnce();
    expect(getReplyFromConfigMock).not.toHaveBeenCalled();
    expect(withoutProgressEvents(events)).toEqual([
      {
        event: "chat",
        payload: {
          runId: "run-memory-command",
          sessionKey: "agent:main:main",
          state: "final",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Memory status:" }],
            timestamp: expect.any(Number),
          },
        },
      },
    ]);
  });

  it("answers local status without importing the reply command pipeline", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "/status",
      runId: "run-status-command",
    });
    await waitFor(() => events.some((evt) => evt.event === "chat"));

    expect(agentCommandFromIngressMock).not.toHaveBeenCalled();
    expect(getReplyFromConfigMock).not.toHaveBeenCalled();
    expect(events).toContainEqual({
      event: "chat",
      payload: {
        runId: "run-status-command",
        sessionKey: "agent:main:main",
        state: "final",
        message: {
          role: "assistant",
          command: true,
          content: [
            {
              type: "text",
              text: expect.stringContaining("Kova terminal status"),
            },
          ],
          timestamp: expect.any(Number),
        },
      },
    });
  });

  it("does not turn transient lifecycle errors into chat errors before fallback completes", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const pending = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    agentCommandFromIngressMock.mockReturnValueOnce(pending.promise);

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "hello",
      runId: "run-fallback",
    });

    registeredListener?.({
      runId: "run-fallback",
      stream: "lifecycle",
      data: { phase: "error", error: "429 rate limit" },
    });
    registeredListener?.({
      runId: "run-fallback",
      stream: "assistant",
      data: { text: "recovered", delta: "recovered" },
    });
    registeredListener?.({
      runId: "run-fallback",
      stream: "lifecycle",
      data: { phase: "end", stopReason: "stop" },
    });

    pending.resolve({ payloads: [{ text: "recovered" }], meta: {} });
    await flushMicrotasks();

    const chatPayloads = events
      .filter((entry) => entry.event === "chat")
      .map((entry) => entry.payload as { state?: string; errorMessage?: string });
    expect(chatPayloads.some((payload) => payload.state === "error")).toBe(false);
    expect(chatPayloads.at(-1)).toEqual(
      expect.objectContaining({
        state: "final",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "recovered" }],
          timestamp: expect.any(Number),
        },
      }),
    );
  });

  it("formats fallback cooldown errors for terminal chat", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const error = Object.assign(
      new Error(
        "All models failed (1): openai-codex/gpt-5.5: Provider openai-codex is in cooldown (all profiles unavailable) (rate_limit)",
      ),
      {
        name: "FallbackSummaryError",
        attempts: [{ provider: "openai-codex", model: "gpt-5.5", reason: "rate_limit" }],
        soonestCooldownExpiry: Date.now() + 45_000,
      },
    );
    agentCommandFromIngressMock.mockRejectedValueOnce(error);

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "hello",
      runId: "run-rate-limit",
    });
    await waitFor(() =>
      events.some((entry) => (entry.payload as { state?: string }).state === "error"),
    );

    const errorPayload = events
      .filter((entry) => entry.event === "chat")
      .map((entry) => entry.payload as { state?: string; errorMessage?: string })
      .find((payload) => payload.state === "error");
    expect(errorPayload?.errorMessage).toContain("openai-codex is rate-limited");
    expect(errorPayload?.errorMessage).toContain("switch with /models");
    expect(errorPayload?.errorMessage).not.toContain("All models failed");
  });

  it("registers tool-first local runs before forwarding agent events", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const pending = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    agentCommandFromIngressMock.mockReturnValueOnce(pending.promise);

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "run tool first",
      runId: "run-tool-first",
    });

    registeredListener?.({
      runId: "run-tool-first",
      stream: "tool",
      data: { phase: "start", toolCallId: "tc-tool-first", name: "exec" },
    });
    pending.resolve({ payloads: [{ text: "done" }], meta: {} });
    await waitFor(() =>
      events.some((entry) => (entry.payload as { state?: string }).state === "final"),
    );

    expect(withoutProgressEvents(events)).toEqual([
      {
        event: "chat",
        payload: {
          runId: "run-tool-first",
          sessionKey: "agent:main:main",
          state: "delta",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "" }],
            timestamp: expect.any(Number),
          },
        },
      },
      {
        event: "agent",
        payload: {
          runId: "run-tool-first",
          stream: "tool",
          data: { phase: "start", toolCallId: "tc-tool-first", name: "exec" },
        },
      },
      {
        event: "chat",
        payload: {
          runId: "run-tool-first",
          sessionKey: "agent:main:main",
          state: "final",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "done" }],
            timestamp: expect.any(Number),
          },
        },
      },
    ]);
  });

  it("aborts active local runs", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    let capturedSignal: AbortSignal | undefined;
    agentCommandFromIngressMock.mockImplementationOnce((opts: { abortSignal?: AbortSignal }) => {
      capturedSignal = opts.abortSignal;
      return new Promise((_, reject) => {
        opts.abortSignal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    });

    const backend = new EmbeddedTuiBackend();
    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "long task",
      runId: "run-abort-1",
    });
    await waitFor(() => capturedSignal !== undefined);

    const result = await backend.abortChat({
      sessionKey: "agent:main:main",
      runId: "run-abort-1",
    });
    await flushMicrotasks();

    expect(result).toEqual({ ok: true, aborted: true });
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("queues normal same-session messages instead of aborting the active local run", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const first = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    const second = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    let firstSignal: AbortSignal | undefined;
    let secondMessage = "";
    agentCommandFromIngressMock
      .mockImplementationOnce((opts: { abortSignal?: AbortSignal }) => {
        firstSignal = opts.abortSignal;
        return first.promise;
      })
      .mockImplementationOnce((opts: { message?: string }) => {
        secondMessage = opts.message ?? "";
        return second.promise;
      });

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "first",
      runId: "run-queue-first",
    });
    await waitFor(() => agentCommandFromIngressMock.mock.calls.length === 1);

    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "second",
      runId: "run-queue-second",
    });
    await flushAsyncTurn();

    expect(firstSignal?.aborted).toBe(false);
    expect(agentCommandFromIngressMock).toHaveBeenCalledTimes(1);

    registeredListener?.({
      runId: "run-queue-first",
      stream: "lifecycle",
      data: { phase: "end", stopReason: "stop" },
    });
    await flushAsyncTurn();
    expect(agentCommandFromIngressMock).toHaveBeenCalledTimes(1);

    first.resolve({ payloads: [{ text: "first done" }], meta: {} });
    await waitFor(() => agentCommandFromIngressMock.mock.calls.length === 2);

    expect(secondMessage).toBe("second");
    second.resolve({ payloads: [{ text: "second done" }], meta: {} });
    await waitFor(() =>
      events.some(
        (entry) =>
          entry.event === "chat" &&
          (entry.payload as { runId?: string; state?: string }).runId === "run-queue-second" &&
          (entry.payload as { state?: string }).state === "final",
      ),
    );
  });

  it("routes stop text to abort the active local run without starting a queued turn", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    let capturedSignal: AbortSignal | undefined;
    agentCommandFromIngressMock.mockImplementationOnce((opts: { abortSignal?: AbortSignal }) => {
      capturedSignal = opts.abortSignal;
      return new Promise((_, reject) => {
        opts.abortSignal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    });

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "long task",
      runId: "run-stop-active",
    });
    await waitFor(() => capturedSignal !== undefined);

    const result = await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "/stop",
      runId: "run-stop-command",
    });
    await waitFor(() => capturedSignal?.aborted === true);

    expect(result).toEqual({ runId: "run-stop-command" });
    expect(agentCommandFromIngressMock).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({
      event: "chat",
      payload: {
        runId: "run-stop-active",
        sessionKey: "agent:main:main",
        state: "aborted",
      },
    });
  });

  it("emits opt-in timing trace events for local turns", async () => {
    process.env.KOVA_TUI_TRACE = "1";
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    const pending = deferred<{
      payloads: Array<{ text: string }>;
      meta: Record<string, unknown>;
    }>();
    agentCommandFromIngressMock.mockReturnValueOnce(pending.promise);
    const result = {
      payloads: [{ text: "hello" }],
      meta: {},
    };

    const backend = new EmbeddedTuiBackend();
    const events: Array<{ event: string; payload: unknown }> = [];
    backend.onEvent = (evt) => {
      events.push({ event: evt.event, payload: evt.payload });
    };

    backend.start();
    await backend.sendChat({
      sessionKey: "agent:main:main",
      message: "hello",
      runId: "run-trace",
    });
    registeredListener?.({
      runId: "run-trace",
      stream: "tool",
      data: { phase: "start", toolCallId: "tc-search", name: "web_search" },
    });
    registeredListener?.({
      runId: "run-trace",
      stream: "tool",
      data: { phase: "result", toolCallId: "tc-search", name: "web_search" },
    });
    pending.resolve(result);
    await waitFor(() =>
      events.some(
        (entry) =>
          entry.event === "trace" &&
          (entry.payload as { stage?: string } | undefined)?.stage === "summary",
      ),
    );

    const tracePayloads = events
      .filter((entry) => entry.event === "trace")
      .map(
        (entry) =>
          entry.payload as { stage?: string; elapsedMs?: number; runId?: string; detail?: string },
      );
    expect(tracePayloads.map((payload) => payload.stage)).toEqual(
      expect.arrayContaining([
        "send.accepted",
        "turn.start",
        "session.load.start",
        "session.load.end",
        "agent.imports.start",
        "agent.imports.end",
        "agent.dispatch.start",
        "agent.dispatch.end",
        "tool.web_search.start",
        "tool.web_search.result",
        "turn.final",
        "summary",
      ]),
    );
    expect(tracePayloads.every((payload) => payload.runId === "run-trace")).toBe(true);
    expect(tracePayloads.every((payload) => typeof payload.elapsedMs === "number")).toBe(true);
    expect(tracePayloads.find((payload) => payload.stage === "summary")?.detail).toMatch(
      /^final \| slowest /,
    );
  });

  it("restores embedded mode and runtime loggers on stop", async () => {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");

    const backend = new EmbeddedTuiBackend();
    backend.start();

    expect(isEmbeddedMode()).toBe(true);
    expect(defaultRuntime.log).not.toBe(originalRuntimeLog);
    expect(defaultRuntime.error).not.toBe(originalRuntimeError);

    await backend.stop();

    expect(isEmbeddedMode()).toBe(false);
    expect(defaultRuntime.log).toBe(originalRuntimeLog);
    expect(defaultRuntime.error).toBe(originalRuntimeError);
  });
});
