import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { collectDockerFlagValues, findDockerArgsCall } from "./test-args.js";
import type { SandboxConfig } from "./types.js";
import { SANDBOX_MOUNT_FORMAT_VERSION } from "./workspace-mounts.js";

let BROWSER_BRIDGES: Map<string, unknown>;
let ensureSandboxBrowser: typeof import("./browser.js").ensureSandboxBrowser;
let resetNoVncObserverTokensForTests: typeof import("./novnc-auth.js").resetNoVncObserverTokensForTests;

const dockerMocks = vi.hoisted(() => ({
  dockerContainerState: vi.fn(),
  execDocker: vi.fn(),
  readDockerContainerEnvVar: vi.fn(),
  readDockerContainerLabel: vi.fn(),
  readDockerPort: vi.fn(),
}));

const registryMocks = vi.hoisted(() => ({
  readBrowserRegistry: vi.fn(),
  updateBrowserRegistry: vi.fn(),
}));

const bridgeMocks = vi.hoisted(() => ({
  startBrowserBridgeServer: vi.fn(),
  stopBrowserBridgeServer: vi.fn(),
}));

vi.mock("./docker.js", async () => {
  const actual = await vi.importActual<typeof import("./docker.js")>("./docker.js");
  return {
    ...actual,
    dockerContainerState: dockerMocks.dockerContainerState,
    execDocker: dockerMocks.execDocker,
    readDockerContainerEnvVar: dockerMocks.readDockerContainerEnvVar,
    readDockerContainerLabel: dockerMocks.readDockerContainerLabel,
    readDockerPort: dockerMocks.readDockerPort,
  };
});

vi.mock("./registry.js", () => ({
  readBrowserRegistry: registryMocks.readBrowserRegistry,
  updateBrowserRegistry: registryMocks.updateBrowserRegistry,
}));

vi.mock("../../plugin-sdk/browser-bridge.js", () => ({
  startBrowserBridgeServer: bridgeMocks.startBrowserBridgeServer,
  stopBrowserBridgeServer: bridgeMocks.stopBrowserBridgeServer,
}));

vi.mock("../../plugin-sdk/browser-profiles.js", () => ({
  DEFAULT_BROWSER_ACTION_TIMEOUT_MS: 60_000,
  DEFAULT_BROWSER_EVALUATE_ENABLED: true,
  DEFAULT_KOVA_BROWSER_COLOR: "#FF4500",
  DEFAULT_KOVA_BROWSER_PROFILE_NAME: "kova",
  resolveProfile: (
    resolved: { cdpHost: string; cdpIsLoopback: boolean; profiles?: Record<string, unknown> },
    profileName: string,
  ) => {
    const profile = resolved.profiles?.[profileName] as {
      cdpPort?: number;
      cdpUrl?: string;
      color?: string;
    };
    if (typeof profile?.cdpPort !== "number") {
      return null;
    }
    return {
      name: profileName,
      cdpPort: profile.cdpPort,
      cdpUrl: profile.cdpUrl ?? `http://${resolved.cdpHost}:${profile.cdpPort}`,
      cdpHost: resolved.cdpHost,
      cdpIsLoopback: resolved.cdpIsLoopback,
      color: profile.color ?? "#FF4500",
      driver: "kova",
      attachOnly: true,
    };
  },
}));

async function loadFreshBrowserModulesForTest() {
  vi.resetModules();
  ({ BROWSER_BRIDGES } = await import("./browser-bridges.js"));
  ({ ensureSandboxBrowser } = await import("./browser.js"));
  ({ resetNoVncObserverTokensForTests } = await import("./novnc-auth.js"));
}

function buildConfig(enableNoVnc: boolean): SandboxConfig {
  return {
    mode: "all",
    backend: "docker",
    scope: "session",
    workspaceAccess: "none",
    workspaceRoot: "/tmp/kova-sandboxes",
    docker: {
      image: "kova-sandbox:bookworm-slim",
      containerPrefix: "kova-sbx-",
      workdir: "/workspace",
      readOnlyRoot: true,
      tmpfs: ["/tmp", "/var/tmp", "/run"],
      network: "none",
      capDrop: ["ALL"],
      env: { LANG: "C.UTF-8" },
    },
    ssh: {
      command: "ssh",
      workspaceRoot: "/tmp/kova-sandboxes",
      strictHostKeyChecking: true,
      updateHostKeys: true,
    },
    browser: {
      enabled: true,
      image: "kova-sandbox-browser:bookworm-slim",
      containerPrefix: "kova-sbx-browser-",
      network: "kova-sandbox-browser",
      cdpPort: 9222,
      vncPort: 5900,
      noVncPort: 6080,
      headless: false,
      enableNoVnc,
      allowHostControl: false,
      autoStart: true,
      autoStartTimeoutMs: 12_000,
    },
    tools: {
      allow: ["browser"],
      deny: [],
    },
    prune: {
      idleHours: 24,
      maxAgeDays: 7,
    },
  };
}

type EnsureSandboxBrowserParams = Parameters<typeof import("./browser.js").ensureSandboxBrowser>[0];

async function ensureTestSandboxBrowser(params: Omit<EnsureSandboxBrowserParams, "bridgeAuth">) {
  return await ensureSandboxBrowser({
    ...params,
    bridgeAuth: { token: "test-bridge-token" },
  });
}

describe("ensureSandboxBrowser create args", () => {
  beforeAll(async () => {
    await loadFreshBrowserModulesForTest();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    BROWSER_BRIDGES.clear();
    resetNoVncObserverTokensForTests();
    dockerMocks.dockerContainerState.mockClear();
    dockerMocks.execDocker.mockClear();
    dockerMocks.readDockerContainerEnvVar.mockClear();
    dockerMocks.readDockerContainerLabel.mockClear();
    dockerMocks.readDockerPort.mockClear();
    registryMocks.readBrowserRegistry.mockClear();
    registryMocks.updateBrowserRegistry.mockClear();
    bridgeMocks.startBrowserBridgeServer.mockClear();
    bridgeMocks.stopBrowserBridgeServer.mockClear();

    dockerMocks.dockerContainerState.mockResolvedValue({ exists: false, running: false });
    dockerMocks.execDocker.mockImplementation(async (args: string[]) => {
      if (args[0] === "image" && args[1] === "inspect") {
        return { stdout: "2026-05-12-cdp-relay-auth\n", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });
    dockerMocks.readDockerContainerLabel.mockResolvedValue(null);
    dockerMocks.readDockerContainerEnvVar.mockResolvedValue(null);
    dockerMocks.readDockerPort.mockImplementation(async (_containerName: string, port: number) => {
      if (port === 9222) {
        return 49100;
      }
      if (port === 6080) {
        return 49101;
      }
      return null;
    });
    registryMocks.readBrowserRegistry.mockResolvedValue({ entries: [] });
    registryMocks.updateBrowserRegistry.mockResolvedValue(undefined);
    bridgeMocks.startBrowserBridgeServer.mockResolvedValue({
      server: {} as never,
      port: 19000,
      baseUrl: "http://127.0.0.1:19000",
      state: {
        server: null,
        port: 19000,
        resolved: { profiles: {} },
        profiles: new Map(),
      },
    });
    bridgeMocks.stopBrowserBridgeServer.mockResolvedValue(undefined);
  });

  it("publishes noVNC on loopback and injects noVNC password env", async () => {
    const result = await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg: buildConfig(true),
    });

    const createArgs = findDockerArgsCall(dockerMocks.execDocker.mock.calls, "create");

    expect(createArgs).toBeDefined();
    expect(createArgs).toContain("127.0.0.1::6080");
    const envEntries = collectDockerFlagValues(createArgs ?? [], "-e");
    expect(envEntries).toContain("KOVA_BROWSER_NO_SANDBOX=1");
    const passwordEntry = envEntries.find((entry) =>
      entry.startsWith("KOVA_BROWSER_NOVNC_PASSWORD="),
    );
    const cdpTokenEntry = envEntries.find((entry) =>
      entry.startsWith("KOVA_BROWSER_CDP_AUTH_TOKEN="),
    );
    expect(passwordEntry).toMatch(/^KOVA_BROWSER_NOVNC_PASSWORD=[A-Za-z0-9]{8}$/);
    expect(cdpTokenEntry).toMatch(/^KOVA_BROWSER_CDP_AUTH_TOKEN=[a-f0-9]{48}$/);
    expect(envEntries.some((entry) => entry.startsWith("KOVA_BROWSER_CDP_SOURCE_RANGE="))).toBe(
      false,
    );
    expect(result?.noVncUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/sandbox\/novnc\?token=/);
    expect(result?.noVncUrl).not.toContain("password=");
  });

  it("does not inject noVNC password env when noVNC is disabled", async () => {
    const result = await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg: buildConfig(false),
    });

    const createArgs = findDockerArgsCall(dockerMocks.execDocker.mock.calls, "create");
    const envEntries = collectDockerFlagValues(createArgs ?? [], "-e");
    expect(envEntries.some((entry) => entry.startsWith("KOVA_BROWSER_NOVNC_PASSWORD="))).toBe(
      false,
    );
    expect(result?.noVncUrl).toBeUndefined();
  });

  it("passes the browser SSRF policy to the sandbox bridge", async () => {
    await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg: buildConfig(false),
      ssrfPolicy: { dangerouslyAllowPrivateNetwork: true },
    });

    expect(bridgeMocks.startBrowserBridgeServer).toHaveBeenCalledWith(
      expect.objectContaining({
        resolved: expect.objectContaining({
          ssrfPolicy: { dangerouslyAllowPrivateNetwork: true },
        }),
      }),
    );
  });

  it("recreates a cached bridge when the SSRF policy changes", async () => {
    const existingBridge = {
      server: {} as never,
      port: 19000,
      baseUrl: "http://127.0.0.1:19000",
      state: {
        resolved: {
          enabled: true,
          evaluateEnabled: true,
          controlPort: 0,
          cdpProtocol: "http",
          cdpHost: "127.0.0.1",
          cdpIsLoopback: true,
          cdpPortRangeStart: 18800,
          cdpPortRangeEnd: 18899,
          remoteCdpTimeoutMs: 1500,
          remoteCdpHandshakeTimeoutMs: 3000,
          localLaunchTimeoutMs: 15_000,
          localCdpReadyTimeoutMs: 8_000,
          color: "#FF4500",
          headless: false,
          noSandbox: false,
          attachOnly: true,
          defaultProfile: "kova",
          extraArgs: [],
          tabCleanup: {
            enabled: true,
            idleMinutes: 120,
            maxTabsPerSession: 8,
            sweepMinutes: 5,
          },
          profiles: {
            kova: {
              cdpPort: 49100,
              cdpUrl: "http://kova:test-cdp-token@127.0.0.1:49100",
              color: "#FF4500",
            },
          },
          ssrfPolicy: { dangerouslyAllowPrivateNetwork: true },
        },
      },
    };
    BROWSER_BRIDGES.set("session:test", {
      bridge: existingBridge,
      containerName: "kova-sbx-browser-session-test-0661d10a",
      authToken: "test-bridge-token",
    });
    dockerMocks.dockerContainerState.mockResolvedValue({ exists: true, running: true });
    dockerMocks.readDockerContainerEnvVar.mockImplementation(async (_containerName, envKey) => {
      if (envKey === "KOVA_BROWSER_CDP_AUTH_TOKEN") {
        return "test-cdp-token";
      }
      return null;
    });

    await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg: buildConfig(false),
      ssrfPolicy: { allowedHostnames: ["example.com"] },
    });

    expect(bridgeMocks.stopBrowserBridgeServer).toHaveBeenCalledWith(existingBridge.server);
    expect(bridgeMocks.startBrowserBridgeServer).toHaveBeenCalledWith(
      expect.objectContaining({
        resolved: expect.objectContaining({
          ssrfPolicy: { allowedHostnames: ["example.com"] },
        }),
      }),
    );
  });

  it("mounts the main workspace read-only when workspaceAccess is none", async () => {
    const cfg = buildConfig(false);
    cfg.workspaceAccess = "none";

    await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg,
    });

    const createArgs = findDockerArgsCall(dockerMocks.execDocker.mock.calls, "create");

    expect(createArgs).toBeDefined();
    expect(createArgs).toContain("/tmp/workspace:/workspace:ro,z");
  });

  it("keeps the main workspace writable when workspaceAccess is rw", async () => {
    const cfg = buildConfig(false);
    cfg.workspaceAccess = "rw";

    await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg,
    });

    const createArgs = findDockerArgsCall(dockerMocks.execDocker.mock.calls, "create");

    expect(createArgs).toBeDefined();
    expect(createArgs).toContain("/tmp/workspace:/workspace:z");
    expect(createArgs).not.toContain("/tmp/workspace:/workspace:ro,z");
  });

  it("stamps the mount format version label on browser containers", async () => {
    await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg: buildConfig(false),
    });

    const createArgs = findDockerArgsCall(dockerMocks.execDocker.mock.calls, "create");
    const labels = collectDockerFlagValues(createArgs ?? [], "--label");
    expect(labels).toContain(`kova.mountFormatVersion=${SANDBOX_MOUNT_FORMAT_VERSION}`);
  });

  it("force-removes the browser container when CDP never becomes reachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    bridgeMocks.startBrowserBridgeServer.mockImplementationOnce(async (params) => {
      await params.onEnsureAttachTarget?.({});
      return {
        server: {} as never,
        port: 19000,
        baseUrl: "http://127.0.0.1:19000",
        state: {
          server: null,
          port: 19000,
          resolved: { profiles: {} },
          profiles: new Map(),
        },
      };
    });

    const cfg = buildConfig(false);
    cfg.browser.autoStartTimeoutMs = 1;

    await expect(
      ensureTestSandboxBrowser({
        scopeKey: "session:test",
        workspaceDir: "/tmp/workspace",
        agentWorkspaceDir: "/tmp/workspace",
        cfg,
      }),
    ).rejects.toThrow("hung container has been forcefully removed");

    expect(dockerMocks.execDocker).toHaveBeenCalledWith(
      ["rm", "-f", expect.stringMatching(/^kova-sbx-browser-session-test-/)],
      { allowFailure: true },
    );
  });

  it("does not inject a CDP source range unless configured", async () => {
    await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg: buildConfig(false),
    });

    const createArgs = findDockerArgsCall(dockerMocks.execDocker.mock.calls, "create");
    const envEntries = collectDockerFlagValues(createArgs ?? [], "-e");
    expect(envEntries.some((entry) => entry.startsWith("KOVA_BROWSER_CDP_SOURCE_RANGE="))).toBe(
      false,
    );
  });

  it("uses explicit cdpSourceRange as an additional relay allowlist", async () => {
    const cfg = buildConfig(false);
    cfg.browser.cdpSourceRange = "10.0.0.0/24";

    await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg,
    });

    const createArgs = findDockerArgsCall(dockerMocks.execDocker.mock.calls, "create");
    const envEntries = collectDockerFlagValues(createArgs ?? [], "-e");
    expect(envEntries).toContain("KOVA_BROWSER_CDP_SOURCE_RANGE=10.0.0.0/24");
  });

  it("rejects stale sandbox browser images without the current relay contract", async () => {
    dockerMocks.execDocker.mockImplementation(async (args: string[]) => {
      if (args[0] === "image" && args[1] === "inspect") {
        return { stdout: "<no value>\n", stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    await expect(
      ensureTestSandboxBrowser({
        scopeKey: "session:test",
        workspaceDir: "/tmp/workspace",
        agentWorkspaceDir: "/tmp/workspace",
        cfg: buildConfig(false),
      }),
    ).rejects.toThrow(/stale or incompatible/);
  });

  it("recreates existing containers that lack a CDP auth token", async () => {
    dockerMocks.dockerContainerState.mockResolvedValue({ exists: true, running: true });
    dockerMocks.readDockerContainerEnvVar.mockResolvedValue(null);

    const result = await ensureTestSandboxBrowser({
      scopeKey: "session:test",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace",
      cfg: buildConfig(false),
    });

    expect(result).toBeDefined();
    expect(dockerMocks.execDocker).toHaveBeenCalledWith(
      ["rm", "-f", expect.stringMatching(/^kova-sbx-browser-session-test-/)],
      { allowFailure: true },
    );
    const createArgs = findDockerArgsCall(dockerMocks.execDocker.mock.calls, "create");
    const envEntries = collectDockerFlagValues(createArgs ?? [], "-e");
    expect(envEntries.some((entry) => entry.startsWith("KOVA_BROWSER_CDP_AUTH_TOKEN="))).toBe(true);
  });
});
