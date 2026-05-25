import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PluginHookGatewayContext,
  PluginHookGatewayStartEvent,
} from "../plugins/hook-types.js";

const hoisted = vi.hoisted(() => {
  const startPluginServices = vi.fn(async () => null);
  const startGmailWatcherWithLogs = vi.fn(async () => undefined);
  const loadInternalHooks = vi.fn(async () => 0);
  const setInternalHooksEnabled = vi.fn();
  const hasInternalHookListeners = vi.fn(() => false);
  const startupHookEvent = { type: "gateway", action: "startup", sessionKey: "gateway:startup" };
  const createInternalHookEvent = vi.fn(() => startupHookEvent);
  const triggerInternalHook = vi.fn(async () => undefined);
  const startGatewayMemoryBackend = vi.fn(async () => undefined);
  const scheduleGatewayUpdateCheck = vi.fn(() => () => {});
  const startGatewayTailscaleExposure = vi.fn(async () => null);
  const logGatewayStartup = vi.fn();
  const loadGatewayModelCatalog = vi.fn(async () => []);
  const scheduleSubagentOrphanRecovery = vi.fn();
  const shouldWakeFromRestartSentinel = vi.fn(() => false);
  const scheduleRestartSentinelWake = vi.fn();
  const refreshLatestUpdateRestartSentinel = vi.fn(async () => null);
  const getAcpRuntimeBackend = vi.fn<(id?: string) => unknown>(() => null);
  const reconcilePendingSessionIdentities = vi.fn(async () => ({
    checked: 0,
    resolved: 0,
    failed: 0,
  }));
  return {
    startPluginServices,
    startGmailWatcherWithLogs,
    loadInternalHooks,
    setInternalHooksEnabled,
    hasInternalHookListeners,
    startupHookEvent,
    createInternalHookEvent,
    triggerInternalHook,
    startGatewayMemoryBackend,
    scheduleGatewayUpdateCheck,
    startGatewayTailscaleExposure,
    logGatewayStartup,
    loadGatewayModelCatalog,
    scheduleSubagentOrphanRecovery,
    shouldWakeFromRestartSentinel,
    scheduleRestartSentinelWake,
    refreshLatestUpdateRestartSentinel,
    getAcpRuntimeBackend,
    reconcilePendingSessionIdentities,
  };
});

vi.mock("../agents/session-dirs.js", () => ({
  resolveAgentSessionDirs: vi.fn(async () => []),
}));

vi.mock("../agents/session-write-lock.js", () => ({
  cleanStaleLockFiles: vi.fn(async () => undefined),
}));

vi.mock("../agents/subagent-registry.js", () => ({
  scheduleSubagentOrphanRecovery: hoisted.scheduleSubagentOrphanRecovery,
}));

vi.mock("../config/paths.js", async () => {
  const actual = await vi.importActual<typeof import("../config/paths.js")>("../config/paths.js");
  return {
    ...actual,
    STATE_DIR: "/tmp/kova-state",
    resolveConfigPath: vi.fn(() => "/tmp/kova-state/kova.json"),
    resolveGatewayPort: vi.fn(() => 18789),
    resolveStateDir: vi.fn(() => "/tmp/kova-state"),
  };
});

vi.mock("../hooks/gmail-watcher-lifecycle.js", () => ({
  startGmailWatcherWithLogs: hoisted.startGmailWatcherWithLogs,
}));

vi.mock("../hooks/internal-hooks.js", () => ({
  createInternalHookEvent: hoisted.createInternalHookEvent,
  hasInternalHookListeners: hoisted.hasInternalHookListeners,
  setInternalHooksEnabled: hoisted.setInternalHooksEnabled,
  triggerInternalHook: hoisted.triggerInternalHook,
}));

vi.mock("../hooks/loader.js", () => ({
  loadInternalHooks: hoisted.loadInternalHooks,
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  runGlobalGatewayStartSafely: vi.fn(async () => undefined),
}));

vi.mock("../plugins/services.js", () => ({
  startPluginServices: hoisted.startPluginServices,
}));

vi.mock("../acp/control-plane/manager.js", () => ({
  getAcpSessionManager: vi.fn(() => ({
    reconcilePendingSessionIdentities: hoisted.reconcilePendingSessionIdentities,
  })),
}));

vi.mock("../acp/runtime/registry.js", () => ({
  getAcpRuntimeBackend: hoisted.getAcpRuntimeBackend,
}));

vi.mock("./server-restart-sentinel.js", () => ({
  refreshLatestUpdateRestartSentinel: hoisted.refreshLatestUpdateRestartSentinel,
  scheduleRestartSentinelWake: hoisted.scheduleRestartSentinelWake,
  shouldWakeFromRestartSentinel: hoisted.shouldWakeFromRestartSentinel,
}));

vi.mock("./server-startup-memory.js", () => ({
  startGatewayMemoryBackend: hoisted.startGatewayMemoryBackend,
}));

vi.mock("./server-startup-log.js", () => ({
  logGatewayStartup: hoisted.logGatewayStartup,
}));

vi.mock("./server-model-catalog.js", () => ({
  loadGatewayModelCatalog: hoisted.loadGatewayModelCatalog,
}));

vi.mock("../infra/update-startup.js", () => ({
  scheduleGatewayUpdateCheck: hoisted.scheduleGatewayUpdateCheck,
}));

vi.mock("./server-tailscale.js", () => ({
  startGatewayTailscaleExposure: hoisted.startGatewayTailscaleExposure,
}));

const { startGatewayPostAttachRuntime, startGatewaySidecars } =
  await import("./server-startup-post-attach.js");

type PostAttachParams = Parameters<typeof startGatewayPostAttachRuntime>[0];
type PostAttachRuntimeDeps = NonNullable<Parameters<typeof startGatewayPostAttachRuntime>[1]>;

describe("startGatewayPostAttachRuntime", () => {
  beforeEach(() => {
    vi.stubEnv("KOVA_SKIP_CHANNELS", "0");
    vi.stubEnv("KOVA_SKIP_PROVIDERS", "0");
    vi.stubEnv("KOVA_SKIP_STARTUP_MODEL_PREWARM", "0");
    hoisted.startPluginServices.mockClear();
    hoisted.startGmailWatcherWithLogs.mockClear();
    hoisted.loadInternalHooks.mockClear();
    hoisted.setInternalHooksEnabled.mockClear();
    hoisted.hasInternalHookListeners.mockReset();
    hoisted.hasInternalHookListeners.mockReturnValue(false);
    hoisted.createInternalHookEvent.mockClear();
    hoisted.triggerInternalHook.mockClear();
    hoisted.startGatewayMemoryBackend.mockClear();
    hoisted.scheduleGatewayUpdateCheck.mockClear();
    hoisted.startGatewayTailscaleExposure.mockClear();
    hoisted.logGatewayStartup.mockClear();
    hoisted.loadGatewayModelCatalog.mockClear();
    hoisted.scheduleSubagentOrphanRecovery.mockClear();
    hoisted.shouldWakeFromRestartSentinel.mockReturnValue(false);
    hoisted.scheduleRestartSentinelWake.mockClear();
    hoisted.getAcpRuntimeBackend.mockReset();
    hoisted.getAcpRuntimeBackend.mockReturnValue(null);
    hoisted.reconcilePendingSessionIdentities.mockClear();
  });

  it("re-enables startup-gated methods after post-attach sidecars start", async () => {
    const unavailableGatewayMethods = new Set<string>(["chat.history", "models.list"]);
    const onSidecarsReady = vi.fn();
    const log = { info: vi.fn(), warn: vi.fn() };

    await startGatewayPostAttachRuntime({
      ...createPostAttachParams(),
      log,
      unavailableGatewayMethods,
      onSidecarsReady,
    });

    await vi.waitFor(() => {
      expect(onSidecarsReady).toHaveBeenCalledTimes(1);
    });
    expect([...unavailableGatewayMethods]).toEqual([]);
    expect(hoisted.startPluginServices).toHaveBeenCalledTimes(1);
    expect(hoisted.loadInternalHooks).not.toHaveBeenCalled();
    expect(hoisted.setInternalHooksEnabled).not.toHaveBeenCalled();
    expect(hoisted.logGatewayStartup).toHaveBeenCalledWith(
      expect.objectContaining({ loadedPluginIds: ["beta", "alpha"] }),
    );
    expect(log.info).toHaveBeenCalledWith("connectors: ready");
    expect(hoisted.startGatewayMemoryBackend).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(hoisted.loadGatewayModelCatalog).toHaveBeenCalledTimes(1);
    });
  });

  it("starts sidecars while startup logging is still pending", async () => {
    const events: string[] = [];
    let finishStartupLog: (() => void) | undefined;
    const logGatewayStartup = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          events.push("startup-log-start");
          finishStartupLog = () => {
            events.push("startup-log-end");
            resolve();
          };
        }),
    );
    const startGatewaySidecars = vi.fn(async () => {
      events.push("sidecars");
      return { pluginServices: null };
    });

    const runtimePromise = startGatewayPostAttachRuntime(
      createPostAttachParams(),
      createPostAttachRuntimeDeps({
        logGatewayStartup,
        refreshLatestUpdateRestartSentinel: vi.fn(async () => null),
        startGatewaySidecars,
      }),
    );

    await vi.waitFor(() => {
      expect(logGatewayStartup).toHaveBeenCalledTimes(1);
      expect(startGatewaySidecars).toHaveBeenCalledTimes(1);
    });
    expect(events).toEqual(["startup-log-start", "sidecars"]);

    if (!finishStartupLog) {
      throw new Error("Expected startup log release callback to be initialized");
    }
    finishStartupLog();
    await runtimePromise;

    expect(events).toEqual(["startup-log-start", "sidecars", "startup-log-end"]);
  });

  it("loads deferred startup plugins before startup log and sidecars use the registry", async () => {
    const initialRegistry = {
      plugins: [{ id: "cold", status: "disabled" }],
    } as never;
    const loadedRegistry = {
      plugins: [
        { id: "telegram", status: "loaded" },
        { id: "browser", status: "loaded" },
      ],
    } as never;
    const loadStartupPlugins = vi.fn(async () => ({
      pluginRegistry: loadedRegistry,
      gatewayMethods: ["ping", "telegram.send"],
    }));
    const onStartupPluginsLoaded = vi.fn(async () => undefined);
    const logGatewayStartup = vi.fn(async () => undefined);
    const startGatewaySidecars = vi.fn(async () => ({ pluginServices: null }));
    const measure = vi.fn(
      async <T>(_name: string, run: () => T | Promise<T>): Promise<T> => await run(),
    );
    const trace = {
      mark: vi.fn(),
      detail: vi.fn(),
      measure,
    };

    await startGatewayPostAttachRuntime(
      {
        ...createPostAttachParams({
          pluginRegistry: initialRegistry,
          loadStartupPlugins,
          onStartupPluginsLoaded,
          startupTrace: trace,
        }),
        deferSidecars: false,
      },
      createPostAttachRuntimeDeps({
        logGatewayStartup,
        startGatewaySidecars,
        refreshLatestUpdateRestartSentinel: vi.fn(async () => null),
      }),
    );

    expect(loadStartupPlugins).toHaveBeenCalledOnce();
    expect(onStartupPluginsLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ pluginRegistry: loadedRegistry }),
    );
    expect(trace.measure).toHaveBeenCalledWith("plugins.runtime-post-bind", expect.any(Function));
    expect(trace.detail).toHaveBeenCalledWith("plugins.runtime-post-bind", [
      ["plugins", "2"],
      ["methods", "2"],
    ]);
    expect(logGatewayStartup).toHaveBeenCalledWith(
      expect.objectContaining({ loadedPluginIds: ["telegram", "browser"] }),
    );
    expect(startGatewaySidecars).toHaveBeenCalledWith(
      expect.objectContaining({ pluginRegistry: loadedRegistry }),
    );
  });

  it("starts the qmd memory backend only when configured", async () => {
    await startGatewayPostAttachRuntime({
      ...createPostAttachParams(),
      gatewayPluginConfigAtStart: {
        hooks: { internal: { enabled: false } },
        memory: { backend: "qmd" },
      } as never,
    });

    await vi.waitFor(() => {
      expect(hoisted.startGatewayMemoryBackend).toHaveBeenCalledTimes(1);
    });
  });

  it("does not block channel startup on primary model prewarm", async () => {
    let finishPrewarm!: () => void;
    const prewarmPrimaryModel = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPrewarm = resolve;
        }),
    );
    const startChannels = vi.fn(async () => undefined);

    await startGatewaySidecars({
      cfg: {
        hooks: { internal: { enabled: false } },
      } as never,
      pluginRegistry: createPostAttachParams().pluginRegistry,
      defaultWorkspaceDir: "/tmp/kova-workspace",
      deps: {} as never,
      startChannels,
      prewarmPrimaryModel,
      log: { warn: vi.fn() },
      logHooks: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      logChannels: {
        info: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(startChannels).toHaveBeenCalledTimes(1);
    expect(prewarmPrimaryModel).toHaveBeenCalledTimes(1);
    finishPrewarm();
  });

  it("starts and reports plugin services before channel startup completion", async () => {
    let releaseChannels: (() => void) | undefined;
    const pluginServices = { stop: vi.fn(async () => {}) } as never;
    const onPluginServices = vi.fn();
    const onSidecarsReady = vi.fn();
    const startChannels = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseChannels = resolve;
        }),
    );
    hoisted.startPluginServices.mockResolvedValueOnce(pluginServices);

    await startGatewayPostAttachRuntime({
      ...createPostAttachParams({
        deferSidecars: true,
        onPluginServices,
        onSidecarsReady,
      }),
      startChannels,
    });

    await vi.waitFor(() => {
      expect(startChannels).toHaveBeenCalledTimes(1);
      expect(hoisted.startPluginServices).toHaveBeenCalledTimes(1);
      expect(onPluginServices).toHaveBeenCalledWith(pluginServices);
    });
    expect(onSidecarsReady).not.toHaveBeenCalled();

    if (!releaseChannels) {
      throw new Error("Expected channel startup release callback to be initialized");
    }
    releaseChannels();
    await vi.waitFor(() => {
      expect(onSidecarsReady).toHaveBeenCalledTimes(1);
    });
    expect(onPluginServices).toHaveBeenCalledTimes(1);
  });

  it("waits for sidecars by default before returning", async () => {
    let resumeSidecars!: () => void;
    const sidecarsReady = new Promise<{ pluginServices: null }>((resolve) => {
      resumeSidecars = () => resolve({ pluginServices: null });
    });
    const startGatewaySidecars = vi.fn(async () => {
      return await sidecarsReady;
    });
    let returned = false;

    const runtimePromise = startGatewayPostAttachRuntime(
      createPostAttachParams(),
      createPostAttachRuntimeDeps({ startGatewaySidecars }),
    ).then(() => {
      returned = true;
    });

    await vi.waitFor(() => {
      expect(startGatewaySidecars).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();
    expect(returned).toBe(false);

    resumeSidecars();
    await runtimePromise;
    expect(returned).toBe(true);
  });

  it("keeps startup-gated methods available while connectors are resuming", async () => {
    let resumeSidecars!: () => void;
    const sidecarsReady = new Promise<{ pluginServices: null }>((resolve) => {
      resumeSidecars = () => resolve({ pluginServices: null });
    });
    const startGatewaySidecars = vi.fn(async () => {
      return await sidecarsReady;
    });
    const unavailableGatewayMethods = new Set<string>();

    await startGatewayPostAttachRuntime(
      {
        ...createPostAttachParams(),
        unavailableGatewayMethods,
        deferSidecars: true,
      },
      createPostAttachRuntimeDeps({ startGatewaySidecars }),
    );

    await vi.waitFor(
      () => {
        expect(startGatewaySidecars).toHaveBeenCalledTimes(1);
      },
      { timeout: 10_000 },
    );

    expect([...unavailableGatewayMethods]).toEqual([]);
    expect(hoisted.startPluginServices).not.toHaveBeenCalled();

    resumeSidecars();
    await vi.waitFor(() => {
      expect([...unavailableGatewayMethods]).toEqual([]);
    });
    expect([...unavailableGatewayMethods]).toEqual([]);
    expect(startGatewaySidecars).toHaveBeenCalledTimes(1);
  });

  it("dispatches registered gateway startup internal hooks without configured hook packs", async () => {
    vi.useFakeTimers();
    hoisted.hasInternalHookListeners.mockReturnValue(true);
    const cfg = {} as never;
    const deps = {} as never;

    try {
      await startGatewaySidecars({
        cfg,
        pluginRegistry: createPostAttachParams().pluginRegistry,
        defaultWorkspaceDir: "/tmp/kova-workspace",
        deps,
        startChannels: vi.fn(async () => undefined),
        log: { warn: vi.fn() },
        logHooks: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
        logChannels: {
          info: vi.fn(),
          error: vi.fn(),
        },
      });

      expect(hoisted.loadInternalHooks).not.toHaveBeenCalled();
      expect(hoisted.hasInternalHookListeners).toHaveBeenCalledWith("gateway", "startup");

      await vi.advanceTimersByTimeAsync(250);

      expect(hoisted.createInternalHookEvent).toHaveBeenCalledWith(
        "gateway",
        "startup",
        "gateway:startup",
        {
          cfg,
          deps,
          workspaceDir: "/tmp/kova-workspace",
        },
      );
      expect(hoisted.triggerInternalHook).toHaveBeenCalledWith(hoisted.startupHookEvent);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for a healthy ACP runtime backend before startup identity reconcile", async () => {
    let healthy = false;
    hoisted.getAcpRuntimeBackend.mockImplementation((id?: string) => ({
      id: id ?? "acpx",
      runtime: {},
      healthy: () => healthy,
    }));

    await startGatewaySidecars({
      cfg: {
        hooks: { internal: { enabled: false } },
        acp: { enabled: true, backend: "acpx" },
      } as never,
      pluginRegistry: createPostAttachParams().pluginRegistry,
      defaultWorkspaceDir: "/tmp/kova-workspace",
      deps: {} as never,
      startChannels: vi.fn(async () => undefined),
      log: { warn: vi.fn() },
      logHooks: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      logChannels: {
        info: vi.fn(),
        error: vi.fn(),
      },
    });

    await vi.waitFor(() => {
      expect(hoisted.getAcpRuntimeBackend).toHaveBeenCalledWith("acpx");
    });
    expect(hoisted.reconcilePendingSessionIdentities).not.toHaveBeenCalled();

    healthy = true;
    await vi.waitFor(() => {
      expect(hoisted.reconcilePendingSessionIdentities).toHaveBeenCalledTimes(1);
    });
  });

  it("passes typed gateway_start context with config, workspace dir, and a live cron getter", async () => {
    const runGatewayStart = vi.fn<
      (event: PluginHookGatewayStartEvent, ctx: PluginHookGatewayContext) => Promise<void>
    >(async () => undefined);
    const hookRunner = {
      hasHooks: vi.fn((hookName: string) => hookName === "gateway_start"),
      runGatewayStart,
    };
    const initialCron = { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() };
    const params = createPostAttachParams({
      gatewayPluginConfigAtStart: {
        hooks: { internal: { enabled: false } },
        plugins: { entries: { demo: { enabled: true } } },
      } as never,
      deps: { cron: initialCron } as never,
    });

    await startGatewayPostAttachRuntime(
      params,
      createPostAttachRuntimeDeps({
        runGlobalGatewayStartSafely: vi.fn(async ({ event, ctx }) => {
          if (hookRunner.hasHooks("gateway_start")) {
            await hookRunner.runGatewayStart(event, ctx);
          }
        }),
      }),
    );

    await vi.waitFor(() => {
      expect(runGatewayStart).toHaveBeenCalledTimes(1);
    });

    const firstCall = runGatewayStart.mock.calls[0];
    if (!firstCall) {
      throw new Error("gateway_start was not invoked");
    }
    const [event, ctx] = firstCall;
    expect(event).toEqual({ port: 18789 });
    expect(ctx).toMatchObject({
      port: 18789,
      config: params.gatewayPluginConfigAtStart,
      workspaceDir: "/tmp/kova-workspace",
    });
    expect(typeof ctx.getCron).toBe("function");
    const getCron = ctx.getCron;
    if (!getCron) {
      throw new Error("gateway_start context did not expose getCron");
    }
    expect(getCron()).toBe(initialCron);

    const reloadedCron = { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() };
    params.deps.cron = reloadedCron as never;
    expect(getCron()).toBe(reloadedCron);
  });
});

function createPostAttachRuntimeDeps(
  overrides: Partial<PostAttachRuntimeDeps> = {},
): PostAttachRuntimeDeps {
  return {
    logGatewayStartup: hoisted.logGatewayStartup,
    refreshLatestUpdateRestartSentinel: hoisted.refreshLatestUpdateRestartSentinel,
    runGlobalGatewayStartSafely: vi.fn(async () => undefined),
    scheduleGatewayUpdateCheck: hoisted.scheduleGatewayUpdateCheck,
    startGatewaySidecars: vi.fn(async () => ({ pluginServices: null })),
    startGatewayTailscaleExposure: hoisted.startGatewayTailscaleExposure,
    ...overrides,
  };
}

function createPostAttachParams(overrides: Partial<PostAttachParams> = {}): PostAttachParams {
  return {
    minimalTestGateway: false,
    cfgAtStart: { hooks: { internal: { enabled: false } } } as never,
    bindHost: "127.0.0.1",
    bindHosts: ["127.0.0.1"],
    port: 18789,
    tlsEnabled: false,
    log: { info: vi.fn(), warn: vi.fn() },
    isNixMode: false,
    broadcast: vi.fn(),
    tailscaleMode: "off",
    resetOnExit: false,
    preserveFunnel: false,
    controlUiBasePath: "/",
    logTailscale: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    gatewayPluginConfigAtStart: { hooks: { internal: { enabled: false } } } as never,
    pluginRegistry: {
      plugins: [
        { id: "beta", status: "loaded" },
        { id: "alpha", status: "loaded" },
        { id: "cold", status: "disabled" },
        { id: "broken", status: "error" },
      ],
    } as never,
    defaultWorkspaceDir: "/tmp/kova-workspace",
    deps: {} as never,
    startChannels: vi.fn(async () => undefined),
    logHooks: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    logChannels: {
      info: vi.fn(),
      error: vi.fn(),
    },
    unavailableGatewayMethods: new Set<string>(),
    ...overrides,
  };
}
