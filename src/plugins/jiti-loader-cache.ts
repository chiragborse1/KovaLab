import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { createJiti } from "jiti";
import { toSafeImportPath } from "../shared/import-specifier.js";
import { tryNativeRequireJavaScriptModule } from "./native-module-require.js";
import { PluginLruCache } from "./plugin-lru-cache.js";
import {
  buildPluginLoaderJitiOptions,
  createPluginLoaderJitiCacheKey,
  resolvePluginLoaderJitiConfig,
  type PluginSdkResolutionPreference,
} from "./sdk-alias.js";

export type PluginJitiLoader = ReturnType<typeof createJiti>;
export type PluginJitiLoaderFactory = typeof createJiti;
export type PluginJitiLoaderCache = Pick<
  PluginLruCache<PluginJitiLoader>,
  "clear" | "get" | "set" | "size"
>;
export type ResolvePluginJitiLoaderCacheEntryParams = {
  modulePath: string;
  importerUrl: string;
  argvEntry?: string;
  preferBuiltDist?: boolean;
  jitiFilename?: string;
  aliasMap?: Record<string, string>;
  tryNative?: boolean;
  pluginSdkResolution?: PluginSdkResolutionPreference;
  cacheScopeKey?: string;
  sharedCacheScopeKey?: string;
};
export type PluginJitiLoaderCacheEntry = {
  loaderFilename: string;
  aliasMap: Record<string, string>;
  tryNative: boolean;
  cacheKey: string;
  scopedCacheKey: string;
};
export type PluginJitiLoaderStatsSnapshot = {
  calls: number;
  nativeHits: number;
  nativeMisses: number;
  sourceTransformForced: number;
  sourceTransformFallbacks: number;
  topSourceTransformTargets: Array<{ target: string; count: number }>;
};

const DEFAULT_PLUGIN_JITI_LOADER_CACHE_ENTRIES = 128;
const MAX_TRACKED_SOURCE_TRANSFORM_TARGETS = 24;
const requireForJiti = createRequire(import.meta.url);
let createJitiLoaderFactory: PluginJitiLoaderFactory | undefined;
const pluginJitiLoaderStats = {
  calls: 0,
  nativeHits: 0,
  nativeMisses: 0,
  sourceTransformForced: 0,
  sourceTransformFallbacks: 0,
  sourceTransformTargets: new Map<string, number>(),
};

function recordSourceTransformTarget(target: string): void {
  const current = pluginJitiLoaderStats.sourceTransformTargets.get(target) ?? 0;
  pluginJitiLoaderStats.sourceTransformTargets.set(target, current + 1);
  if (pluginJitiLoaderStats.sourceTransformTargets.size <= MAX_TRACKED_SOURCE_TRANSFORM_TARGETS) {
    return;
  }
  let leastUsedTarget: string | undefined;
  let leastUsedCount = Number.POSITIVE_INFINITY;
  for (const [candidate, count] of pluginJitiLoaderStats.sourceTransformTargets) {
    if (count < leastUsedCount) {
      leastUsedTarget = candidate;
      leastUsedCount = count;
    }
  }
  if (leastUsedTarget) {
    pluginJitiLoaderStats.sourceTransformTargets.delete(leastUsedTarget);
  }
}

export function getPluginJitiLoaderStats(): PluginJitiLoaderStatsSnapshot {
  return {
    calls: pluginJitiLoaderStats.calls,
    nativeHits: pluginJitiLoaderStats.nativeHits,
    nativeMisses: pluginJitiLoaderStats.nativeMisses,
    sourceTransformForced: pluginJitiLoaderStats.sourceTransformForced,
    sourceTransformFallbacks: pluginJitiLoaderStats.sourceTransformFallbacks,
    topSourceTransformTargets: [...pluginJitiLoaderStats.sourceTransformTargets]
      .toSorted((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 8)
      .map(([target, count]) => ({ target, count })),
  };
}

export function resetPluginJitiLoaderStatsForTest(): void {
  pluginJitiLoaderStats.calls = 0;
  pluginJitiLoaderStats.nativeHits = 0;
  pluginJitiLoaderStats.nativeMisses = 0;
  pluginJitiLoaderStats.sourceTransformForced = 0;
  pluginJitiLoaderStats.sourceTransformFallbacks = 0;
  pluginJitiLoaderStats.sourceTransformTargets.clear();
}

function loadCreateJitiLoaderFactory(): PluginJitiLoaderFactory {
  if (createJitiLoaderFactory) {
    return createJitiLoaderFactory;
  }
  const loaded = requireForJiti("jiti") as { createJiti?: PluginJitiLoaderFactory };
  if (typeof loaded.createJiti !== "function") {
    throw new Error("jiti module did not export createJiti");
  }
  createJitiLoaderFactory = loaded.createJiti;
  return createJitiLoaderFactory;
}

export function createPluginJitiLoaderCache(
  maxEntries = DEFAULT_PLUGIN_JITI_LOADER_CACHE_ENTRIES,
): PluginJitiLoaderCache {
  return new PluginLruCache<PluginJitiLoader>(maxEntries);
}

function toSourceTransformImportPath(specifier: string): string {
  if (specifier.startsWith("file://")) {
    return specifier;
  }
  const looksLikeWindowsAbsolute = /^[A-Za-z]:[\\/]/u.test(specifier) || specifier.startsWith("\\");
  if (looksLikeWindowsAbsolute) {
    return pathToFileURL(specifier, {
      windows: true,
    }).href;
  }
  return toSafeImportPath(specifier);
}

function resolveDefaultPluginJitiLoaderConfig(
  params: ResolvePluginJitiLoaderCacheEntryParams,
): ReturnType<typeof resolvePluginLoaderJitiConfig> {
  return resolvePluginLoaderJitiConfig({
    modulePath: params.modulePath,
    argv1: params.argvEntry ?? process.argv[1],
    moduleUrl: params.importerUrl,
    ...(params.preferBuiltDist ? { preferBuiltDist: true } : {}),
    ...(params.pluginSdkResolution ? { pluginSdkResolution: params.pluginSdkResolution } : {}),
  });
}

export function resolvePluginJitiLoaderCacheEntry(
  params: ResolvePluginJitiLoaderCacheEntryParams,
): PluginJitiLoaderCacheEntry {
  const loaderFilename = toSafeImportPath(params.jitiFilename ?? params.modulePath);
  const hasAliasOverride = Boolean(params.aliasMap);
  const hasTryNativeOverride = typeof params.tryNative === "boolean";
  const defaultConfig =
    hasAliasOverride || hasTryNativeOverride ? resolveDefaultPluginJitiLoaderConfig(params) : null;
  const canReuseDefaultCacheKey =
    defaultConfig !== null &&
    (!hasAliasOverride || params.aliasMap === defaultConfig.aliasMap) &&
    (!hasTryNativeOverride || params.tryNative === defaultConfig.tryNative);
  const resolved = defaultConfig
    ? {
        tryNative: params.tryNative ?? defaultConfig.tryNative,
        aliasMap: params.aliasMap ?? defaultConfig.aliasMap,
        cacheKey: canReuseDefaultCacheKey ? defaultConfig.cacheKey : undefined,
      }
    : resolveDefaultPluginJitiLoaderConfig(params);
  const { tryNative, aliasMap } = resolved;
  const cacheKey =
    resolved.cacheKey ??
    createPluginLoaderJitiCacheKey({
      tryNative,
      aliasMap,
    });
  const scopedCacheKey = `${loaderFilename}::${
    params.sharedCacheScopeKey ??
    (params.cacheScopeKey ? `${params.cacheScopeKey}::${cacheKey}` : cacheKey)
  }`;
  return {
    loaderFilename,
    aliasMap,
    tryNative,
    cacheKey,
    scopedCacheKey,
  };
}

function createLazySourceTransformLoader(params: {
  loaderFilename: string;
  aliasMap: Record<string, string>;
  sourceTransformTryNative: boolean;
  createLoader?: PluginJitiLoaderFactory;
}): () => PluginJitiLoader {
  let loadWithSourceTransform: PluginJitiLoader | undefined;
  return () => {
    if (loadWithSourceTransform) {
      return loadWithSourceTransform;
    }
    const jitiLoader = (params.createLoader ?? loadCreateJitiLoaderFactory())(
      params.loaderFilename,
      {
        ...buildPluginLoaderJitiOptions(params.aliasMap, {
          modulePath: params.loaderFilename,
        }),
        tryNative: params.sourceTransformTryNative,
      },
    );
    loadWithSourceTransform = new Proxy(jitiLoader, {
      apply(target, thisArg, argArray) {
        const [first, ...rest] = argArray as [unknown, ...unknown[]];
        if (typeof first === "string") {
          return Reflect.apply(target, thisArg, [
            toSourceTransformImportPath(first),
            ...rest,
          ] as never) as never;
        }
        return Reflect.apply(target, thisArg, argArray as never) as never;
      },
    });
    return loadWithSourceTransform;
  };
}

function createPluginJitiLoader(params: {
  loaderFilename: string;
  aliasMap: Record<string, string>;
  tryNative: boolean;
  createLoader?: PluginJitiLoaderFactory;
}): PluginJitiLoader {
  const getLoadWithJiti = createLazySourceTransformLoader({
    ...params,
    sourceTransformTryNative: params.tryNative,
    ...(params.createLoader ? { createLoader: params.createLoader } : {}),
  });
  const loadedTargetExports = new Map<string, unknown>();
  const loadCachedTarget = (target: string, rest: unknown[], load: () => unknown): unknown => {
    if (rest.length > 0) {
      return load();
    }
    if (loadedTargetExports.has(target)) {
      return loadedTargetExports.get(target);
    }
    const loaded = load();
    loadedTargetExports.set(target, loaded);
    return loaded;
  };
  // When the caller has explicitly opted out of native loading (for example
  // `bundled-capability-runtime` in Vitest+dist mode, which depends on
  // jiti's alias rewriting to surface a narrow SDK slice), route every
  // target through jiti so those alias rewrites still apply.
  if (!params.tryNative) {
    return ((target: string, ...rest: unknown[]) => {
      return loadCachedTarget(target, rest, () => {
        pluginJitiLoaderStats.calls += 1;
        pluginJitiLoaderStats.sourceTransformForced += 1;
        recordSourceTransformTarget(target);
        return (getLoadWithJiti() as (t: string, ...a: unknown[]) => unknown)(target, ...rest);
      });
    }) as PluginJitiLoader;
  }
  // Otherwise prefer native require() for already-compiled JS artifacts
  // (the bundled plugin public surfaces shipped in dist/). jiti's transform
  // pipeline provides no value for output that is already plain JS and adds
  // several seconds of per-load overhead on slower hosts. jiti still runs
  // for TS / TSX sources and for the small set of require(esm) /
  // async-module fallbacks `tryNativeRequireJavaScriptModule` declines to
  // handle.
  return ((target: string, ...rest: unknown[]) => {
    return loadCachedTarget(target, rest, () => {
      pluginJitiLoaderStats.calls += 1;
      const native = tryNativeRequireJavaScriptModule(target, {
        allowWindows: true,
        aliasMap: params.aliasMap,
        fallbackOnMissingDependency: true,
        fallbackOnNativeError: true,
      });
      if (native.ok) {
        pluginJitiLoaderStats.nativeHits += 1;
        return native.moduleExport;
      }
      pluginJitiLoaderStats.nativeMisses += 1;
      pluginJitiLoaderStats.sourceTransformFallbacks += 1;
      recordSourceTransformTarget(target);
      return (getLoadWithJiti() as (t: string, ...a: unknown[]) => unknown)(target, ...rest);
    });
  }) as PluginJitiLoader;
}

export function getCachedPluginJitiLoader(
  params: ResolvePluginJitiLoaderCacheEntryParams & {
    cache: PluginJitiLoaderCache;
    createLoader?: PluginJitiLoaderFactory;
  },
): PluginJitiLoader {
  const entry = resolvePluginJitiLoaderCacheEntry(params);
  const cached = params.cache.get(entry.scopedCacheKey);
  if (cached) {
    return cached;
  }
  const loader = createPluginJitiLoader({
    loaderFilename: entry.loaderFilename,
    aliasMap: entry.aliasMap,
    tryNative: entry.tryNative,
    ...(params.createLoader ? { createLoader: params.createLoader } : {}),
  });
  const scopedCacheKey = entry.scopedCacheKey;
  params.cache.set(scopedCacheKey, loader);
  return loader;
}
