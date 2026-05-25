import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../config/types.kova.js";
import { resolveInstalledPluginIndexPolicyHash } from "./installed-plugin-index-policy.js";
import type { PluginManifestRecord, PluginManifestRegistry } from "./manifest-registry.js";
import type { PluginMetadataSnapshot } from "./plugin-metadata-snapshot.js";
import type { PluginRegistrySnapshot } from "./plugin-registry.js";

const listPotentialConfiguredChannelIds = vi.hoisted(() => vi.fn());
const loadPluginManifestRegistryForInstalledIndex = vi.hoisted(() => vi.fn());

vi.mock("../channels/config-presence.js", () => ({
  hasMeaningfulChannelConfig: (value: unknown) =>
    Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).some((key) => key !== "enabled"),
    ),
  listPotentialConfiguredChannelIds: (
    config: KovaConfig,
    env: NodeJS.ProcessEnv,
    options?: { includePersistedAuthState?: boolean },
  ) => listPotentialConfiguredChannelIds(config, env, options),
}));

vi.mock("./manifest-registry-installed.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./manifest-registry-installed.js")>();
  return {
    ...actual,
    loadPluginManifestRegistryForInstalledIndex: (params: unknown) =>
      loadPluginManifestRegistryForInstalledIndex(params),
  };
});

function createManifestRecord(
  plugin: Partial<PluginManifestRecord> & Pick<PluginManifestRecord, "id" | "origin">,
): PluginManifestRecord {
  return {
    name: plugin.id,
    channels: [],
    providers: [],
    cliBackends: [],
    skills: [],
    hooks: [],
    rootDir: `/plugins/${plugin.id}`,
    source: `/plugins/${plugin.id}/index.js`,
    manifestPath: `/plugins/${plugin.id}/kova.plugin.json`,
    ...plugin,
  };
}

function createIndex(plugins: readonly PluginManifestRecord[]): PluginRegistrySnapshot {
  return {
    version: 1,
    hostContractVersion: "test",
    compatRegistryVersion: "test",
    migrationVersion: 1,
    policyHash: "policy",
    generatedAtMs: 1,
    installRecords: {},
    diagnostics: [],
    plugins: plugins.map((plugin) => ({
      pluginId: plugin.id,
      manifestPath: plugin.manifestPath,
      manifestHash: `${plugin.id}-hash`,
      rootDir: plugin.rootDir,
      origin: plugin.origin,
      enabled: true,
      ...(plugin.enabledByDefault !== undefined
        ? { enabledByDefault: plugin.enabledByDefault }
        : {}),
      startup: {
        sidecar: false,
        memory: false,
        deferConfiguredChannelFullLoadUntilAfterListen: Boolean(
          plugin.startupDeferConfiguredChannelFullLoadUntilAfterListen,
        ),
        agentHarnesses: [],
      },
      compat: [],
    })),
  };
}

const indexDiagnostic = {
  level: "warn",
  source: "/plugins/demo/kova.plugin.json",
  message: "indexed warning",
} as const;

const manifestDiagnostic = {
  level: "warn",
  source: "/plugins/demo/kova.plugin.json",
  message: "manifest warning",
} as const;

describe("loadPluginLookUpTable", () => {
  beforeEach(() => {
    listPotentialConfiguredChannelIds
      .mockReset()
      .mockImplementation((config: KovaConfig) => Object.keys(config.channels ?? {}));
    loadPluginManifestRegistryForInstalledIndex.mockReset();
  });

  it("builds owner maps and startup ids from one installed manifest registry", async () => {
    const plugins = [
      createManifestRecord({
        id: "telegram",
        origin: "bundled",
        channels: ["telegram"],
        channelConfigs: {
          telegram: {
            schema: { type: "object" },
          },
        },
        commandAliases: [{ name: "telegram-send" }],
        contracts: {
          tools: ["telegram.send"],
        },
      }),
      createManifestRecord({
        id: "openai",
        origin: "bundled",
        providers: ["openai", "openai-codex"],
        modelCatalog: {
          providers: {
            openai: {
              models: [{ id: "gpt-test" }],
            },
          },
        },
        cliBackends: ["codex-cli"],
        setup: {
          providers: [{ id: "openai" }],
        },
      }),
    ];
    const index = {
      ...createIndex(plugins),
      diagnostics: [indexDiagnostic],
    };
    const manifestRegistry: PluginManifestRegistry = {
      plugins,
      diagnostics: [indexDiagnostic, manifestDiagnostic],
    };
    loadPluginManifestRegistryForInstalledIndex.mockReturnValue(manifestRegistry);
    const { loadPluginLookUpTable } = await import("./plugin-lookup-table.js");

    const table = loadPluginLookUpTable({
      config: {
        channels: {
          telegram: { token: "configured" },
        },
        plugins: {
          slots: { memory: "none" },
        },
      } as KovaConfig,
      env: {},
      index,
    });

    expect(table.manifestRegistry).toBe(manifestRegistry);
    expect(table.diagnostics).toEqual([indexDiagnostic, manifestDiagnostic]);
    expect(table.metrics).toMatchObject({
      registrySnapshotMs: expect.any(Number),
      manifestRegistryMs: expect.any(Number),
      startupPlanMs: expect.any(Number),
      ownerMapsMs: expect.any(Number),
      totalMs: expect.any(Number),
      indexPluginCount: 2,
      manifestPluginCount: 2,
      startupPluginCount: 1,
      deferredChannelPluginCount: 0,
    });
    expect(table.byPluginId.get("telegram")?.id).toBe("telegram");
    expect(table.normalizePluginId("openai-codex")).toBe("openai");
    expect(table.owners.channels.get("telegram")).toEqual(["telegram"]);
    expect(table.owners.channelConfigs.get("telegram")).toEqual(["telegram"]);
    expect(table.owners.providers.get("openai")).toEqual(["openai"]);
    expect(table.owners.modelCatalogProviders.get("openai")).toEqual(["openai"]);
    expect(table.owners.cliBackends.get("codex-cli")).toEqual(["openai"]);
    expect(table.owners.setupProviders.get("openai")).toEqual(["openai"]);
    expect(table.owners.commandAliases.get("telegram-send")).toEqual(["telegram"]);
    expect(table.owners.contracts.get("tools")).toEqual(["telegram"]);
    expect(table.startup.channelPluginIds).toEqual(["telegram"]);
    expect(table.startup.configuredDeferredChannelPluginIds).toEqual([]);
    expect(table.startup.pluginIds).toEqual(["telegram"]);
  });

  it("reuses a compatible plugin metadata snapshot", async () => {
    const plugins = [
      createManifestRecord({
        id: "telegram",
        origin: "bundled",
        channels: ["telegram"],
      }),
    ];
    const config = {
      channels: {
        telegram: { token: "configured" },
      },
      plugins: {
        slots: { memory: "none" },
      },
    } as KovaConfig;
    const index = {
      ...createIndex(plugins),
      policyHash: resolveInstalledPluginIndexPolicyHash(config),
    };
    const manifestRegistry: PluginManifestRegistry = {
      plugins,
      diagnostics: [manifestDiagnostic],
    };
    const owners = {
      channels: new Map([["telegram", Object.freeze(["telegram"])]]) as ReadonlyMap<
        string,
        readonly string[]
      >,
      channelConfigs: new Map(),
      providers: new Map(),
      modelCatalogProviders: new Map(),
      cliBackends: new Map(),
      setupProviders: new Map(),
      commandAliases: new Map(),
      contracts: new Map(),
    };
    const normalizePluginId = vi.fn((pluginId: string) => pluginId);
    const metadataSnapshot: PluginMetadataSnapshot = {
      policyHash: index.policyHash,
      index,
      registryDiagnostics: [],
      manifestRegistry,
      plugins,
      diagnostics: manifestRegistry.diagnostics,
      byPluginId: new Map(plugins.map((plugin) => [plugin.id, plugin])),
      normalizePluginId,
      owners,
      metrics: {
        registrySnapshotMs: 10,
        manifestRegistryMs: 20,
        ownerMapsMs: 30,
        totalMs: 60,
        indexPluginCount: 1,
        manifestPluginCount: 1,
      },
    };
    const { loadPluginLookUpTable } = await import("./plugin-lookup-table.js");

    const table = loadPluginLookUpTable({
      config,
      env: {},
      index,
      metadataSnapshot,
    });

    expect(loadPluginManifestRegistryForInstalledIndex).not.toHaveBeenCalled();
    expect(table.manifestRegistry).toBe(manifestRegistry);
    expect(table.byPluginId).toBe(metadataSnapshot.byPluginId);
    expect(table.owners).toBe(owners);
    expect(table.normalizePluginId).toBe(normalizePluginId);
    expect(table.startup.pluginIds).toEqual(["telegram"]);
  });
});
