import { afterEach, describe, expect, it } from "vitest";
import type { KovaConfig } from "../config/types.kova.js";
import {
  clearCurrentPluginMetadataSnapshot,
  getCurrentPluginMetadataSnapshot,
  setCurrentPluginMetadataSnapshot,
} from "./current-plugin-metadata-snapshot.js";
import { resolveInstalledPluginIndexPolicyHash } from "./installed-plugin-index-policy.js";
import {
  INSTALLED_PLUGIN_INDEX_MIGRATION_VERSION,
  INSTALLED_PLUGIN_INDEX_VERSION,
  type InstalledPluginIndex,
} from "./installed-plugin-index-types.js";
import type { PluginMetadataSnapshot } from "./plugin-metadata-snapshot.types.js";

function makeEmptyIndex(config: KovaConfig): InstalledPluginIndex {
  return {
    version: INSTALLED_PLUGIN_INDEX_VERSION,
    hostContractVersion: "test",
    compatRegistryVersion: "test",
    migrationVersion: INSTALLED_PLUGIN_INDEX_MIGRATION_VERSION,
    policyHash: resolveInstalledPluginIndexPolicyHash(config),
    generatedAtMs: 1,
    installRecords: {},
    plugins: [],
    diagnostics: [],
  };
}

function makeSnapshot(config: KovaConfig): PluginMetadataSnapshot {
  const index = makeEmptyIndex(config);
  return {
    policyHash: index.policyHash,
    index,
    registryDiagnostics: [],
    manifestRegistry: { plugins: [], diagnostics: [] },
    plugins: [],
    diagnostics: [],
    byPluginId: new Map(),
    normalizePluginId: (pluginId) => pluginId,
    owners: {
      channels: new Map(),
      channelConfigs: new Map(),
      providers: new Map(),
      modelCatalogProviders: new Map(),
      cliBackends: new Map(),
      setupProviders: new Map(),
      commandAliases: new Map(),
      contracts: new Map(),
    },
    metrics: {
      registrySnapshotMs: 0,
      manifestRegistryMs: 0,
      ownerMapsMs: 0,
      totalMs: 0,
      indexPluginCount: 0,
      manifestPluginCount: 0,
    },
  };
}

afterEach(() => {
  clearCurrentPluginMetadataSnapshot();
});

describe("current plugin metadata snapshot", () => {
  it("reuses the same config object without recomputing discovery fingerprints", () => {
    const config: KovaConfig = { plugins: { load: { paths: ["/one"] } } };
    const snapshot = makeSnapshot(config);
    setCurrentPluginMetadataSnapshot(snapshot, { config });

    config.plugins = { ...config.plugins, load: { paths: ["/two"] } };

    expect(getCurrentPluginMetadataSnapshot({ config })).toBe(snapshot);
    expect(
      getCurrentPluginMetadataSnapshot({
        config: { plugins: { load: { paths: ["/two"] } } },
      }),
    ).toBeUndefined();
  });

  it("still rejects a cached config object when the workspace scope does not match", () => {
    const config: KovaConfig = { plugins: { load: { paths: ["/one"] } } };
    const snapshot = { ...makeSnapshot(config), workspaceDir: "/workspace-a" };
    setCurrentPluginMetadataSnapshot(snapshot, { config, workspaceDir: "/workspace-a" });

    expect(getCurrentPluginMetadataSnapshot({ config })).toBeUndefined();
    expect(
      getCurrentPluginMetadataSnapshot({ config, workspaceDir: "/workspace-b" }),
    ).toBeUndefined();
    expect(getCurrentPluginMetadataSnapshot({ config, workspaceDir: "/workspace-a" })).toBe(
      snapshot,
    );
  });
});
