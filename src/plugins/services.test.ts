import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginOrigin } from "./plugin-origin.types.js";
import { createEmptyPluginRegistry } from "./registry.js";
import type { KovaPluginService, KovaPluginServiceContext } from "./types.js";

const mockedLogger = vi.hoisted(() => ({
  info: vi.fn<(msg: string) => void>(),
  warn: vi.fn<(msg: string) => void>(),
  error: vi.fn<(msg: string) => void>(),
  debug: vi.fn<(msg: string) => void>(),
  child: vi.fn(() => mockedLogger),
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => mockedLogger,
}));

import { STATE_DIR } from "../config/paths.js";
import { startPluginServices } from "./services.js";

const tempDirs: string[] = [];

function createRegistry(
  services: KovaPluginService[],
  pluginId = "plugin:test",
  origin: PluginOrigin = "workspace",
  pluginName = pluginId,
  rootDir = "/plugins/test-plugin",
) {
  const registry = createEmptyPluginRegistry();
  registry.services = services.map((service) => ({
    pluginId,
    pluginName,
    service,
    source: "test",
    origin,
    rootDir,
  })) as typeof registry.services;
  return registry;
}

function createPackageRoot(packageName: string): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-plugin-service-"));
  tempDirs.push(rootDir);
  fs.writeFileSync(
    path.join(rootDir, "package.json"),
    `${JSON.stringify({ name: packageName }, null, 2)}\n`,
    "utf8",
  );
  return rootDir;
}

function createServiceConfig() {
  return {} as Parameters<typeof startPluginServices>[0]["config"];
}

function expectServiceContext(
  ctx: KovaPluginServiceContext,
  config: Parameters<typeof startPluginServices>[0]["config"],
) {
  expect(ctx.config).toBe(config);
  expect(ctx.workspaceDir).toBe("/tmp/workspace");
  expect(ctx.stateDir).toBe(STATE_DIR);
  expectServiceLogger(ctx);
}

function expectServiceLogger(ctx: KovaPluginServiceContext) {
  expect(ctx.logger).toBeDefined();
  expect(typeof ctx.logger.info).toBe("function");
  expect(typeof ctx.logger.warn).toBe("function");
  expect(typeof ctx.logger.error).toBe("function");
}

function expectServiceContexts(
  contexts: KovaPluginServiceContext[],
  config: Parameters<typeof startPluginServices>[0]["config"],
) {
  expect(contexts).not.toHaveLength(0);
  contexts.forEach((ctx) => {
    expectServiceContext(ctx, config);
  });
}

function expectServiceLifecycleState(params: {
  starts: string[];
  stops: string[];
  contexts: KovaPluginServiceContext[];
  config: Parameters<typeof startPluginServices>[0]["config"];
}) {
  expect(params.starts).toEqual(["a", "b", "c"]);
  expect(params.stops).toEqual(["c", "a"]);
  expect(params.contexts).toHaveLength(3);
  expectServiceContexts(params.contexts, params.config);
}

async function startTrackingServices(params: {
  services: KovaPluginService[];
  config?: Parameters<typeof startPluginServices>[0]["config"];
  workspaceDir?: string;
}) {
  return startPluginServices({
    registry: createRegistry(params.services),
    config: params.config ?? createServiceConfig(),
    ...(params.workspaceDir ? { workspaceDir: params.workspaceDir } : {}),
  });
}

function createTrackingService(
  id: string,
  params: {
    starts?: string[];
    stops?: string[];
    contexts?: KovaPluginServiceContext[];
    failOnStart?: boolean;
    failOnStop?: boolean;
    stopSpy?: () => void;
  } = {},
): KovaPluginService {
  return {
    id,
    start: (ctx) => {
      if (params.failOnStart) {
        throw new Error("start failed");
      }
      params.starts?.push(id.at(-1) ?? id);
      params.contexts?.push(ctx);
    },
    stop: params.stopSpy
      ? () => {
          params.stopSpy?.();
        }
      : params.stops || params.failOnStop
        ? () => {
            if (params.failOnStop) {
              throw new Error("stop failed");
            }
            params.stops?.push(id.at(-1) ?? id);
          }
        : undefined,
  };
}

describe("startPluginServices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("starts services and stops them in reverse order", async () => {
    const starts: string[] = [];
    const stops: string[] = [];
    const contexts: KovaPluginServiceContext[] = [];

    const config = createServiceConfig();
    const handle = await startTrackingServices({
      services: [
        createTrackingService("service-a", { starts, stops, contexts }),
        createTrackingService("service-b", { starts, contexts }),
        createTrackingService("service-c", { starts, stops, contexts }),
      ],
      config,
      workspaceDir: "/tmp/workspace",
    });
    await handle.stop();

    expectServiceLifecycleState({ starts, stops, contexts, config });
  });

  it("logs start/stop failures and continues", async () => {
    const stopOk = vi.fn();
    const stopThrows = vi.fn(() => {
      throw new Error("stop failed");
    });

    const handle = await startTrackingServices({
      services: [
        createTrackingService("service-start-fail", {
          failOnStart: true,
          stopSpy: vi.fn(),
        }),
        createTrackingService("service-ok", { stopSpy: stopOk }),
        createTrackingService("service-stop-fail", { stopSpy: stopThrows }),
      ],
    });

    await handle.stop();

    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "plugin service failed (service-start-fail, plugin=plugin:test, root=/plugins/test-plugin):",
      ),
    );
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("plugin service stop failed (service-stop-fail):"),
    );
    expect(stopOk).toHaveBeenCalledOnce();
    expect(stopThrows).toHaveBeenCalledOnce();
  });

  it("grants internal diagnostics only to trusted diagnostics exporter services", async () => {
    const contexts: KovaPluginServiceContext[] = [];
    const diagnosticsService = createTrackingService("diagnostics-otel", { contexts });
    await startPluginServices({
      registry: createRegistry([diagnosticsService], "diagnostics-otel", "bundled"),
      config: createServiceConfig(),
    });

    expect(contexts[0]?.internalDiagnostics?.onEvent).toBeTypeOf("function");
    expect(contexts[0]?.internalDiagnostics?.emit).toBeTypeOf("function");

    const prometheusContexts: KovaPluginServiceContext[] = [];
    const prometheusService = createTrackingService("diagnostics-prometheus", {
      contexts: prometheusContexts,
    });
    await startPluginServices({
      registry: createRegistry([prometheusService], "diagnostics-prometheus", "bundled"),
      config: createServiceConfig(),
    });

    expect(prometheusContexts[0]?.internalDiagnostics?.onEvent).toBeTypeOf("function");
    expect(prometheusContexts[0]?.internalDiagnostics?.emit).toBeTypeOf("function");

    const officialExternalContexts: KovaPluginServiceContext[] = [];
    const officialExternalService = createTrackingService("diagnostics-prometheus", {
      contexts: officialExternalContexts,
    });
    await startPluginServices({
      registry: createRegistry(
        [officialExternalService],
        "diagnostics-prometheus",
        "global",
        "Diagnostics Prometheus",
        createPackageRoot("@kovaai/diagnostics-prometheus"),
      ),
      config: createServiceConfig(),
    });

    expect(officialExternalContexts[0]?.internalDiagnostics?.onEvent).toBeTypeOf("function");
    expect(officialExternalContexts[0]?.internalDiagnostics?.emit).toBeTypeOf("function");

    const untrustedContexts: KovaPluginServiceContext[] = [];
    const untrustedService = createTrackingService("diagnostics-otel", {
      contexts: untrustedContexts,
    });
    await startPluginServices({
      registry: createRegistry([untrustedService], "diagnostics-otel", "workspace"),
      config: createServiceConfig(),
    });

    expect(untrustedContexts[0]?.internalDiagnostics).toBeUndefined();

    const spoofedContexts: KovaPluginServiceContext[] = [];
    const spoofedService = createTrackingService("diagnostics-prometheus", {
      contexts: spoofedContexts,
    });
    await startPluginServices({
      registry: createRegistry(
        [spoofedService],
        "diagnostics-prometheus",
        "global",
        "Diagnostics Prometheus",
        createPackageRoot("@example/diagnostics-prometheus"),
      ),
      config: createServiceConfig(),
    });

    expect(spoofedContexts[0]?.internalDiagnostics).toBeUndefined();
  });
});
