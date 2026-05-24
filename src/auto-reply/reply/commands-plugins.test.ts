import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../../config/config.js";
import { handlePluginsCommand } from "./commands-plugins.js";
import { buildPluginsCommandParams } from "./commands.test-harness.js";

const readConfigFileSnapshotMock = vi.hoisted(() => vi.fn());
const validateConfigObjectWithPluginsMock = vi.hoisted(() => vi.fn());
const replaceConfigFileMock = vi.hoisted(() => vi.fn(async () => undefined));
const buildPluginRegistrySnapshotReportMock = vi.hoisted(() => vi.fn());
const buildPluginDiagnosticsReportMock = vi.hoisted(() => vi.fn());
const buildPluginInspectReportMock = vi.hoisted(() => vi.fn());
const buildAllPluginInspectReportsMock = vi.hoisted(() => vi.fn());
const formatPluginCompatibilityNoticeMock = vi.hoisted(() => vi.fn(() => "ok"));
const refreshPluginRegistryAfterConfigMutationMock = vi.hoisted(() => vi.fn(async () => undefined));
const loadInstalledPluginIndexInstallRecordsMock = vi.hoisted(() =>
  vi.fn(async (params: { config?: KovaConfig } = {}) => params.config?.plugins?.installs ?? {}),
);
const updateNpmInstalledPluginsMock = vi.hoisted(() => vi.fn());
const commitPluginInstallRecordsWithConfigMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../../cli/npm-resolution.js", () => ({
  buildNpmInstallRecordFields: vi.fn(),
}));

vi.mock("../../cli/plugins-command-helpers.js", () => ({
  buildPreferredKovaHubSpec: vi.fn(() => null),
  createPluginInstallLogger: vi.fn(() => ({})),
  decidePreferredKovaHubFallback: vi.fn(() => "fallback_to_npm"),
  resolveFileNpmSpecToLocalPath: vi.fn(() => null),
}));

vi.mock("../../cli/plugins-install-persist.js", () => ({
  persistPluginInstall: vi.fn(async () => undefined),
}));

vi.mock("../../cli/plugins-install-record-commit.js", () => ({
  commitPluginInstallRecordsWithConfig: commitPluginInstallRecordsWithConfigMock,
}));

vi.mock("../../cli/plugins-registry-refresh.js", () => ({
  refreshPluginRegistryAfterConfigMutation: refreshPluginRegistryAfterConfigMutationMock,
}));

vi.mock("../../config/config.js", () => ({
  readConfigFileSnapshot: readConfigFileSnapshotMock,
  validateConfigObjectWithPlugins: validateConfigObjectWithPluginsMock,
  replaceConfigFile: replaceConfigFileMock,
}));

vi.mock("../../infra/archive.js", () => ({
  resolveArchiveKind: vi.fn(() => null),
}));

vi.mock("../../infra/kovahub.js", () => ({
  parseKovaHubPluginSpec: vi.fn(() => null),
}));

vi.mock("../../plugins/kovahub.js", () => ({
  installPluginFromKovaHub: vi.fn(),
}));

vi.mock("../../plugins/install.js", () => ({
  installPluginFromNpmSpec: vi.fn(),
  installPluginFromPath: vi.fn(),
}));

vi.mock("../../plugins/installed-plugin-index-records.js", () => ({
  loadInstalledPluginIndexInstallRecords: loadInstalledPluginIndexInstallRecordsMock,
  withoutPluginInstallRecords: vi.fn((config) => ({
    ...config,
    plugins: {
      ...config.plugins,
      installs: undefined,
    },
  })),
  withPluginInstallRecords: vi.fn((config, installs) => ({
    ...config,
    plugins: {
      ...config.plugins,
      installs,
    },
  })),
}));

vi.mock("../../plugins/manifest-registry.js", () => ({
  clearPluginManifestRegistryCache: vi.fn(),
}));

vi.mock("../../plugins/status.js", () => ({
  buildAllPluginInspectReports: buildAllPluginInspectReportsMock,
  buildPluginDiagnosticsReport: buildPluginDiagnosticsReportMock,
  buildPluginInspectReport: buildPluginInspectReportMock,
  buildPluginRegistrySnapshotReport: buildPluginRegistrySnapshotReportMock,
  formatPluginCompatibilityNotice: formatPluginCompatibilityNoticeMock,
}));

vi.mock("../../plugins/toggle-config.js", () => ({
  setPluginEnabledInConfig: vi.fn((config: KovaConfig, id: string, enabled: boolean) => ({
    ...config,
    plugins: {
      ...config.plugins,
      entries: {
        ...config.plugins?.entries,
        [id]: { enabled },
      },
    },
  })),
}));

vi.mock("../../plugins/update.js", () => ({
  updateNpmInstalledPlugins: updateNpmInstalledPluginsMock,
}));

vi.mock("../../utils.js", async () => {
  const actual = await vi.importActual<typeof import("../../utils.js")>("../../utils.js");
  return {
    ...actual,
    resolveUserPath: vi.fn((value: string) => value),
  };
});

function buildCfg(): KovaConfig {
  return {
    plugins: { enabled: true },
    commands: { text: true, plugins: true },
  };
}

const WRITE_GATEWAY_SCOPES = ["operator.admin", "operator.write", "operator.pairing"];

function buildPluginsParams(
  commandBodyNormalized: string,
  cfg: KovaConfig,
  options?: { gatewayClientScopes?: string[] },
) {
  return buildPluginsCommandParams({
    commandBodyNormalized,
    cfg,
    gatewayClientScopes: options?.gatewayClientScopes,
  });
}

describe("handlePluginsCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readConfigFileSnapshotMock.mockResolvedValue({
      valid: true,
      path: "/tmp/kova.json",
      sourceConfig: buildCfg(),
      resolved: buildCfg(),
      hash: "config-1",
    });
    validateConfigObjectWithPluginsMock.mockReturnValue({
      ok: true,
      config: buildCfg(),
      issues: [],
    });
    buildPluginRegistrySnapshotReportMock.mockReturnValue({
      workspaceDir: "/tmp/plugins-workspace",
      plugins: [
        {
          id: "superpowers",
          name: "superpowers",
          status: "disabled",
          format: "kova",
          bundleFormat: "claude",
        },
      ],
    });
    buildPluginDiagnosticsReportMock.mockReturnValue({
      workspaceDir: "/tmp/plugins-workspace",
      plugins: [
        {
          id: "superpowers",
          name: "superpowers",
          status: "disabled",
          format: "kova",
          bundleFormat: "claude",
        },
      ],
    });
    buildPluginInspectReportMock.mockReturnValue({
      plugin: {
        id: "superpowers",
      },
      compatibility: [],
      bundleFormat: "claude",
      shape: { commands: ["review"] },
    });
    buildAllPluginInspectReportsMock.mockReturnValue([
      {
        plugin: { id: "superpowers" },
        compatibility: [],
      },
    ]);
    loadInstalledPluginIndexInstallRecordsMock.mockImplementation(
      async (params: { config?: KovaConfig } = {}) => params.config?.plugins?.installs ?? {},
    );
    updateNpmInstalledPluginsMock.mockResolvedValue({
      config: {
        ...buildCfg(),
        plugins: {
          ...buildCfg().plugins,
          installs: {
            superpowers: {
              source: "npm",
              spec: "@kovaai/superpowers",
              installPath: "/tmp/plugins/superpowers",
            },
          },
        },
      },
      changed: true,
      outcomes: [
        {
          pluginId: "superpowers",
          status: "updated",
          message: "Updated superpowers: 1.0.0 -> 1.1.0.",
        },
      ],
    });
  });

  it("lists discovered plugins and inspects plugin details", async () => {
    const listResult = await handlePluginsCommand(
      buildPluginsParams("/plugins list", buildCfg()),
      true,
    );
    expect(listResult?.reply?.text).toContain("Plugins");
    expect(listResult?.reply?.text).toContain("superpowers");
    expect(listResult?.reply?.text).toContain("[disabled]");

    const showResult = await handlePluginsCommand(
      buildPluginsParams("/plugins inspect superpowers", buildCfg()),
      true,
    );
    expect(showResult?.reply?.text).toContain('"id": "superpowers"');
    expect(showResult?.reply?.text).toContain('"bundleFormat": "claude"');
    expect(showResult?.reply?.text).toContain('"shape"');
    expect(showResult?.reply?.text).toContain('"compatibilityWarnings": []');

    const inspectAllResult = await handlePluginsCommand(
      buildPluginsParams("/plugins inspect all", buildCfg()),
      true,
    );
    expect(inspectAllResult?.reply?.text).toContain("```json");
    expect(inspectAllResult?.reply?.text).toContain('"plugin"');
    expect(inspectAllResult?.reply?.text).toContain('"compatibilityWarnings"');
    expect(inspectAllResult?.reply?.text).toContain('"superpowers"');
  });

  it("rejects internal writes without operator.admin", async () => {
    const params = buildPluginsParams("/plugins enable superpowers", buildCfg());
    params.command.channel = "webchat";
    params.command.channelId = "webchat";
    params.command.surface = "webchat";
    params.ctx.Provider = "webchat";
    params.ctx.Surface = "webchat";
    params.ctx.GatewayClientScopes = ["operator.write"];

    const result = await handlePluginsCommand(params, true);
    expect(result?.reply?.text).toContain("requires operator.admin");
  });

  it("enables and disables a discovered plugin", async () => {
    validateConfigObjectWithPluginsMock.mockImplementation((next) => ({ ok: true, config: next }));

    const enableParams = buildPluginsParams("/plugins enable superpowers", buildCfg(), {
      gatewayClientScopes: WRITE_GATEWAY_SCOPES,
    });
    enableParams.command.senderIsOwner = true;

    const enableResult = await handlePluginsCommand(enableParams, true);
    expect(enableResult?.reply?.text).toContain('Plugin "superpowers" enabled');
    expect(replaceConfigFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nextConfig: expect.objectContaining({
          plugins: expect.objectContaining({
            entries: expect.objectContaining({
              superpowers: expect.objectContaining({ enabled: true }),
            }),
          }),
        }),
        afterWrite: { mode: "auto" },
      }),
    );
    expect(refreshPluginRegistryAfterConfigMutationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: "policy-changed",
        config: expect.objectContaining({
          plugins: expect.objectContaining({
            entries: expect.objectContaining({
              superpowers: expect.objectContaining({ enabled: true }),
            }),
          }),
        }),
      }),
    );

    const disableParams = buildPluginsParams("/plugins disable superpowers", buildCfg(), {
      gatewayClientScopes: WRITE_GATEWAY_SCOPES,
    });
    disableParams.command.senderIsOwner = true;

    const disableResult = await handlePluginsCommand(disableParams, true);
    expect(disableResult?.reply?.text).toContain('Plugin "superpowers" disabled');
    expect(replaceConfigFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nextConfig: expect.objectContaining({
          plugins: expect.objectContaining({
            entries: expect.objectContaining({
              superpowers: expect.objectContaining({ enabled: false }),
            }),
          }),
        }),
        afterWrite: { mode: "auto" },
      }),
    );
    expect(refreshPluginRegistryAfterConfigMutationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: "policy-changed",
        config: expect.objectContaining({
          plugins: expect.objectContaining({
            entries: expect.objectContaining({
              superpowers: expect.objectContaining({ enabled: false }),
            }),
          }),
        }),
      }),
    );
  });

  it("resolves write targets by indexed plugin name without loading diagnostics", async () => {
    buildPluginRegistrySnapshotReportMock.mockReturnValue({
      workspaceDir: "/tmp/plugins-workspace",
      plugins: [
        {
          id: "superpowers",
          name: "Super Powers",
          status: "disabled",
          format: "kova",
          bundleFormat: "claude",
        },
      ],
    });
    validateConfigObjectWithPluginsMock.mockImplementation((next) => ({ ok: true, config: next }));

    const params = buildPluginsParams("/plugins enable Super Powers", buildCfg(), {
      gatewayClientScopes: WRITE_GATEWAY_SCOPES,
    });
    params.command.senderIsOwner = true;

    const result = await handlePluginsCommand(params, true);
    expect(result?.reply?.text).toContain('Plugin "superpowers" enabled');
    expect(buildPluginRegistrySnapshotReportMock).toHaveBeenCalled();
    expect(buildPluginDiagnosticsReportMock).not.toHaveBeenCalled();
  });

  it("updates tracked plugins from the command surface", async () => {
    loadInstalledPluginIndexInstallRecordsMock.mockResolvedValue({
      superpowers: {
        source: "npm",
        spec: "@kovaai/superpowers",
        installPath: "/tmp/plugins/superpowers",
      },
    });

    const params = buildPluginsParams("/plugins update superpowers", buildCfg(), {
      gatewayClientScopes: WRITE_GATEWAY_SCOPES,
    });
    params.command.senderIsOwner = true;

    const result = await handlePluginsCommand(params, true);

    expect(result?.reply?.text).toContain("Plugin update");
    expect(result?.reply?.text).toContain("Updated superpowers");
    expect(updateNpmInstalledPluginsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginIds: ["superpowers"],
        dryRun: undefined,
      }),
    );
    expect(commitPluginInstallRecordsWithConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previousInstallRecords: expect.objectContaining({ superpowers: expect.any(Object) }),
        nextInstallRecords: expect.objectContaining({ superpowers: expect.any(Object) }),
      }),
    );
    expect(refreshPluginRegistryAfterConfigMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "source-changed" }),
    );
  });

  it("returns an explicit unauthorized reply for native /plugins list", async () => {
    const params = buildPluginsParams("/plugins list", buildCfg());
    params.command.senderIsOwner = false;
    params.ctx.Provider = "telegram";
    params.ctx.Surface = "telegram";
    params.ctx.CommandSource = "native";
    params.command.channel = "telegram";
    params.command.channelId = "telegram";
    params.command.surface = "telegram";

    const result = await handlePluginsCommand(params, true);
    expect(result).toEqual({
      shouldContinue: false,
      reply: { text: "You are not authorized to use this command." },
    });
  });
});
