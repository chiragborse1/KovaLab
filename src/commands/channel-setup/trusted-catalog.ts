import {
  getChannelPluginCatalogEntry,
  listChannelPluginCatalogEntries,
  type ChannelPluginCatalogEntry,
} from "../../channels/plugins/catalog.js";
import { applyPluginAutoEnable } from "../../config/plugin-auto-enable.js";
import type { KovaConfig } from "../../config/types.kova.js";
import { normalizePluginsConfig, resolveEnableState } from "../../plugins/config-state.js";

function resolveEffectiveTrustConfig(cfg: KovaConfig, env?: NodeJS.ProcessEnv): KovaConfig {
  return applyPluginAutoEnable({
    config: cfg,
    env: env ?? process.env,
  }).config;
}

function isTrustedWorkspaceChannelCatalogEntry(
  entry: ChannelPluginCatalogEntry | undefined,
  cfg: KovaConfig,
  env?: NodeJS.ProcessEnv,
): boolean {
  if (entry?.origin !== "workspace") {
    return true;
  }
  if (!entry.pluginId) {
    return false;
  }
  const effectiveConfig = resolveEffectiveTrustConfig(cfg, env);
  return resolveEnableState(
    entry.pluginId,
    "workspace",
    normalizePluginsConfig(effectiveConfig.plugins),
  ).enabled;
}

export function getTrustedChannelPluginCatalogEntry(
  channelId: string,
  params: {
    cfg: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  },
): ChannelPluginCatalogEntry | undefined {
  const candidate = getChannelPluginCatalogEntry(channelId, {
    workspaceDir: params.workspaceDir,
  });
  if (isTrustedWorkspaceChannelCatalogEntry(candidate, params.cfg, params.env)) {
    return candidate;
  }
  return getChannelPluginCatalogEntry(channelId, {
    workspaceDir: params.workspaceDir,
    excludeWorkspace: true,
  });
}

function listChannelPluginCatalogEntriesWithTrustedFallback(
  params: {
    cfg: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  },
  onMissingFallback: (entry: ChannelPluginCatalogEntry) => ChannelPluginCatalogEntry[],
): ChannelPluginCatalogEntry[] {
  const unfiltered = listChannelPluginCatalogEntries({
    workspaceDir: params.workspaceDir,
  });
  const fallbackById = new Map(
    listChannelPluginCatalogEntries({
      workspaceDir: params.workspaceDir,
      excludeWorkspace: true,
    }).map((entry) => [entry.id, entry]),
  );
  return unfiltered.flatMap((entry) => {
    if (isTrustedWorkspaceChannelCatalogEntry(entry, params.cfg, params.env)) {
      return [entry];
    }
    const fallback = fallbackById.get(entry.id);
    return fallback ? [fallback] : onMissingFallback(entry);
  });
}

export function listTrustedChannelPluginCatalogEntries(params: {
  cfg: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): ChannelPluginCatalogEntry[] {
  return listChannelPluginCatalogEntriesWithTrustedFallback(params, () => []);
}

export function listSetupDiscoveryChannelPluginCatalogEntries(params: {
  cfg: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): ChannelPluginCatalogEntry[] {
  return listChannelPluginCatalogEntriesWithTrustedFallback(params, (entry) => [entry]);
}
