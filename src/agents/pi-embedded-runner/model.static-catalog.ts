import type { Api, Model } from "@mariozechner/pi-ai";
import type { KovaConfig } from "../../config/types.kova.js";
import { planManifestModelCatalogRows } from "../../model-catalog/index.js";
import type { NormalizedModelCatalogRow } from "../../model-catalog/types.js";
import { loadManifestMetadataRegistry } from "../../plugins/manifest-contract-eligibility.js";
import type { PluginManifestRecord } from "../../plugins/manifest-registry.js";
import { normalizeStaticProviderModelId } from "../model-ref-shared.js";
import { normalizeProviderId } from "../provider-id.js";

function rowMatchesModel(params: {
  row: NormalizedModelCatalogRow;
  provider: string;
  modelId: string;
}): boolean {
  const normalizedProvider = normalizeProviderId(params.provider);
  if (normalizeProviderId(params.row.provider) !== normalizedProvider) {
    return false;
  }
  return (
    normalizeStaticProviderModelId(normalizedProvider, params.row.id).trim().toLowerCase() ===
    normalizeStaticProviderModelId(normalizedProvider, params.modelId).trim().toLowerCase()
  );
}

function modelFromStaticCatalogRow(row: NormalizedModelCatalogRow): Model<Api> {
  return {
    id: row.id,
    name: row.name || row.id,
    provider: row.provider,
    api: row.api ?? "openai-responses",
    baseUrl: row.baseUrl,
    reasoning: row.reasoning,
    input: row.input,
    cost: row.cost,
    contextWindow: row.contextWindow,
    contextTokens: row.contextTokens,
    maxTokens: row.maxTokens,
    headers: row.headers,
    compat: row.compat,
  } as Model<Api>;
}

type StaticCatalogPlugin = Parameters<
  typeof planManifestModelCatalogRows
>[0]["registry"]["plugins"][number];

function listBundledStaticCatalogPlugins(params: {
  cfg?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): StaticCatalogPlugin[] {
  return loadManifestMetadataRegistry({
    config: params.cfg,
    workspaceDir: params.workspaceDir,
    env: params.env ?? process.env,
  }).manifestRegistry.plugins.flatMap((plugin: PluginManifestRecord): StaticCatalogPlugin[] => {
    if (plugin.origin !== "bundled" || !plugin.modelCatalog) {
      return [];
    }
    return [
      {
        id: plugin.id,
        modelCatalog: plugin.modelCatalog,
      },
    ];
  });
}

export function resolveBundledStaticCatalogModel(params: {
  provider: string;
  modelId: string;
  cfg?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): Model<Api> | undefined {
  const provider = normalizeProviderId(params.provider);
  if (!provider || !params.modelId.trim()) {
    return undefined;
  }
  const bundledStaticPlugins = listBundledStaticCatalogPlugins({
    cfg: params.cfg,
    workspaceDir: params.workspaceDir,
    env: params.env,
  });
  if (bundledStaticPlugins.length === 0) {
    return undefined;
  }
  const plan = planManifestModelCatalogRows({
    registry: { plugins: bundledStaticPlugins },
    providerFilter: provider,
  });
  for (const entry of plan.entries) {
    if (entry.discovery && entry.discovery !== "static" && entry.discovery !== "refreshable") {
      continue;
    }
    const row = entry.rows.find((candidate) =>
      rowMatchesModel({
        row: candidate,
        provider,
        modelId: params.modelId,
      }),
    );
    if (row) {
      return modelFromStaticCatalogRow(row);
    }
  }
  return undefined;
}
