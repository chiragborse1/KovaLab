import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestHandlerOptions } from "./types.js";

const mocks = vi.hoisted(() => ({
  getRuntimeConfig: vi.fn(() => ({})),
  buildPluginRegistrySnapshotReport: vi.fn(),
}));

vi.mock("../../plugins/status.js", () => ({
  buildPluginRegistrySnapshotReport: mocks.buildPluginRegistrySnapshotReport,
}));

import { pluginsHandlers, type PluginsStatusResult } from "./plugins.js";

function createOptions(params: Record<string, unknown> = {}): GatewayRequestHandlerOptions & {
  respond: ReturnType<typeof vi.fn>;
} {
  const respond = vi.fn();
  return {
    req: { type: "req", id: "req-1", method: "plugins.status", params },
    params,
    client: null,
    isWebchatConnect: () => false,
    respond,
    context: { getRuntimeConfig: mocks.getRuntimeConfig },
  } as unknown as GatewayRequestHandlerOptions & { respond: ReturnType<typeof vi.fn> };
}

const handler = pluginsHandlers["plugins.status"];

describe("plugins.status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRuntimeConfig.mockReturnValue({ plugins: { enabled: true } });
    mocks.buildPluginRegistrySnapshotReport.mockReturnValue({
      registrySource: "persisted",
      registryDiagnostics: [
        {
          level: "warn",
          code: "persisted-registry-stale-source",
          message: "registry is stale",
        },
      ],
      diagnostics: [
        {
          level: "error",
          pluginId: "broken",
          source: "manifest",
          message: "manifest failed",
        },
      ],
      plugins: [
        {
          id: "telegram",
          name: "Telegram",
          enabled: true,
          status: "loaded",
          origin: "bundled",
          format: "openclaw",
          version: "2.0.0",
          channelIds: ["telegram"],
          providerIds: [],
          toolNames: [],
          gatewayMethods: ["telegram.status"],
          services: [],
          commands: [],
          configSchema: true,
        },
        {
          id: "broken",
          name: "Broken",
          enabled: false,
          status: "error",
          origin: "external",
          format: "openclaw",
          channelIds: [],
          providerIds: ["broken-provider"],
          toolNames: [],
          gatewayMethods: [],
          services: [],
          commands: [],
          configSchema: false,
          error: "failed",
        },
      ],
    });
  });

  it("returns a serialisable plugin registry snapshot", () => {
    const opts = createOptions();

    handler(opts);

    expect(mocks.buildPluginRegistrySnapshotReport).toHaveBeenCalledWith({
      config: { plugins: { enabled: true } },
    });
    expect(opts.respond).toHaveBeenCalledTimes(1);
    const [ok, payload, error] = opts.respond.mock.calls[0] ?? [];
    expect(ok).toBe(true);
    expect(error).toBeUndefined();
    const result = payload as PluginsStatusResult;
    expect(result.registrySource).toBe("persisted");
    expect(result.totals).toEqual({
      total: 2,
      enabled: 1,
      disabled: 1,
      errors: 1,
      channels: 1,
      providers: 1,
    });
    expect(result.plugins.map((plugin) => plugin.id)).toEqual(["broken", "telegram"]);
    expect(result.diagnostics).toEqual([
      {
        level: "warn",
        code: "persisted-registry-stale-source",
        message: "registry is stale",
      },
      {
        level: "error",
        pluginId: "broken",
        source: "manifest",
        message: "manifest failed",
      },
    ]);
  });

  it("rejects unexpected params", () => {
    const opts = createOptions({ loadModules: true });

    handler(opts);

    expect(mocks.buildPluginRegistrySnapshotReport).not.toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "INVALID_REQUEST",
      }),
    );
  });
});
