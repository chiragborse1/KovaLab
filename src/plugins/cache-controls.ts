import { resolveKovaCompatMode } from "../config/paths.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";

export const DEFAULT_PLUGIN_DISCOVERY_CACHE_MS = 1000;
export const DEFAULT_PLUGIN_MANIFEST_CACHE_MS = 1000;

export function readPluginCacheEnv(
  env: NodeJS.ProcessEnv,
  modernKey: string,
  _legacyKey?: string,
): string | undefined {
  return normalizeOptionalString(env[modernKey]);
}

export function shouldUsePluginSnapshotCache(env: NodeJS.ProcessEnv): boolean {
  if (readPluginCacheEnv(env, "KOVA_DISABLE_PLUGIN_DISCOVERY_CACHE")) {
    return false;
  }
  if (readPluginCacheEnv(env, "KOVA_DISABLE_PLUGIN_MANIFEST_CACHE")) {
    return false;
  }
  const discoveryCacheMs = readPluginCacheEnv(env, "KOVA_PLUGIN_DISCOVERY_CACHE_MS");
  if (discoveryCacheMs === "0") {
    return false;
  }
  const manifestCacheMs = readPluginCacheEnv(env, "KOVA_PLUGIN_MANIFEST_CACHE_MS");
  if (manifestCacheMs === "0") {
    return false;
  }
  return true;
}

export function resolvePluginCacheMs(rawValue: string | undefined, defaultMs: number): number {
  const raw = normalizeOptionalString(rawValue);
  if (raw === "" || raw === "0") {
    return 0;
  }
  if (!raw) {
    return defaultMs;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return defaultMs;
  }
  return Math.max(0, parsed);
}

export function resolvePluginSnapshotCacheTtlMs(env: NodeJS.ProcessEnv): number {
  const discoveryCacheMs = resolvePluginCacheMs(
    readPluginCacheEnv(env, "KOVA_PLUGIN_DISCOVERY_CACHE_MS"),
    DEFAULT_PLUGIN_DISCOVERY_CACHE_MS,
  );
  const manifestCacheMs = resolvePluginCacheMs(
    readPluginCacheEnv(env, "KOVA_PLUGIN_MANIFEST_CACHE_MS"),
    DEFAULT_PLUGIN_MANIFEST_CACHE_MS,
  );
  return Math.min(discoveryCacheMs, manifestCacheMs);
}

export function buildPluginSnapshotCacheEnvKey(env: NodeJS.ProcessEnv): string {
  return JSON.stringify({
    KOVA_BUNDLED_PLUGINS_DIR: env.KOVA_BUNDLED_PLUGINS_DIR ?? "",
    KOVA_DISABLE_PLUGIN_DISCOVERY_CACHE: env.KOVA_DISABLE_PLUGIN_DISCOVERY_CACHE ?? "",
    KOVA_DISABLE_PLUGIN_MANIFEST_CACHE: env.KOVA_DISABLE_PLUGIN_MANIFEST_CACHE ?? "",
    KOVA_PLUGIN_DISCOVERY_CACHE_MS: env.KOVA_PLUGIN_DISCOVERY_CACHE_MS ?? "",
    KOVA_PLUGIN_MANIFEST_CACHE_MS: env.KOVA_PLUGIN_MANIFEST_CACHE_MS ?? "",
    KOVA_HOME: env.KOVA_HOME ?? "",
    KOVA_STATE_DIR: env.KOVA_STATE_DIR ?? "",
    KOVA_CONFIG_PATH: env.KOVA_CONFIG_PATH ?? "",
    KOVA_COMPAT: resolveKovaCompatMode(env) ? "1" : "",
    HOME: env.HOME ?? "",
    USERPROFILE: env.USERPROFILE ?? "",
    VITEST: env.VITEST ?? "",
  });
}
