import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestHandlerOptions } from "./types.js";

const mocks = vi.hoisted(() => ({
  getRuntimeConfig: vi.fn(() => ({})),
  buildPluginRegistrySnapshotReport: vi.fn(),
  readConfigFileSnapshot: vi.fn(),
  replaceConfigFile: vi.fn(),
  refreshPluginRegistryAfterConfigMutation: vi.fn(),
  enablePluginInConfig: vi.fn(),
  setPluginEnabledInConfig: vi.fn(),
  applySlotSelectionForPlugin: vi.fn(),
  loadInstalledPluginIndexInstallRecords: vi.fn(),
  removePluginInstallRecordFromRecords: vi.fn(),
  withoutPluginInstallRecords: vi.fn(),
  withPluginInstallRecords: vi.fn(),
  commitPluginInstallRecordsWithConfig: vi.fn(),
  planPluginUninstall: vi.fn(),
  applyPluginUninstallDirectoryRemoval: vi.fn(),
  formatUninstallActionLabels: vi.fn(),
  installPluginFromNpmSpec: vi.fn(),
  installPluginFromClawHub: vi.fn(),
  parseClawHubPluginSpec: vi.fn(),
  buildPreferredClawHubSpec: vi.fn(),
  parseNpmPrefixSpec: vi.fn(),
  resolveOfficialExternalPluginNpmSpec: vi.fn(),
  recordPluginInstall: vi.fn(),
  buildNpmResolutionInstallFields: vi.fn(),
}));

vi.mock("../../plugins/status.js", () => ({
  buildPluginRegistrySnapshotReport: mocks.buildPluginRegistrySnapshotReport,
}));
vi.mock("../../config/config.js", () => ({
  readConfigFileSnapshot: mocks.readConfigFileSnapshot,
  replaceConfigFile: mocks.replaceConfigFile,
}));
vi.mock("../../cli/plugins-registry-refresh.js", () => ({
  refreshPluginRegistryAfterConfigMutation: mocks.refreshPluginRegistryAfterConfigMutation,
}));
vi.mock("../../plugins/enable.js", () => ({
  enablePluginInConfig: mocks.enablePluginInConfig,
}));
vi.mock("../../plugins/toggle-config.js", () => ({
  setPluginEnabledInConfig: mocks.setPluginEnabledInConfig,
}));
vi.mock("../../cli/plugins-command-helpers.js", () => ({
  applySlotSelectionForPlugin: mocks.applySlotSelectionForPlugin,
  buildPreferredClawHubSpec: mocks.buildPreferredClawHubSpec,
  parseNpmPrefixSpec: mocks.parseNpmPrefixSpec,
}));
vi.mock("../../plugins/installed-plugin-index-records.js", () => ({
  loadInstalledPluginIndexInstallRecords: mocks.loadInstalledPluginIndexInstallRecords,
  removePluginInstallRecordFromRecords: mocks.removePluginInstallRecordFromRecords,
  withoutPluginInstallRecords: mocks.withoutPluginInstallRecords,
  withPluginInstallRecords: mocks.withPluginInstallRecords,
}));
vi.mock("../../cli/plugins-install-record-commit.js", () => ({
  commitPluginInstallRecordsWithConfig: mocks.commitPluginInstallRecordsWithConfig,
}));
vi.mock("../../plugins/uninstall.js", () => ({
  planPluginUninstall: mocks.planPluginUninstall,
  applyPluginUninstallDirectoryRemoval: mocks.applyPluginUninstallDirectoryRemoval,
  formatUninstallActionLabels: mocks.formatUninstallActionLabels,
}));
vi.mock("../../plugins/install.js", () => ({
  installPluginFromNpmSpec: mocks.installPluginFromNpmSpec,
}));
vi.mock("../../plugins/clawhub.js", () => ({
  installPluginFromClawHub: mocks.installPluginFromClawHub,
}));
vi.mock("../../infra/clawhub.js", () => ({
  parseClawHubPluginSpec: mocks.parseClawHubPluginSpec,
}));
vi.mock("../../plugins/official-external-plugin-catalog.js", () => ({
  resolveOfficialExternalPluginNpmSpec: mocks.resolveOfficialExternalPluginNpmSpec,
}));
vi.mock("../../plugins/installs.js", () => ({
  buildNpmResolutionInstallFields: mocks.buildNpmResolutionInstallFields,
  recordPluginInstall: mocks.recordPluginInstall,
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
    mocks.replaceConfigFile.mockResolvedValue(undefined);
    mocks.refreshPluginRegistryAfterConfigMutation.mockResolvedValue(undefined);
    mocks.readConfigFileSnapshot.mockResolvedValue({
      config: { plugins: { entries: { demo: { enabled: true } } } },
      sourceConfig: { plugins: { entries: { demo: { enabled: true } } } },
      hash: "hash-1",
    });
    mocks.enablePluginInConfig.mockImplementation((config, pluginId) => ({
      config: { ...config, enabledPlugin: pluginId },
      enabled: true,
    }));
    mocks.setPluginEnabledInConfig.mockImplementation((config, pluginId, enabled) => ({
      ...config,
      pluginId,
      enabled,
    }));
    mocks.applySlotSelectionForPlugin.mockImplementation((config) => ({
      config,
      warnings: [],
    }));
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue({});
    mocks.removePluginInstallRecordFromRecords.mockReturnValue({});
    mocks.withoutPluginInstallRecords.mockImplementation((config) => config);
    mocks.withPluginInstallRecords.mockImplementation((config, records) => ({
      ...config,
      plugins: { ...config.plugins, installs: records },
    }));
    mocks.commitPluginInstallRecordsWithConfig.mockResolvedValue(undefined);
    mocks.planPluginUninstall.mockReturnValue({
      ok: true,
      config: { plugins: {} },
      pluginId: "demo",
      actions: { entry: true },
      directoryRemoval: null,
    });
    mocks.applyPluginUninstallDirectoryRemoval.mockResolvedValue({
      directoryRemoved: false,
      warnings: [],
    });
    mocks.installPluginFromNpmSpec.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/demo",
      extensions: ["dist/index.js"],
    });
    mocks.installPluginFromClawHub.mockResolvedValue({
      ok: false,
      error: "not on clawhub",
    });
    mocks.parseClawHubPluginSpec.mockReturnValue(null);
    mocks.buildPreferredClawHubSpec.mockReturnValue(null);
    mocks.parseNpmPrefixSpec.mockReturnValue(null);
    mocks.resolveOfficialExternalPluginNpmSpec.mockReturnValue(undefined);
    mocks.recordPluginInstall.mockImplementation((config, update) => ({
      ...config,
      plugins: {
        ...config.plugins,
        installs: {
          ...config.plugins?.installs,
          [update.pluginId]: update,
        },
      },
    }));
    mocks.buildNpmResolutionInstallFields.mockReturnValue({});
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

  it("persists plugin enablement without restarting the gateway", async () => {
    const opts = createOptions({ pluginId: "demo", enabled: true });

    await pluginsHandlers["plugins.setEnabled"](opts);

    expect(mocks.enablePluginInConfig).toHaveBeenCalledWith({ plugins: { enabled: true } }, "demo");
    expect(mocks.replaceConfigFile).toHaveBeenCalledWith({
      nextConfig: expect.objectContaining({ enabledPlugin: "demo" }),
    });
    expect(mocks.refreshPluginRegistryAfterConfigMutation).toHaveBeenCalledWith({
      config: expect.objectContaining({ enabledPlugin: "demo" }),
      reason: "policy-changed",
    });
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        pluginId: "demo",
        restartRequired: true,
      }),
      undefined,
    );
  });

  it("uninstalls managed plugins through the persisted plugin index", async () => {
    mocks.loadInstalledPluginIndexInstallRecords.mockResolvedValue({
      demo: { source: "npm", spec: "demo", installPath: "/tmp/demo" },
    });
    mocks.removePluginInstallRecordFromRecords.mockReturnValue({});
    const opts = createOptions({ pluginId: "demo", deleteFiles: true });

    await pluginsHandlers["plugins.uninstall"](opts);

    expect(mocks.planPluginUninstall).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "demo",
        deleteFiles: true,
      }),
    );
    expect(mocks.commitPluginInstallRecordsWithConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        nextInstallRecords: {},
        baseHash: "hash-1",
      }),
    );
    expect(mocks.applyPluginUninstallDirectoryRemoval).toHaveBeenCalled();
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        pluginId: "demo",
        restartRequired: true,
      }),
      undefined,
    );
  });

  it("installs npm plugins and records the install outside the config file", async () => {
    const opts = createOptions({ spec: "npm:demo-plugin" });
    mocks.parseNpmPrefixSpec.mockReturnValue("demo-plugin");

    await pluginsHandlers["plugins.install"](opts);

    expect(mocks.installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "install",
        spec: "demo-plugin",
      }),
    );
    expect(mocks.recordPluginInstall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pluginId: "demo",
        source: "npm",
        spec: "demo-plugin",
        installPath: "/tmp/demo",
      }),
    );
    expect(mocks.commitPluginInstallRecordsWithConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        nextInstallRecords: expect.objectContaining({
          demo: expect.objectContaining({
            source: "npm",
            spec: "demo-plugin",
          }),
        }),
      }),
    );
    expect(opts.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        pluginId: "demo",
        restartRequired: true,
      }),
      undefined,
    );
  });
});
