import { normalizeProviderId } from "../agents/provider-id.js";
import type { KovaConfig } from "../config/types.kova.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { getLoadedRuntimePluginRegistry } from "./active-runtime-registry.js";
import { resolvePluginControlPlaneFingerprint } from "./plugin-control-plane-context.js";
import { PluginLruCache } from "./plugin-lru-cache.js";
import { normalizePluginIdScope, serializePluginIdScope } from "./plugin-scope.js";
import { resolveProviderConfigApiOwnerHint } from "./provider-config-owner.js";
import { isPluginProvidersLoadInFlight, resolvePluginProviders } from "./providers.runtime.js";
import type { PluginRegistry } from "./registry-types.js";
import { resolvePluginCacheInputs } from "./roots.js";
import {
  getActivePluginRegistryWorkspaceDirFromState,
  getPluginRegistryState,
} from "./runtime-state.js";
import type {
  ProviderPlugin,
  ProviderExtraParamsForTransportContext,
  ProviderPrepareExtraParamsContext,
  ProviderResolveAuthProfileIdContext,
  ProviderFollowupFallbackRouteContext,
  ProviderFollowupFallbackRouteResult,
  ProviderWrapStreamFnContext,
} from "./types.js";

function matchesProviderId(provider: ProviderPlugin, providerId: string): boolean {
  const normalized = normalizeProviderId(providerId);
  if (!normalized) {
    return false;
  }
  if (normalizeProviderId(provider.id) === normalized) {
    return true;
  }
  return [...(provider.aliases ?? []), ...(provider.hookAliases ?? [])].some(
    (alias) => normalizeProviderId(alias) === normalized,
  );
}

function matchesProviderLiteralId(provider: ProviderPlugin, providerId: string): boolean {
  const normalized = normalizeLowercaseStringOrEmpty(providerId);
  return !!normalized && normalizeLowercaseStringOrEmpty(provider.id) === normalized;
}

type ProviderRuntimePluginLookupParams = {
  provider: string;
  modelId?: string | null;
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  applyAutoEnable?: boolean;
  bundledProviderAllowlistCompat?: boolean;
  bundledProviderVitestCompat?: boolean;
  installBundledRuntimeDeps?: boolean;
};

type ConfigScopedRuntimeCache<T> = WeakMap<KovaConfig, Map<string, T>>;

let providerRuntimePluginCache: ConfigScopedRuntimeCache<ProviderPlugin | null> = new WeakMap();
const defaultProviderRuntimePluginCache = new PluginLruCache<ProviderPlugin | null>(128);
const PREPARED_PROVIDER_RUNTIME_SURFACES = ["channel"] as const;
let cachedHookProvidersWithoutConfig = new WeakMap<
  NodeJS.ProcessEnv,
  Map<string, ProviderPlugin[]>
>();
let cachedHookProvidersByConfig = new WeakMap<
  KovaConfig,
  WeakMap<NodeJS.ProcessEnv, Map<string, ProviderPlugin[]>>
>();

function resolveHookProviderCacheBucket(params: { config?: KovaConfig; env: NodeJS.ProcessEnv }) {
  if (!params.config) {
    let bucket = cachedHookProvidersWithoutConfig.get(params.env);
    if (!bucket) {
      bucket = new Map<string, ProviderPlugin[]>();
      cachedHookProvidersWithoutConfig.set(params.env, bucket);
    }
    return bucket;
  }

  let envBuckets = cachedHookProvidersByConfig.get(params.config);
  if (!envBuckets) {
    envBuckets = new WeakMap<NodeJS.ProcessEnv, Map<string, ProviderPlugin[]>>();
    cachedHookProvidersByConfig.set(params.config, envBuckets);
  }
  let bucket = envBuckets.get(params.env);
  if (!bucket) {
    bucket = new Map<string, ProviderPlugin[]>();
    envBuckets.set(params.env, bucket);
  }
  return bucket;
}

function buildHookProviderCacheKey(params: {
  config?: KovaConfig;
  workspaceDir?: string;
  onlyPluginIds?: string[];
  providerRefs?: string[];
  env?: NodeJS.ProcessEnv;
}) {
  const { roots } = resolvePluginCacheInputs({
    workspaceDir: params.workspaceDir,
    env: params.env,
  });
  const onlyPluginIds = normalizePluginIdScope(params.onlyPluginIds);
  return `${roots.workspace ?? ""}::${roots.global}::${roots.stock ?? ""}::${JSON.stringify(params.config ?? null)}::${serializePluginIdScope(onlyPluginIds)}::${JSON.stringify(params.providerRefs ?? [])}`;
}

export function clearProviderRuntimeHookCache(): void {
  providerRuntimePluginCache = new WeakMap();
  defaultProviderRuntimePluginCache.clear();
  cachedHookProvidersWithoutConfig = new WeakMap<
    NodeJS.ProcessEnv,
    Map<string, ProviderPlugin[]>
  >();
  cachedHookProvidersByConfig = new WeakMap<
    KovaConfig,
    WeakMap<NodeJS.ProcessEnv, Map<string, ProviderPlugin[]>>
  >();
}

export function resetProviderRuntimeHookCacheForTest(): void {
  clearProviderRuntimeHookCache();
}

export const __testing = {
  buildHookProviderCacheKey,
} as const;

function resolveConfigScopedRuntimeCacheValue<T>(params: {
  cache: ConfigScopedRuntimeCache<T>;
  config?: KovaConfig;
  key: string;
  load: () => T;
}): T {
  if (!params.config) {
    return params.load();
  }
  let configCache = params.cache.get(params.config);
  if (!configCache) {
    configCache = new Map();
    params.cache.set(params.config, configCache);
  }
  if (configCache.has(params.key)) {
    return configCache.get(params.key) as T;
  }
  const loaded = params.load();
  configCache.set(params.key, loaded);
  return loaded;
}

function resolveProviderRuntimePluginCacheKey(
  params: ProviderRuntimePluginLookupParams,
  registryState = getPluginRegistryState(),
): string {
  return JSON.stringify({
    provider: normalizeLowercaseStringOrEmpty(params.provider),
    modelId:
      typeof params.modelId === "string" && params.modelId.trim() ? params.modelId.trim() : null,
    pluginControlPlane: resolvePluginControlPlaneFingerprint({
      config: params.config,
      env: params.env,
      workspaceDir: params.workspaceDir,
    }),
    plugins: params.config?.plugins ?? null,
    models: params.config?.models?.providers ?? null,
    workspaceDir: params.workspaceDir ?? "",
    applyAutoEnable: params.applyAutoEnable ?? null,
    bundledProviderAllowlistCompat: params.bundledProviderAllowlistCompat ?? null,
    bundledProviderVitestCompat: params.bundledProviderVitestCompat ?? null,
    installBundledRuntimeDeps: params.installBundledRuntimeDeps ?? null,
    pluginRegistryKey: registryState?.key ?? null,
    pluginRegistryVersion: registryState?.activeVersion ?? null,
  });
}

function findProviderRuntimePluginInRegistry(params: {
  registry: PluginRegistry;
  provider: string;
  apiOwnerHint?: string;
}): ProviderPlugin | undefined {
  return params.registry.providers
    .map((entry) => Object.assign({}, entry.provider, { pluginId: entry.pluginId }))
    .find((plugin) => {
      if (params.apiOwnerHint) {
        return (
          matchesProviderLiteralId(plugin, params.provider) ||
          matchesProviderId(plugin, params.apiOwnerHint)
        );
      }
      return matchesProviderId(plugin, params.provider);
    });
}

function findProviderRuntimePluginInLoadedRegistries(params: {
  lookup: ProviderRuntimePluginLookupParams;
  apiOwnerHint?: string;
}): ProviderPlugin | undefined {
  const activeRegistry = getLoadedRuntimePluginRegistry({
    env: params.lookup.env,
    workspaceDir: params.lookup.workspaceDir,
  });
  const activePlugin = activeRegistry
    ? findProviderRuntimePluginInRegistry({
        registry: activeRegistry,
        provider: params.lookup.provider,
        apiOwnerHint: params.apiOwnerHint,
      })
    : undefined;
  if (activePlugin) {
    return activePlugin;
  }
  for (const surface of PREPARED_PROVIDER_RUNTIME_SURFACES) {
    const registry = getLoadedRuntimePluginRegistry({
      env: params.lookup.env,
      workspaceDir: params.lookup.workspaceDir,
      surface,
    });
    const plugin = registry
      ? findProviderRuntimePluginInRegistry({
          registry,
          provider: params.lookup.provider,
          apiOwnerHint: params.apiOwnerHint,
        })
      : undefined;
    if (plugin) {
      return plugin;
    }
  }
  return undefined;
}

export function resolveProviderPluginsForHooks(params: {
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  onlyPluginIds?: string[];
  providerRefs?: string[];
  applyAutoEnable?: boolean;
  bundledProviderAllowlistCompat?: boolean;
  bundledProviderVitestCompat?: boolean;
  installBundledRuntimeDeps?: boolean;
}): ProviderPlugin[] {
  const env = params.env ?? process.env;
  const workspaceDir = params.workspaceDir ?? getActivePluginRegistryWorkspaceDirFromState();
  const cacheBucket = resolveHookProviderCacheBucket({
    config: params.config,
    env,
  });
  const cacheKey = buildHookProviderCacheKey({
    config: params.config,
    workspaceDir,
    onlyPluginIds: params.onlyPluginIds,
    providerRefs: params.providerRefs,
    env,
  });
  const cached = cacheBucket.get(cacheKey);
  if (cached) {
    return cached;
  }
  if (
    isPluginProvidersLoadInFlight({
      ...params,
      workspaceDir,
      env,
      activate: false,
      cache: false,
      applyAutoEnable: params.applyAutoEnable,
      bundledProviderAllowlistCompat: params.bundledProviderAllowlistCompat ?? true,
      bundledProviderVitestCompat: params.bundledProviderVitestCompat ?? true,
      installBundledRuntimeDeps: params.installBundledRuntimeDeps,
    })
  ) {
    return [];
  }
  const resolved = resolvePluginProviders({
    ...params,
    workspaceDir,
    env,
    activate: false,
    cache: false,
    applyAutoEnable: params.applyAutoEnable,
    bundledProviderAllowlistCompat: params.bundledProviderAllowlistCompat ?? true,
    bundledProviderVitestCompat: params.bundledProviderVitestCompat ?? true,
    installBundledRuntimeDeps: params.installBundledRuntimeDeps,
  });
  cacheBucket.set(cacheKey, resolved);
  return resolved;
}

export function resolveProviderRuntimePlugin(
  params: ProviderRuntimePluginLookupParams,
): ProviderPlugin | undefined {
  const workspaceDir = params.workspaceDir ?? getActivePluginRegistryWorkspaceDirFromState();
  const env = params.env ?? process.env;
  const lookup = { ...params, workspaceDir, env };
  const apiOwnerHint = resolveProviderConfigApiOwnerHint({
    provider: params.provider,
    config: params.config,
  });
  const providerRefs = apiOwnerHint ? [params.provider, apiOwnerHint] : [params.provider];
  const loadedPlugin = findProviderRuntimePluginInLoadedRegistries({
    lookup,
    apiOwnerHint,
  });
  if (loadedPlugin) {
    return loadedPlugin;
  }
  const cacheConfig = params.env && params.env !== process.env ? undefined : params.config;
  const registryState = getPluginRegistryState();
  const cacheKey = resolveProviderRuntimePluginCacheKey(lookup, registryState);
  const load = () =>
    resolveProviderPluginsForHooks({
      config: params.config,
      workspaceDir,
      env,
      providerRefs,
      applyAutoEnable: params.applyAutoEnable,
      bundledProviderAllowlistCompat: params.bundledProviderAllowlistCompat,
      bundledProviderVitestCompat: params.bundledProviderVitestCompat,
      installBundledRuntimeDeps: params.installBundledRuntimeDeps,
    }).find((plugin) => {
      if (apiOwnerHint) {
        return (
          matchesProviderLiteralId(plugin, params.provider) ||
          matchesProviderId(plugin, apiOwnerHint)
        );
      }
      return matchesProviderId(plugin, params.provider);
    }) ?? null;
  const plugin = cacheConfig
    ? resolveConfigScopedRuntimeCacheValue({
        cache: providerRuntimePluginCache,
        config: cacheConfig,
        key: cacheKey,
        load,
      })
    : !registryState?.key
      ? load()
      : (() => {
          const cached = defaultProviderRuntimePluginCache.getResult(cacheKey);
          if (cached.hit) {
            return cached.value;
          }
          const loaded = load();
          defaultProviderRuntimePluginCache.set(cacheKey, loaded);
          return loaded;
        })();
  return plugin ?? undefined;
}

export function resolveProviderHookPlugin(params: {
  provider: string;
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): ProviderPlugin | undefined {
  return (
    resolveProviderRuntimePlugin(params) ??
    resolveProviderPluginsForHooks({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
      providerRefs: [params.provider],
    }).find((candidate) => matchesProviderId(candidate, params.provider))
  );
}

export function prepareProviderExtraParams(params: {
  provider: string;
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  context: ProviderPrepareExtraParamsContext;
}) {
  return resolveProviderRuntimePlugin(params)?.prepareExtraParams?.(params.context) ?? undefined;
}

export function resolveProviderExtraParamsForTransport(params: {
  provider: string;
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  context: ProviderExtraParamsForTransportContext;
}) {
  return resolveProviderHookPlugin(params)?.extraParamsForTransport?.(params.context) ?? undefined;
}

export function resolveProviderAuthProfileId(params: {
  provider: string;
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  context: ProviderResolveAuthProfileIdContext;
}): string | undefined {
  const resolved = resolveProviderHookPlugin(params)?.resolveAuthProfileId?.(params.context);
  return typeof resolved === "string" && resolved.trim() ? resolved.trim() : undefined;
}

export function resolveProviderFollowupFallbackRoute(params: {
  provider: string;
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  context: ProviderFollowupFallbackRouteContext;
}): ProviderFollowupFallbackRouteResult | undefined {
  return resolveProviderHookPlugin(params)?.followupFallbackRoute?.(params.context) ?? undefined;
}

export function wrapProviderStreamFn(params: {
  provider: string;
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  context: ProviderWrapStreamFnContext;
}) {
  return resolveProviderHookPlugin(params)?.wrapStreamFn?.(params.context) ?? undefined;
}
