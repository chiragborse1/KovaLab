import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readPersistedInstalledPluginIndex,
  writePersistedInstalledPluginIndex,
} from "./installed-plugin-index-store.js";
import type { InstalledPluginIndex } from "./installed-plugin-index.js";
import {
  clearInstalledManifestRegistryCache,
  loadPluginManifestRegistryForInstalledIndex,
} from "./manifest-registry-installed.js";
import { clearPluginMetadataLifecycleCaches } from "./plugin-metadata-lifecycle.js";
import { cleanupTrackedTempDirs, makeTrackedTempDir } from "./test-helpers/fs-fixtures.js";

const tempDirs: string[] = [];

afterEach(() => {
  clearInstalledManifestRegistryCache();
  vi.restoreAllMocks();
  cleanupTrackedTempDirs(tempDirs);
});

function makeTempDir() {
  return makeTrackedTempDir("kova-installed-manifest-registry", tempDirs);
}

function writePlugin(rootDir: string, pluginId: string, modelPrefix: string) {
  fs.writeFileSync(
    path.join(rootDir, "index.ts"),
    "throw new Error('runtime entry should not load while reading manifests');\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(rootDir, "kova.plugin.json"),
    JSON.stringify({
      id: pluginId,
      configSchema: { type: "object" },
      providers: [pluginId],
      modelSupport: {
        modelPrefixes: [modelPrefix],
      },
    }),
    "utf8",
  );
}

function createIndex(rootDir: string): InstalledPluginIndex {
  return {
    version: 1,
    hostContractVersion: "2026.4.25",
    compatRegistryVersion: "compat-v1",
    migrationVersion: 1,
    policyHash: "policy-v1",
    generatedAtMs: 1777118400000,
    installRecords: {},
    plugins: [
      {
        pluginId: "installed",
        manifestPath: path.join(rootDir, "kova.plugin.json"),
        manifestHash: "manifest-hash",
        source: path.join(rootDir, "index.ts"),
        rootDir,
        origin: "global",
        enabled: true,
        startup: {
          sidecar: false,
          memory: false,
          deferConfiguredChannelFullLoadUntilAfterListen: false,
          agentHarnesses: [],
        },
        compat: [],
      },
    ],
    diagnostics: [],
  };
}

function writePackageManifest(rootDir: string, label: string) {
  fs.writeFileSync(
    path.join(rootDir, "package.json"),
    JSON.stringify({
      dependencies: {
        "runtime-dep": "1.0.0",
      },
      kova: {
        channel: {
          id: "installed",
          label,
          commands: {
            nativeCommandsAutoEnabled: true,
            nativeSkillsAutoEnabled: false,
          },
        },
      },
    }),
    "utf8",
  );
}

function createIndexWithPackageJson(rootDir: string): InstalledPluginIndex {
  const index = createIndex(rootDir);
  return {
    ...index,
    plugins: [
      {
        ...index.plugins[0],
        packageChannel: {
          id: "installed",
          label: "Installed",
        },
        packageJson: {
          path: "package.json",
          hash: "stable-package-hash",
        },
      },
    ],
  };
}

describe("loadPluginManifestRegistryForInstalledIndex", () => {
  it("reuses installed-index manifest registries for identical runtime lookups", () => {
    const rootDir = makeTempDir();
    writePlugin(rootDir, "installed", "installed-");
    const index = createIndex(rootDir);
    const readFileSync = vi.spyOn(fs, "readFileSync");
    const env = {
      KOVA_VERSION: "2026.4.25",
      VITEST: "true",
    };

    const first = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });
    const readsAfterFirstLoad = readFileSync.mock.calls.length;
    const second = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });

    expect(second).toBe(first);
    expect(readFileSync.mock.calls.length).toBe(readsAfterFirstLoad);
  });

  it("refreshes the installed-index manifest registry cache when manifest files change", () => {
    const rootDir = makeTempDir();
    const manifestPath = path.join(rootDir, "kova.plugin.json");
    writePlugin(rootDir, "installed", "installed-");
    const index = createIndex(rootDir);
    const env = {
      KOVA_VERSION: "2026.4.25",
      VITEST: "true",
    };

    const first = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });
    expect(first.plugins[0]?.modelSupport).toEqual({
      modelPrefixes: ["installed-"],
    });

    writePlugin(rootDir, "installed", "updated-installed-");
    const nextMtime = new Date(Date.now() + 5000);
    fs.utimesSync(manifestPath, nextMtime, nextMtime);

    const second = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });

    expect(second).not.toBe(first);
    expect(second.plugins[0]?.modelSupport).toEqual({
      modelPrefixes: ["updated-installed-"],
    });
  });

  it("bypasses the installed-index manifest registry cache when disabled", () => {
    const rootDir = makeTempDir();
    writePlugin(rootDir, "installed", "installed-");
    const index = createIndex(rootDir);
    const readFileSync = vi.spyOn(fs, "readFileSync");
    const env = {
      KOVA_DISABLE_INSTALLED_PLUGIN_MANIFEST_REGISTRY_CACHE: "1",
      KOVA_VERSION: "2026.4.25",
      VITEST: "true",
    };

    const first = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });
    const readsAfterFirstLoad = readFileSync.mock.calls.length;
    const second = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });

    expect(second).not.toBe(first);
    expect(readFileSync.mock.calls.length).toBeGreaterThan(readsAfterFirstLoad);
  });

  it("loads manifest metadata only for plugins present in the installed index", () => {
    const installedRoot = makeTempDir();
    const unrelatedRoot = makeTempDir();
    writePlugin(installedRoot, "installed", "installed-");
    writePlugin(unrelatedRoot, "unrelated", "unrelated-");

    const registry = loadPluginManifestRegistryForInstalledIndex({
      index: createIndex(installedRoot),
      env: {
        KOVA_DISABLE_PLUGIN_DISCOVERY_CACHE: "1",
        KOVA_DISABLE_PLUGIN_MANIFEST_CACHE: "1",
        KOVA_VERSION: "2026.4.25",
        VITEST: "true",
      },
      includeDisabled: true,
    });

    expect(registry.plugins.map((plugin) => plugin.id)).toEqual(["installed"]);
    expect(registry.plugins[0]?.modelSupport).toEqual({
      modelPrefixes: ["installed-"],
    });
  });

  it("reconstructs bundle candidates with their bundle manifest format", () => {
    const rootDir = makeTempDir();
    fs.mkdirSync(path.join(rootDir, ".claude-plugin"), { recursive: true });
    fs.mkdirSync(path.join(rootDir, "commands"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "Claude Bundle",
        commands: "commands",
      }),
      "utf8",
    );

    const index = createIndex(rootDir);
    const registry = loadPluginManifestRegistryForInstalledIndex({
      index: {
        ...index,
        plugins: [
          {
            ...index.plugins[0],
            pluginId: "claude-bundle",
            manifestPath: path.join(rootDir, ".claude-plugin", "plugin.json"),
            source: rootDir,
            format: "bundle",
            bundleFormat: "claude",
          },
        ],
      },
      env: {
        KOVA_DISABLE_PLUGIN_DISCOVERY_CACHE: "1",
        KOVA_DISABLE_PLUGIN_MANIFEST_CACHE: "1",
        KOVA_VERSION: "2026.4.25",
        VITEST: "true",
      },
      includeDisabled: true,
    });

    expect(registry.diagnostics).toEqual([]);
    expect(registry.plugins).toEqual([
      expect.objectContaining({
        id: "claude-bundle",
        format: "bundle",
        bundleFormat: "claude",
        skills: ["commands"],
      }),
    ]);
  });

  it("hydrates package channel command metadata while reconstructing from an older index", () => {
    const rootDir = makeTempDir();
    writePlugin(rootDir, "installed", "installed-");
    fs.writeFileSync(
      path.join(rootDir, "package.json"),
      JSON.stringify({
        kova: {
          channel: {
            id: "installed",
            label: "Installed",
            commands: {
              nativeCommandsAutoEnabled: true,
              nativeSkillsAutoEnabled: false,
            },
          },
        },
      }),
      "utf8",
    );

    const index = createIndex(rootDir);
    const registry = loadPluginManifestRegistryForInstalledIndex({
      index: {
        ...index,
        plugins: [
          {
            ...index.plugins[0],
            packageChannel: {
              id: "installed",
              label: "Installed",
            },
            packageJson: {
              path: "package.json",
              hash: "old-index-hash",
            },
          },
        ],
      },
      env: {
        KOVA_DISABLE_PLUGIN_DISCOVERY_CACHE: "1",
        KOVA_DISABLE_PLUGIN_MANIFEST_CACHE: "1",
        KOVA_VERSION: "2026.4.25",
        VITEST: "true",
      },
      includeDisabled: true,
    });

    expect(registry.plugins[0]?.channelCatalogMeta?.commands).toEqual({
      nativeCommandsAutoEnabled: true,
      nativeSkillsAutoEnabled: false,
    });
  });

  it("reuses installed package metadata until plugin metadata caches are cleared", () => {
    const rootDir = makeTempDir();
    writePlugin(rootDir, "installed", "installed-");
    writePackageManifest(rootDir, "Installed");
    const index = createIndexWithPackageJson(rootDir);
    const env = {
      KOVA_VERSION: "2026.4.25",
      VITEST: "true",
    };

    const first = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });
    writePackageManifest(rootDir, "Updated");
    const nextMtime = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(rootDir, "package.json"), nextMtime, nextMtime);
    const second = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });
    clearPluginMetadataLifecycleCaches();
    const third = loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });

    expect(first.plugins[0]?.packageChannel?.label).toBe("Installed");
    expect(second.plugins[0]?.packageChannel?.label).toBe("Installed");
    expect(third.plugins[0]?.packageChannel?.label).toBe("Updated");
    expect(third.plugins[0]?.packageDependencies).toEqual({
      "runtime-dep": "1.0.0",
    });
  });

  it("reuses installed package json path validation across registry loads", () => {
    const rootDir = makeTempDir();
    writePlugin(rootDir, "installed", "installed-");
    writePackageManifest(rootDir, "Installed");
    const index = createIndexWithPackageJson(rootDir);
    const env = {
      KOVA_VERSION: "2026.4.25",
      VITEST: "true",
    };

    loadPluginManifestRegistryForInstalledIndex({
      index,
      env,
      includeDisabled: true,
    });
    const realpathSpy = vi.spyOn(fs, "realpathSync");
    let packagePathCalls: unknown[][] = [];
    try {
      loadPluginManifestRegistryForInstalledIndex({
        index,
        env,
        includeDisabled: true,
      });
      const packageJsonPath = path.join(rootDir, "package.json");
      packagePathCalls = realpathSpy.mock.calls.filter(
        ([filePath]) => filePath === packageJsonPath,
      );
    } finally {
      realpathSpy.mockRestore();
    }

    expect(packagePathCalls).toStrictEqual([]);
  });

  it("round-trips bundle metadata through the persisted index before reconstruction", async () => {
    const stateDir = makeTempDir();
    const rootDir = makeTempDir();
    fs.mkdirSync(path.join(rootDir, ".claude-plugin"), { recursive: true });
    fs.mkdirSync(path.join(rootDir, "commands"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "Claude Bundle",
        commands: "commands",
      }),
      "utf8",
    );

    const index = createIndex(rootDir);
    await writePersistedInstalledPluginIndex(
      {
        ...index,
        plugins: [
          {
            ...index.plugins[0],
            pluginId: "claude-bundle",
            manifestPath: path.join(rootDir, ".claude-plugin", "plugin.json"),
            source: rootDir,
            format: "bundle",
            bundleFormat: "claude",
            setupSource: path.join(rootDir, "setup-api.js"),
          },
        ],
      },
      { stateDir },
    );

    const persisted = await readPersistedInstalledPluginIndex({ stateDir });
    if (!persisted) {
      throw new Error("expected persisted installed plugin index");
    }
    expect(persisted?.plugins[0]).toMatchObject({
      pluginId: "claude-bundle",
      source: rootDir,
      format: "bundle",
      bundleFormat: "claude",
      setupSource: path.join(rootDir, "setup-api.js"),
      rootDir,
    });

    const registry = loadPluginManifestRegistryForInstalledIndex({
      index: persisted,
      env: {
        KOVA_DISABLE_PLUGIN_DISCOVERY_CACHE: "1",
        KOVA_DISABLE_PLUGIN_MANIFEST_CACHE: "1",
        KOVA_VERSION: "2026.4.25",
        VITEST: "true",
      },
      includeDisabled: true,
    });

    expect(registry.diagnostics).toEqual([]);
    expect(registry.plugins).toEqual([
      expect.objectContaining({
        id: "claude-bundle",
        format: "bundle",
        bundleFormat: "claude",
        rootDir,
        skills: ["commands"],
      }),
    ]);
  });
});
