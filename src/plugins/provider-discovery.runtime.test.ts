import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginManifestRecord } from "./manifest-registry.js";
import type { ProviderPlugin } from "./types.js";

const mocks = vi.hoisted(() => ({
  loadManifestMetadataSnapshot: vi.fn(),
  resolveDiscoveredProviderPluginIds: vi.fn(),
  resolvePluginProviders: vi.fn(),
  loadSource: vi.fn(),
}));

vi.mock("./manifest-contract-eligibility.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./manifest-contract-eligibility.js")>();
  return {
    ...actual,
    loadManifestMetadataSnapshot: mocks.loadManifestMetadataSnapshot,
  };
});

vi.mock("./providers.js", () => ({
  resolveDiscoveredProviderPluginIds: mocks.resolveDiscoveredProviderPluginIds,
}));

vi.mock("./providers.runtime.js", () => ({
  resolvePluginProviders: mocks.resolvePluginProviders,
}));

vi.mock("./jiti-loader-cache.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./jiti-loader-cache.js")>();
  return {
    ...actual,
    createPluginJitiLoaderCache: () => new Map(),
    getCachedPluginJitiLoader: () => mocks.loadSource,
  };
});

import { resolvePluginDiscoveryProvidersRuntime } from "./provider-discovery.runtime.js";

function createManifestPlugin(id: string): PluginManifestRecord {
  return {
    id,
    enabledByDefault: true,
    channels: [],
    providers: [id],
    cliBackends: [],
    skills: [],
    hooks: [],
    origin: "bundled",
    rootDir: `/tmp/${id}`,
    source: "bundled",
    manifestPath: `/tmp/${id}/kova.plugin.json`,
    modelCatalog: {},
    providerDiscoverySource: `/tmp/${id}/provider-discovery.ts`,
  };
}

function createMetadataSnapshot(plugins: PluginManifestRecord[]) {
  return {
    index: { plugins: [] },
    manifestRegistry: {
      plugins,
      diagnostics: [],
    },
  };
}

function createManifestPluginWithoutDiscovery(params: {
  id: string;
  providerAuthEnvVars?: Record<string, string[]>;
}): PluginManifestRecord {
  const { providerDiscoverySource: _providerDiscoverySource, ...plugin } = createManifestPlugin(
    params.id,
  );
  return {
    ...plugin,
    ...(params.providerAuthEnvVars ? { providerAuthEnvVars: params.providerAuthEnvVars } : {}),
  };
}

function createProvider(params: { id: string; mode: "static" | "catalog" }): ProviderPlugin {
  const hook = {
    run: async () => ({
      provider: {
        baseUrl: "https://example.test/v1",
        models: [],
      },
    }),
  };
  return {
    id: params.id,
    label: params.id,
    auth: [],
    ...(params.mode === "static" ? { staticCatalog: hook } : { catalog: hook }),
  };
}

describe("resolvePluginDiscoveryProvidersRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveDiscoveredProviderPluginIds.mockReturnValue(["deepseek"]);
    mocks.loadManifestMetadataSnapshot.mockReturnValue(
      createMetadataSnapshot([createManifestPlugin("deepseek")]),
    );
  });

  it("uses static discovery entry catalogs without loading the full provider plugin", () => {
    const staticProvider = createProvider({ id: "deepseek", mode: "static" });
    mocks.loadSource.mockReturnValue(staticProvider);

    expect(resolvePluginDiscoveryProvidersRuntime({})).toEqual([
      expect.objectContaining({
        id: "deepseek",
        pluginId: "deepseek",
        staticCatalog: staticProvider.staticCatalog,
      }),
    ]);
    expect(mocks.resolvePluginProviders).not.toHaveBeenCalled();
  });

  it("keeps unscoped discovery bounded for mixed live and static-only entries", () => {
    const codexEntryProvider = createProvider({ id: "codex", mode: "catalog" });
    const fullProviders = [createProvider({ id: "kilocode", mode: "catalog" })];
    const deepseekStaticProvider = createProvider({ id: "deepseek", mode: "static" });
    mocks.resolveDiscoveredProviderPluginIds.mockReturnValue([
      "codex",
      "deepseek",
      "kilocode",
      "unused",
    ]);
    mocks.loadManifestMetadataSnapshot.mockReturnValue(
      createMetadataSnapshot([
        createManifestPlugin("codex"),
        createManifestPlugin("deepseek"),
        createManifestPluginWithoutDiscovery({
          id: "kilocode",
          providerAuthEnvVars: { kilocode: ["KILOCODE_API_KEY"] },
        }),
        createManifestPluginWithoutDiscovery({
          id: "unused",
          providerAuthEnvVars: { unused: ["UNUSED_API_KEY"] },
        }),
      ]),
    );
    mocks.loadSource.mockImplementation((modulePath: string) =>
      modulePath.includes("/codex/") ? codexEntryProvider : deepseekStaticProvider,
    );
    mocks.resolvePluginProviders.mockReturnValue(fullProviders);

    expect(
      resolvePluginDiscoveryProvidersRuntime({
        env: { KILOCODE_API_KEY: "sk-test" } as NodeJS.ProcessEnv,
      }),
    ).toEqual([
      { ...codexEntryProvider, pluginId: "codex" },
      { ...deepseekStaticProvider, pluginId: "deepseek" },
      ...fullProviders,
    ]);
    expect(mocks.resolvePluginProviders).toHaveBeenCalledWith(
      expect.objectContaining({
        onlyPluginIds: ["kilocode"],
      }),
    );
  });

  it("shares one metadata snapshot between provider id discovery and entry loading", () => {
    const metadataSnapshot = createMetadataSnapshot([createManifestPlugin("deepseek")]);
    mocks.loadManifestMetadataSnapshot.mockReturnValue(metadataSnapshot);
    mocks.loadSource.mockReturnValue(createProvider({ id: "deepseek", mode: "catalog" }));

    resolvePluginDiscoveryProvidersRuntime({ config: {}, env: {} as NodeJS.ProcessEnv });

    expect(mocks.loadManifestMetadataSnapshot).toHaveBeenCalledWith({
      config: {},
      env: {},
    });
    expect(mocks.loadManifestMetadataSnapshot).toHaveBeenCalledOnce();
    expect(mocks.resolveDiscoveredProviderPluginIds).toHaveBeenCalledWith(
      expect.objectContaining({
        registry: metadataSnapshot.index,
        manifestRegistry: metadataSnapshot.manifestRegistry,
      }),
    );
  });

  it("returns static-only discovery entries for callers that explicitly request them", () => {
    const staticProvider = createProvider({ id: "deepseek", mode: "static" });
    mocks.loadSource.mockReturnValue(staticProvider);

    expect(resolvePluginDiscoveryProvidersRuntime({ discoveryEntriesOnly: true })).toEqual([
      expect.objectContaining({
        id: "deepseek",
        pluginId: "deepseek",
        staticCatalog: staticProvider.staticCatalog,
      }),
    ]);
    expect(mocks.resolvePluginProviders).not.toHaveBeenCalled();
  });

  it("uses manifest model catalog rows as static discovery entries without loading plugin runtime", async () => {
    const plugin = {
      ...createManifestPluginWithoutDiscovery({ id: "manifest-models" }),
      providers: ["manifest-models"],
      modelCatalog: {
        providers: {
          "manifest-models": {
            baseUrl: "https://models.example/v1",
            api: "openai-completions",
            models: [
              {
                id: "fast",
                name: "Fast",
                input: ["text"],
                reasoning: false,
                contextWindow: 128_000,
                maxTokens: 4096,
              },
            ],
          },
        },
      },
    } satisfies PluginManifestRecord;
    mocks.resolveDiscoveredProviderPluginIds.mockReturnValue(["manifest-models"]);
    mocks.loadManifestMetadataSnapshot.mockReturnValue(createMetadataSnapshot([plugin]));

    const providers = resolvePluginDiscoveryProvidersRuntime({
      discoveryEntriesOnly: true,
    });

    expect(providers).toHaveLength(1);
    expect(providers[0]).toEqual(
      expect.objectContaining({
        id: "manifest-models",
        pluginId: "manifest-models",
        staticCatalog: expect.any(Object),
      }),
    );
    await expect(providers[0]?.staticCatalog?.run()).resolves.toMatchObject({
      providers: {
        "manifest-models": {
          baseUrl: "https://models.example/v1",
          models: [expect.objectContaining({ id: "fast" })],
        },
      },
    });
    expect(mocks.loadSource).not.toHaveBeenCalled();
    expect(mocks.resolvePluginProviders).not.toHaveBeenCalled();
  });
});
