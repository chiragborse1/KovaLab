import { describe, expect, it, vi } from "vitest";
import { createCommandHandlers } from "./tui-command-handlers.js";
import type { QueuedMessage, SessionInfo } from "./tui-types.js";

type LoadHistoryMock = ReturnType<typeof vi.fn> & (() => Promise<void>);
type RunAuthFlow = NonNullable<Parameters<typeof createCommandHandlers>[0]["runAuthFlow"]>;
type AbortActiveMock = ReturnType<typeof vi.fn> & (() => Promise<void>);
type SelectableOverlay = {
  onSelect?: (item: { value: string; label?: string; description?: string }) => void;
  getFilterText?: () => string;
};
type SetActivityStatusMock = ReturnType<typeof vi.fn> & ((text: string) => void);
type SetSessionMock = ReturnType<typeof vi.fn> & ((key: string) => Promise<void>);

async function flushAsyncSelect() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function createHarness(params?: {
  sendChat?: ReturnType<typeof vi.fn>;
  steerChat?: ReturnType<typeof vi.fn>;
  getGatewayStatus?: ReturnType<typeof vi.fn>;
  patchSession?: ReturnType<typeof vi.fn>;
  resetSession?: ReturnType<typeof vi.fn>;
  listSessions?: ReturnType<typeof vi.fn>;
  listPlugins?: ReturnType<typeof vi.fn>;
  listTools?: ReturnType<typeof vi.fn>;
  listSkills?: ReturnType<typeof vi.fn>;
  listTasks?: ReturnType<typeof vi.fn>;
  auditTasks?: ReturnType<typeof vi.fn>;
  maintainTasks?: ReturnType<typeof vi.fn>;
  listSessionCheckpoints?: ReturnType<typeof vi.fn>;
  getSessionCheckpoint?: ReturnType<typeof vi.fn>;
  branchSessionCheckpoint?: ReturnType<typeof vi.fn>;
  restoreSessionCheckpoint?: ReturnType<typeof vi.fn>;
  runAuthFlow?: RunAuthFlow;
  setSession?: SetSessionMock;
  loadHistory?: LoadHistoryMock;
  refreshSessionInfo?: ReturnType<typeof vi.fn>;
  applySessionInfoFromPatch?: ReturnType<typeof vi.fn>;
  setActivityStatus?: SetActivityStatusMock;
  abortActive?: AbortActiveMock;
  isConnected?: boolean;
  activeChatRunId?: string | null;
  pendingOptimisticUserMessage?: boolean;
  busyInputMode?: "queue" | "steer" | "interrupt";
  sessionInfo?: SessionInfo;
  opts?: { local?: boolean };
}) {
  const sendChat = params?.sendChat ?? vi.fn().mockResolvedValue({ runId: "r1" });
  const steerChat = params?.steerChat;
  const getGatewayStatus = params?.getGatewayStatus ?? vi.fn().mockResolvedValue({});
  const patchSession = params?.patchSession ?? vi.fn().mockResolvedValue({});
  const resetSession = params?.resetSession ?? vi.fn().mockResolvedValue({ ok: true });
  const listSessions =
    params?.listSessions ??
    vi.fn().mockResolvedValue({
      sessions: [
        {
          key: "agent:main:research",
          displayName: "Research",
          updatedAt: Date.now(),
          lastMessagePreview: "latest research notes",
        },
      ],
    });
  const listPlugins =
    params?.listPlugins ??
    vi.fn().mockResolvedValue({
      registrySource: "derived",
      plugins: [
        {
          id: "telegram",
          name: "Telegram",
          enabled: true,
          status: "loaded",
          origin: "bundled",
          format: "kova",
          kind: ["channel"],
          channelIds: ["telegram"],
          providerIds: [],
          toolNames: ["telegram_send"],
          gatewayMethods: [],
          services: [],
          commands: ["pair"],
          configSchema: true,
          installed: false,
          configured: true,
          removable: true,
        },
      ],
      diagnostics: [],
      totals: {
        total: 1,
        enabled: 1,
        disabled: 0,
        errors: 0,
        channels: 1,
        providers: 0,
      },
    });
  const listTools =
    params?.listTools ??
    vi.fn().mockResolvedValue({
      agentId: "main",
      groups: [
        {
          id: "files",
          label: "Files",
          source: "core",
          tools: [
            {
              id: "read",
              label: "read",
              description: "Read files",
              source: "core",
              defaultProfiles: ["coding"],
            },
          ],
        },
      ],
      profiles: [],
    });
  const listSkills =
    params?.listSkills ??
    vi.fn().mockResolvedValue({
      workspaceDir: "",
      managedSkillsDir: "",
      skills: [
        {
          name: "codex",
          description: "Coding workflow",
          source: "workspace",
          bundled: false,
          filePath: "",
          baseDir: "",
          skillKey: "codex",
          always: false,
          disabled: false,
          blockedByAllowlist: false,
          eligible: true,
          requirements: {},
          missing: {},
          configChecks: [],
          install: [],
        },
      ],
    });
  const listTasks =
    params?.listTasks ??
    vi.fn().mockResolvedValue({
      tasks: [
        {
          id: "task-1",
          runtime: "subagent",
          sessionKey: "agent:main:main",
          ownerKey: "agent:main:main",
          scope: "session",
          childSessionKey: "agent:main:subagent:child",
          title: "research memory loop",
          status: "running",
          deliveryStatus: "pending",
          notifyPolicy: "done_only",
          createdAt: Date.now(),
          lastEventAt: Date.now(),
        },
      ],
      summary: {
        total: 1,
        active: 1,
        terminal: 0,
        failures: 0,
        byStatus: {
          queued: 0,
          running: 1,
          succeeded: 0,
          failed: 0,
          timed_out: 0,
          cancelled: 0,
          lost: 0,
        },
        byRuntime: {
          subagent: 1,
          acp: 0,
          cli: 0,
          cron: 0,
        },
      },
      count: 1,
    });
  const auditTasks =
    params?.auditTasks ??
    vi.fn().mockResolvedValue({
      tasks: {
        total: 1,
        warnings: 1,
        errors: 0,
        byCode: {
          stale_queued: 0,
          stale_running: 0,
          lost: 0,
          delivery_failed: 0,
          missing_cleanup: 1,
          inconsistent_timestamps: 0,
        },
      },
      flows: {
        total: 0,
        warnings: 0,
        errors: 0,
        byCode: {
          restore_failed: 0,
          stale_running: 0,
          stale_waiting: 0,
          stale_blocked: 0,
          cancel_stuck: 0,
          missing_linked_tasks: 0,
          blocked_task_missing: 0,
          inconsistent_timestamps: 0,
        },
      },
    });
  const maintainTasks =
    params?.maintainTasks ??
    vi.fn().mockResolvedValue({
      apply: false,
      tasks: {
        reconciled: 0,
        recovered: 0,
        cleanupStamped: 1,
        pruned: 0,
      },
      flows: {
        reconciled: 0,
        pruned: 0,
      },
    });
  const checkpoint = {
    checkpointId: "checkpoint-1",
    sessionKey: "agent:main:main",
    sessionId: "session-current",
    createdAt: Date.now(),
    reason: "manual",
    tokensBefore: 1200,
    tokensAfter: 120,
    summary: "Before memory compaction",
    preCompaction: {
      sessionId: "session-before",
    },
    postCompaction: {
      sessionId: "session-current",
    },
  };
  const listSessionCheckpoints =
    params?.listSessionCheckpoints ??
    vi.fn().mockResolvedValue({
      key: "agent:main:main",
      checkpoints: [checkpoint],
    });
  const getSessionCheckpoint =
    params?.getSessionCheckpoint ??
    vi.fn().mockResolvedValue({
      key: "agent:main:main",
      checkpoint,
    });
  const branchSessionCheckpoint =
    params?.branchSessionCheckpoint ??
    vi.fn().mockResolvedValue({
      sourceKey: "agent:main:main",
      key: "agent:main:checkpoint:new",
      sessionId: "session-branch",
      checkpoint,
    });
  const restoreSessionCheckpoint =
    params?.restoreSessionCheckpoint ??
    vi.fn().mockResolvedValue({
      key: "agent:main:main",
      sessionId: "session-restored",
      checkpoint,
    });
  const setSession = params?.setSession ?? (vi.fn().mockResolvedValue(undefined) as SetSessionMock);
  const addUser = vi.fn();
  const addSystem = vi.fn();
  const requestRender = vi.fn();
  const noteLocalRunId = vi.fn();
  const noteLocalBtwRunId = vi.fn();
  const loadHistory =
    params?.loadHistory ?? (vi.fn().mockResolvedValue(undefined) as LoadHistoryMock);
  const refreshSessionInfo = params?.refreshSessionInfo ?? vi.fn().mockResolvedValue(undefined);
  const applySessionInfoFromPatch = params?.applySessionInfoFromPatch ?? vi.fn();
  const setActivityStatus = params?.setActivityStatus ?? (vi.fn() as SetActivityStatusMock);
  const openOverlay = vi.fn();
  const closeOverlay = vi.fn();
  const requestExit = vi.fn();
  const abortActive =
    params?.abortActive ?? (vi.fn().mockResolvedValue(undefined) as AbortActiveMock);
  const runAuthFlow: RunAuthFlow | undefined =
    params?.runAuthFlow ??
    (params?.opts?.local
      ? (vi.fn().mockResolvedValue({ exitCode: 0, signal: null }) as unknown as RunAuthFlow)
      : undefined);
  const state = {
    currentAgentId: "main",
    currentSessionKey: "agent:main:main",
    activeChatRunId: params?.activeChatRunId ?? null,
    pendingOptimisticUserMessage: params?.pendingOptimisticUserMessage ?? false,
    busyInputMode: params?.busyInputMode ?? "queue",
    queuedMessages: [] as QueuedMessage[],
    isConnected: params?.isConnected ?? true,
    sessionInfo: params?.sessionInfo ?? {},
    activityStatus: "idle",
  };

  const { handleCommand } = createCommandHandlers({
    client: {
      sendChat,
      steerChat,
      getGatewayStatus,
      patchSession,
      resetSession,
      listSessions,
      listPlugins,
      listTools,
      listSkills,
      listTasks,
      auditTasks,
      maintainTasks,
      listSessionCheckpoints,
      getSessionCheckpoint,
      branchSessionCheckpoint,
      restoreSessionCheckpoint,
    } as never,
    chatLog: { addUser, addSystem } as never,
    tui: { requestRender } as never,
    opts: params?.opts ?? {},
    state: state as never,
    deliverDefault: false,
    openOverlay,
    closeOverlay,
    refreshSessionInfo: refreshSessionInfo as never,
    loadHistory,
    setSession,
    refreshAgents: vi.fn(),
    abortActive,
    setActivityStatus,
    formatSessionKey: (key: string) => key,
    applySessionInfoFromPatch: applySessionInfoFromPatch as never,
    noteLocalRunId,
    noteLocalBtwRunId,
    forgetLocalRunId: vi.fn(),
    forgetLocalBtwRunId: vi.fn(),
    runAuthFlow,
    requestExit,
  });

  return {
    handleCommand,
    getGatewayStatus,
    sendChat,
    steerChat,
    openOverlay,
    closeOverlay,
    patchSession,
    resetSession,
    listSessions,
    listPlugins,
    listTools,
    listSkills,
    listTasks,
    auditTasks,
    maintainTasks,
    listSessionCheckpoints,
    getSessionCheckpoint,
    branchSessionCheckpoint,
    restoreSessionCheckpoint,
    setSession,
    addUser,
    addSystem,
    requestRender,
    loadHistory,
    refreshSessionInfo,
    applySessionInfoFromPatch,
    runAuthFlow,
    setActivityStatus,
    noteLocalRunId,
    noteLocalBtwRunId,
    requestExit,
    abortActive,
    state,
  };
}

describe("tui command handlers", () => {
  it("renders the sending indicator before chat.send resolves", async () => {
    let resolveSend: (value: { runId: string }) => void = () => {
      throw new Error("sendChat promise resolver was not initialized");
    };
    const sendPromise = new Promise<{ runId: string }>((resolve) => {
      resolveSend = (value) => resolve(value);
    });
    const sendChat = vi.fn(() => sendPromise);
    const setActivityStatus = vi.fn();

    const { handleCommand, requestRender } = createHarness({
      sendChat,
      setActivityStatus,
    });

    const pending = handleCommand("/context detail");
    await Promise.resolve();

    expect(setActivityStatus).toHaveBeenCalledWith("sending");
    const sendingOrder = setActivityStatus.mock.invocationCallOrder[0] ?? 0;
    const renderOrders = requestRender.mock.invocationCallOrder;
    expect(renderOrders.some((order) => order > sendingOrder)).toBe(true);

    resolveSend({ runId: "r1" });
    await pending;
    expect(setActivityStatus).toHaveBeenCalledWith("waiting");
  });

  it("does not restore waiting after a fast command already finalized", async () => {
    let harness: ReturnType<typeof createHarness>;
    const setActivityStatus = vi.fn();
    const sendChat = vi.fn(async () => {
      harness.state.pendingOptimisticUserMessage = false;
      harness.state.activeChatRunId = null;
      harness.state.activityStatus = "idle";
      setActivityStatus("idle");
      return { runId: "r1" };
    });
    harness = createHarness({ sendChat, setActivityStatus });

    await harness.handleCommand("/status");

    expect(setActivityStatus).toHaveBeenCalledWith("sending");
    expect(setActivityStatus).toHaveBeenCalledWith("idle");
    expect(setActivityStatus).not.toHaveBeenCalledWith("waiting");
  });

  it("forwards unknown slash commands to the gateway", async () => {
    const { handleCommand, sendChat, addUser, addSystem, requestRender } = createHarness();

    await handleCommand("/unregistered-command");

    expect(addSystem).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/unregistered-command");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/unregistered-command",
      }),
    );
    expect(requestRender).toHaveBeenCalled();
  });

  it("shows compact help by default and full help on request", async () => {
    const { handleCommand, addSystem } = createHarness();

    await handleCommand("/help");
    await handleCommand("/help all");

    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("More: /help all"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("/elevated <on|off|ask|full>"));
  });

  it("opens a context mode selector for /context without sending immediately", async () => {
    const { handleCommand, sendChat, openOverlay } = createHarness();

    await handleCommand("/context");

    expect(sendChat).not.toHaveBeenCalled();
    expect(openOverlay).toHaveBeenCalledTimes(1);
  });

  it("sends the selected context mode through the gateway command path", async () => {
    const { handleCommand, sendChat, openOverlay, closeOverlay } = createHarness();

    await handleCommand("/context");
    const selector = openOverlay.mock.calls[0]?.[0] as SelectableOverlay | undefined;
    selector?.onSelect?.({ value: "detail", label: "detail" });
    await flushAsyncSelect();

    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/context detail",
      }),
    );
    expect(closeOverlay).toHaveBeenCalledTimes(1);
  });

  it("opens the session picker with a query filter", async () => {
    const { handleCommand, listSessions, openOverlay } = createHarness();

    await handleCommand("/sessions research");

    expect(listSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "main",
        includeDerivedTitles: true,
        includeLastMessage: true,
        search: "research",
      }),
    );
    const selector = openOverlay.mock.calls[0]?.[0] as SelectableOverlay | undefined;
    expect(selector?.getFilterText?.()).toBe("research");
  });

  it("renders a local compact tool catalog without sending a chat turn", async () => {
    const { handleCommand, listTools, sendChat, addUser, addSystem } = createHarness();

    await handleCommand("/tools");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/tools");
    expect(listTools).toHaveBeenCalledWith({ agentId: "main", includePlugins: false });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Tools: 1 tool"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Files: 1 tool (read)"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Use /tools verbose"));
  });

  it("renders compact skills with useful names", async () => {
    const { handleCommand, listSkills, sendChat, addUser, addSystem } = createHarness();

    await handleCommand("/skills");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/skills");
    expect(listSkills).toHaveBeenCalledWith({ agentId: "main" });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("workspace: 1 skill (codex)"));
  });

  it("renders a local verbose skill catalog without sending a chat turn", async () => {
    const { handleCommand, listSkills, sendChat, addUser, addSystem } = createHarness();

    await handleCommand("/skills verbose");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/skills verbose");
    expect(listSkills).toHaveBeenCalledWith({ agentId: "main" });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Skills: 1 skill visible"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("codex: ready"));
  });

  it("renders plugin status locally without requiring command config", async () => {
    const { handleCommand, listPlugins, sendChat, addUser, addSystem } = createHarness();

    await handleCommand("/plugins");
    await handleCommand("/plugins show telegram");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/plugins");
    expect(addUser).toHaveBeenCalledWith("/plugins show telegram");
    expect(listPlugins).toHaveBeenCalledTimes(2);
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Plugins: 1 plugin"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Plugin: Telegram (telegram)"));
  });

  it("renders local background tasks without starting an agent turn", async () => {
    const { handleCommand, listTasks, sendChat, addSystem } = createHarness();

    await handleCommand("/tasks running");

    expect(sendChat).not.toHaveBeenCalled();
    expect(listTasks).toHaveBeenCalledWith(expect.objectContaining({ status: "running" }));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Tasks: 1 task"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("task-1: subagent running"));
  });

  it("shows subagents from the task runtime", async () => {
    const { handleCommand, listTasks, sendChat, addSystem } = createHarness();

    await handleCommand("/subagents");

    expect(sendChat).not.toHaveBeenCalled();
    expect(listTasks).toHaveBeenCalledWith(expect.objectContaining({ runtime: "subagent" }));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Subagents: 1 task"));
    expect(addSystem).toHaveBeenCalledWith(
      expect.stringContaining("wait for the parent summary instead of polling"),
    );
  });

  it("previews and applies recovery from the local task maintenance loop", async () => {
    const auditTasks = vi
      .fn()
      .mockResolvedValueOnce({
        tasks: {
          total: 1,
          warnings: 1,
          errors: 0,
          byCode: {
            stale_queued: 0,
            stale_running: 0,
            lost: 0,
            delivery_failed: 0,
            missing_cleanup: 1,
            inconsistent_timestamps: 0,
          },
        },
        flows: {
          total: 0,
          warnings: 0,
          errors: 0,
          byCode: {
            restore_failed: 0,
            stale_running: 0,
            stale_waiting: 0,
            stale_blocked: 0,
            cancel_stuck: 0,
            missing_linked_tasks: 0,
            blocked_task_missing: 0,
            inconsistent_timestamps: 0,
          },
        },
      })
      .mockResolvedValueOnce({
        tasks: {
          total: 1,
          warnings: 1,
          errors: 0,
          byCode: {
            stale_queued: 0,
            stale_running: 0,
            lost: 0,
            delivery_failed: 0,
            missing_cleanup: 1,
            inconsistent_timestamps: 0,
          },
        },
        flows: {
          total: 0,
          warnings: 0,
          errors: 0,
          byCode: {
            restore_failed: 0,
            stale_running: 0,
            stale_waiting: 0,
            stale_blocked: 0,
            cancel_stuck: 0,
            missing_linked_tasks: 0,
            blocked_task_missing: 0,
            inconsistent_timestamps: 0,
          },
        },
      })
      .mockResolvedValueOnce({
        tasks: {
          total: 0,
          warnings: 0,
          errors: 0,
          byCode: {
            stale_queued: 0,
            stale_running: 0,
            lost: 0,
            delivery_failed: 0,
            missing_cleanup: 0,
            inconsistent_timestamps: 0,
          },
        },
        flows: {
          total: 0,
          warnings: 0,
          errors: 0,
          byCode: {
            restore_failed: 0,
            stale_running: 0,
            stale_waiting: 0,
            stale_blocked: 0,
            cancel_stuck: 0,
            missing_linked_tasks: 0,
            blocked_task_missing: 0,
            inconsistent_timestamps: 0,
          },
        },
      });
    const maintainTasks = vi
      .fn()
      .mockResolvedValueOnce({
        apply: false,
        tasks: { reconciled: 0, recovered: 0, cleanupStamped: 1, pruned: 0 },
        flows: { reconciled: 0, pruned: 0 },
      })
      .mockResolvedValueOnce({
        apply: true,
        tasks: { reconciled: 1, recovered: 0, cleanupStamped: 0, pruned: 0 },
        flows: { reconciled: 0, pruned: 0 },
      });
    const { handleCommand, addSystem } = createHarness({ auditTasks, maintainTasks });

    await handleCommand("/recover");
    await handleCommand("/recover apply");

    expect(auditTasks).toHaveBeenCalledTimes(3);
    expect(maintainTasks).toHaveBeenNthCalledWith(1, { apply: false });
    expect(maintainTasks).toHaveBeenNthCalledWith(2, { apply: true });
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Self-healing scan"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("repair available"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Self-healing apply"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("clean after repair"));
  });

  it("lists rollback checkpoints without starting an agent turn", async () => {
    const { handleCommand, listSessionCheckpoints, sendChat, addSystem } = createHarness();

    await handleCommand("/rollback");

    expect(sendChat).not.toHaveBeenCalled();
    expect(listSessionCheckpoints).toHaveBeenCalledWith({ key: "agent:main:main" });
    expect(addSystem).toHaveBeenCalledWith(
      expect.stringContaining("Rollback checkpoints: 1 checkpoint"),
    );
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("checkpoint-1"));
  });

  it("previews rollback restore until confirm is explicit", async () => {
    const { handleCommand, getSessionCheckpoint, restoreSessionCheckpoint, addSystem } =
      createHarness();

    await handleCommand("/rollback restore checkpoint-1");

    expect(getSessionCheckpoint).toHaveBeenCalledWith({
      key: "agent:main:main",
      checkpointId: "checkpoint-1",
    });
    expect(restoreSessionCheckpoint).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("Checkpoint: checkpoint-1"));
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("restore preview only"));
  });

  it("branches rollback checkpoints and switches to the new branch", async () => {
    const { handleCommand, branchSessionCheckpoint, setSession, sendChat, addSystem } =
      createHarness();

    await handleCommand("/rollback branch checkpoint-1");

    expect(sendChat).not.toHaveBeenCalled();
    expect(branchSessionCheckpoint).toHaveBeenCalledWith({
      key: "agent:main:main",
      checkpointId: "checkpoint-1",
    });
    expect(addSystem).toHaveBeenCalledWith("created checkpoint branch: agent:main:checkpoint:new");
    expect(setSession).toHaveBeenCalledWith("agent:main:checkpoint:new");
  });

  it("restores rollback checkpoints only after confirm and no active run", async () => {
    const { handleCommand, restoreSessionCheckpoint, setSession, addSystem } = createHarness();

    await handleCommand("/rollback restore checkpoint-1 confirm");

    expect(restoreSessionCheckpoint).toHaveBeenCalledWith({
      key: "agent:main:main",
      checkpointId: "checkpoint-1",
    });
    expect(addSystem).toHaveBeenCalledWith("restored agent:main:main from checkpoint checkpoint-1");
    expect(setSession).toHaveBeenCalledWith("agent:main:main");
  });

  it("blocks checkpoint restore while a run is active", async () => {
    const { handleCommand, restoreSessionCheckpoint, addSystem } = createHarness({
      activeChatRunId: "run-main",
    });

    await handleCommand("/rollback restore checkpoint-1 confirm");

    expect(restoreSessionCheckpoint).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("stop the active run before restoring a checkpoint");
  });

  it("forwards /context list directly", async () => {
    const { handleCommand, sendChat, openOverlay } = createHarness();

    await handleCommand("/context list");

    expect(openOverlay).not.toHaveBeenCalled();
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/context list",
      }),
    );
  });

  it("forwards /context help directly", async () => {
    const { handleCommand, sendChat, openOverlay } = createHarness();

    await handleCommand("/context help");

    expect(openOverlay).not.toHaveBeenCalled();
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/context help",
      }),
    );
  });

  it("forwards /status to the shared gateway command path", async () => {
    const { handleCommand, sendChat, addUser, addSystem } = createHarness();

    await handleCommand("/status");

    expect(addSystem).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/status");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/status",
      }),
    );
  });

  it("forwards shared session lifecycle subcommands instead of switching sessions", async () => {
    const { handleCommand, sendChat, setSession, addUser } = createHarness();

    await handleCommand("/session idle 2h");
    await handleCommand("/session max-age off");

    expect(setSession).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenNthCalledWith(1, "/session idle 2h");
    expect(addUser).toHaveBeenNthCalledWith(2, "/session max-age off");
    expect(sendChat).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/session idle 2h",
      }),
    );
    expect(sendChat).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/session max-age off",
      }),
    );
  });

  it("forwards /models arguments to the shared model listing command", async () => {
    const { handleCommand, sendChat, openOverlay, addUser } = createHarness();

    await handleCommand("/models openai-codex limit=10");

    expect(openOverlay).not.toHaveBeenCalled();
    expect(addUser).toHaveBeenCalledWith("/models openai-codex limit=10");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/models openai-codex limit=10",
      }),
    );
  });

  it("forwards /usage cost to the shared cost summary command", async () => {
    const { handleCommand, sendChat, patchSession, addUser, addSystem } = createHarness();

    await handleCommand("/usage cost");

    expect(patchSession).not.toHaveBeenCalled();
    expect(addSystem).not.toHaveBeenCalledWith(expect.stringContaining("usage footer"));
    expect(addUser).toHaveBeenCalledWith("/usage cost");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:main",
        message: "/usage cost",
      }),
    );
  });

  it("keeps gateway diagnostics on /gateway-status", async () => {
    const { handleCommand, getGatewayStatus, addSystem, addUser, sendChat } = createHarness({
      getGatewayStatus: vi.fn().mockResolvedValue({
        runtimeVersion: "1.2.3",
        sessions: { count: 2, defaults: { model: "gpt-5.4", contextTokens: 200000 } },
      }),
    });

    await handleCommand("/gateway-status");

    expect(getGatewayStatus).toHaveBeenCalledTimes(1);
    expect(addUser).not.toHaveBeenCalled();
    expect(sendChat).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("Gateway status");
    expect(addSystem).toHaveBeenCalledWith("Version: 1.2.3");
  });

  it("shows local context limits without sending an agent turn", async () => {
    const { handleCommand, addSystem, addUser, sendChat } = createHarness({
      sessionInfo: {
        modelProvider: "openai-codex",
        model: "gpt-5.5",
        totalTokens: 44000,
        contextTokens: 272000,
      },
    });

    await handleCommand("/limit");

    expect(addUser).toHaveBeenCalledWith("/limit");
    expect(sendChat).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith(
      [
        "Limits",
        "- Context window: tokens 44k/272k (228k left, 16%)",
        "- Model: openai-codex/gpt-5.5",
        "- This is the model context window, not your provider account quota.",
        "- Provider quotas/rate limits come from the provider and may not be exposed to Kova.",
        "- Shell check when available: kova status --usage",
      ].join("\n"),
    );
  });

  it("returns to Crestodian with an optional request", async () => {
    const { handleCommand, addSystem, requestExit, sendChat } = createHarness();

    await handleCommand("/crestodian restart gateway");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("returning to Crestodian with request: restart gateway");
    expect(requestExit).toHaveBeenCalledWith({
      exitReason: "return-to-crestodian",
      crestodianMessage: "restart gateway",
    });
  });

  it("leaves a Crestodian breadcrumb after switching agents", async () => {
    const { handleCommand, addSystem, setSession, state } = createHarness();

    await handleCommand("/agent Work");

    expect(state.currentAgentId).toBe("work");
    expect(setSession).toHaveBeenCalledWith("");
    expect(addSystem).toHaveBeenCalledWith("agent set to work; use /crestodian to return");
  });

  it("defers local run binding until gateway events provide a real run id", async () => {
    const { handleCommand, noteLocalRunId, state } = createHarness();

    await handleCommand("/context detail");

    expect(noteLocalRunId).not.toHaveBeenCalled();
    expect(state.activeChatRunId).toBeNull();
    expect(state.pendingOptimisticUserMessage).toBe(true);
  });

  it("sends /btw without hijacking the active main run", async () => {
    const setActivityStatus = vi.fn();
    const { handleCommand, sendChat, addUser, noteLocalRunId, noteLocalBtwRunId, state } =
      createHarness({
        activeChatRunId: "run-main",
        setActivityStatus,
      });

    await handleCommand("/btw what changed?");

    expect(addUser).not.toHaveBeenCalled();
    expect(noteLocalRunId).not.toHaveBeenCalled();
    expect(noteLocalBtwRunId).toHaveBeenCalledTimes(1);
    expect(state.activeChatRunId).toBe("run-main");
    expect(setActivityStatus).not.toHaveBeenCalledWith("sending");
    expect(setActivityStatus).not.toHaveBeenCalledWith("waiting");
    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "/btw what changed?",
      }),
    );
  });

  it("queues normal messages while a run is active by default", async () => {
    const setActivityStatus = vi.fn();
    const { handleCommand, sendChat, addUser, addSystem, state } = createHarness({
      activeChatRunId: "run-main",
      setActivityStatus,
    });

    await handleCommand("second prompt");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addUser).not.toHaveBeenCalled();
    expect(state.queuedMessages).toHaveLength(1);
    expect(state.queuedMessages[0]?.text).toBe("second prompt");
    expect(addSystem).toHaveBeenCalledWith(
      "run active; queued follow-up (1). /busy status shows the queue.",
    );
    expect(setActivityStatus).toHaveBeenCalledWith("1 queued follow-up");
  });

  it("can switch busy input to interrupt mode", async () => {
    const { handleCommand, addSystem, state } = createHarness({
      activeChatRunId: "run-main",
    });

    await handleCommand("/busy interrupt");

    expect(state.busyInputMode).toBe("interrupt");
    expect(addSystem).toHaveBeenCalledWith(
      "busy input set to interrupt; new messages replace the active run",
    );
  });

  it("explains the current busy input mode", async () => {
    const { handleCommand, addSystem } = createHarness({
      busyInputMode: "queue",
    });

    await handleCommand("/busy status");

    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("busy input: queue"));
    expect(addSystem).toHaveBeenCalledWith(
      expect.stringContaining("new messages wait for the active run to finish"),
    );
    expect(addSystem).toHaveBeenCalledWith(expect.stringContaining("/busy interrupt"));
  });

  it("can switch busy input to steer mode", async () => {
    const { handleCommand, addSystem, state } = createHarness({
      activeChatRunId: "run-main",
    });

    await handleCommand("/busy steer");

    expect(state.busyInputMode).toBe("steer");
    expect(addSystem).toHaveBeenCalledWith(
      "busy input set to steer; new messages are injected into the active run when possible",
    );
  });

  it("steers active-run messages when steer mode is available", async () => {
    const steerChat = vi.fn().mockResolvedValue({ ok: true });
    const setActivityStatus = vi.fn();
    const { handleCommand, sendChat, addUser, addSystem, state } = createHarness({
      activeChatRunId: "run-main",
      busyInputMode: "steer",
      steerChat,
      setActivityStatus,
    });

    await handleCommand("nudge current");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addUser).not.toHaveBeenCalled();
    expect(steerChat).toHaveBeenCalledWith({
      sessionKey: "agent:main:main",
      message: "nudge current",
    });
    expect(addSystem).toHaveBeenCalledWith("steered active run");
    expect(setActivityStatus).toHaveBeenCalledWith("steered active run");
    expect(state.queuedMessages).toHaveLength(0);
  });

  it("falls back to queue when steering is unavailable", async () => {
    const steerChat = vi.fn().mockResolvedValue({ ok: false, reason: "not_streaming" });
    const { handleCommand, sendChat, addSystem, state } = createHarness({
      activeChatRunId: "run-main",
      busyInputMode: "steer",
      steerChat,
    });

    await handleCommand("nudge later");

    expect(sendChat).not.toHaveBeenCalled();
    expect(state.queuedMessages).toHaveLength(1);
    expect(state.queuedMessages[0]?.text).toBe("nudge later");
    expect(addSystem).toHaveBeenCalledWith(
      "steer unavailable (not_streaming); queued follow-up instead",
    );
    expect(addSystem).toHaveBeenCalledWith(
      "run active; queued follow-up (1). /busy status shows the queue.",
    );
  });

  it("sends active-run messages immediately in interrupt mode", async () => {
    const { handleCommand, sendChat, addUser, state } = createHarness({
      activeChatRunId: "run-main",
      busyInputMode: "interrupt",
    });

    await handleCommand("replace current");

    expect(sendChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "replace current",
      }),
    );
    expect(addUser).toHaveBeenCalledWith("replace current");
    expect(state.queuedMessages).toHaveLength(0);
  });

  it("clears queued busy follow-ups", async () => {
    const { handleCommand, addSystem, state } = createHarness();
    state.queuedMessages.push({
      runId: "queued-1",
      text: "later",
      mode: "followUp",
    });

    await handleCommand("/busy clear");

    expect(state.queuedMessages).toEqual([]);
    expect(addSystem).toHaveBeenCalledWith("cleared 1 queued follow-up");
  });

  it("stops the active run with canonical and legacy lifecycle commands", async () => {
    const abortActive = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { handleCommand } = createHarness({ abortActive });

    await handleCommand("/stop");
    await handleCommand("/abort");

    expect(abortActive).toHaveBeenCalledTimes(2);
  });

  it("creates unique session for /new and resets shared session for /reset", async () => {
    const loadHistory = vi.fn().mockResolvedValue(undefined);
    const setSessionMock = vi.fn().mockResolvedValue(undefined) as SetSessionMock;
    const { handleCommand, resetSession } = createHarness({
      loadHistory,
      setSession: setSessionMock,
    });

    await handleCommand("/new");
    await handleCommand("/reset");

    // /new creates a unique session key (isolates TUI client) (#39217)
    expect(setSessionMock).toHaveBeenCalledTimes(1);
    expect(setSessionMock).toHaveBeenCalledWith(
      expect.stringMatching(/^tui-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),
    );
    // /reset still resets the shared session
    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(resetSession).toHaveBeenCalledWith("agent:main:main", "reset");
    expect(loadHistory).toHaveBeenCalledTimes(1); // /reset calls loadHistory directly; /new does so indirectly via setSession
  });

  it("applies model arguments when /new creates an isolated TUI session", async () => {
    const setSessionMock = vi.fn().mockResolvedValue(undefined) as SetSessionMock;
    const patchSession = vi.fn().mockResolvedValue({
      resolved: { modelProvider: "openai-codex", model: "gpt-5.5" },
    });
    const refreshSessionInfo = vi.fn().mockResolvedValue(undefined);
    const applySessionInfoFromPatch = vi.fn();
    const { handleCommand } = createHarness({
      setSession: setSessionMock,
      patchSession,
      refreshSessionInfo,
      applySessionInfoFromPatch,
    });

    await handleCommand("/new openai-codex/gpt-5.5");

    const newKey = setSessionMock.mock.calls[0]?.[0];
    expect(newKey).toEqual(expect.stringMatching(/^tui-/));
    expect(patchSession).toHaveBeenCalledWith({
      key: newKey,
      model: "openai-codex/gpt-5.5",
    });
    expect(applySessionInfoFromPatch).toHaveBeenCalledWith({
      resolved: { modelProvider: "openai-codex", model: "gpt-5.5" },
    });
    expect(refreshSessionInfo).toHaveBeenCalledTimes(1);
  });

  it("reports send failures and marks activity status as error", async () => {
    const setActivityStatus = vi.fn();
    const { handleCommand, addSystem, state } = createHarness({
      sendChat: vi.fn().mockRejectedValue(new Error("gateway down")),
      setActivityStatus,
    });

    await handleCommand("/context detail");

    expect(addSystem).toHaveBeenCalledWith("send failed: Error: gateway down");
    expect(setActivityStatus).toHaveBeenLastCalledWith("error");
    expect(state.pendingOptimisticUserMessage).toBe(false);
  });

  it("sanitizes control sequences in /new and /reset failures", async () => {
    const setSession = vi.fn().mockRejectedValue(new Error("\u001b[31mboom\u001b[0m"));
    const resetSession = vi.fn().mockRejectedValue(new Error("\u001b[31mboom\u001b[0m"));
    const { handleCommand, addSystem } = createHarness({
      setSession,
      resetSession,
    });

    await handleCommand("/new");
    await handleCommand("/reset");

    expect(addSystem).toHaveBeenNthCalledWith(1, "new session failed: Error: boom");
    expect(addSystem).toHaveBeenNthCalledWith(2, "reset failed: Error: boom");
  });

  it("reports disconnected status and skips gateway send when offline", async () => {
    const { handleCommand, sendChat, addUser, addSystem, setActivityStatus } = createHarness({
      isConnected: false,
    });

    await handleCommand("/context detail");

    expect(sendChat).not.toHaveBeenCalled();
    expect(addUser).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("not connected to gateway — message not sent");
    expect(setActivityStatus).toHaveBeenLastCalledWith("disconnected");
  });

  it("runs /auth through the local auth flow and refreshes session info", async () => {
    const refreshSessionInfo = vi.fn().mockResolvedValue(undefined);
    const runAuthFlow = vi.fn().mockResolvedValue({ exitCode: 0, signal: null });
    const { handleCommand, addSystem, setActivityStatus } = createHarness({
      opts: { local: true },
      refreshSessionInfo,
      runAuthFlow,
    });

    await handleCommand("/auth openai-codex");

    expect(runAuthFlow).toHaveBeenCalledWith({ provider: "openai-codex" });
    expect(refreshSessionInfo).toHaveBeenCalledTimes(1);
    expect(addSystem).toHaveBeenCalledWith(
      "opening auth flow for openai-codex; TUI will resume when it exits",
    );
    expect(addSystem).toHaveBeenCalledWith("auth flow finished for openai-codex");
    expect(setActivityStatus).toHaveBeenLastCalledWith("idle");
  });

  it("rejects /auth in non-local mode", async () => {
    const { handleCommand, addSystem } = createHarness();

    await handleCommand("/auth");

    expect(addSystem).toHaveBeenCalledWith("auth login is only available in local embedded mode");
  });

  it("blocks /auth while an optimistic run is still pending", async () => {
    const runAuthFlow = vi.fn().mockResolvedValue({ exitCode: 0, signal: null });
    const { handleCommand, addSystem } = createHarness({
      opts: { local: true },
      pendingOptimisticUserMessage: true,
      runAuthFlow,
    });

    await handleCommand("/auth openai-codex");

    expect(runAuthFlow).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("abort the current run before /auth");
  });

  it("rejects invalid /activation values before patching the session", async () => {
    const { handleCommand, patchSession, addSystem } = createHarness();

    await handleCommand("/activation sometimes");

    expect(patchSession).not.toHaveBeenCalled();
    expect(addSystem).toHaveBeenCalledWith("usage: /activation <mention|always>");
  });

  it("patches the session for valid /activation values", async () => {
    const refreshSessionInfo = vi.fn().mockResolvedValue(undefined);
    const applySessionInfoFromPatch = vi.fn();
    const patchSession = vi.fn().mockResolvedValue({ groupActivation: "always" });
    const { handleCommand, addSystem } = createHarness({
      patchSession,
      refreshSessionInfo,
      applySessionInfoFromPatch,
    });

    await handleCommand("/activation always");

    expect(patchSession).toHaveBeenCalledWith({
      key: "agent:main:main",
      groupActivation: "always",
    });
    expect(addSystem).toHaveBeenCalledWith("activation set to always");
    expect(applySessionInfoFromPatch).toHaveBeenCalledWith({ groupActivation: "always" });
    expect(refreshSessionInfo).toHaveBeenCalledTimes(1);
  });
});
