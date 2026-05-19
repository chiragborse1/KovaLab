import { execFileSync } from "node:child_process";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";

export type NpmProjectInstallEnvOptions = {
  cacheDir?: string;
  npmConfigCwd?: string;
  npmConfigPrefix?: string | null;
};

const NPM_CONFIG_KEYS_TO_RESET = new Set([
  "npm_config_cache",
  "npm_config_global",
  "npm_config_location",
  "npm_config_prefix",
]);

const NPM_FRESHNESS_BYPASS_KEYS = [
  "NPM_CONFIG_BEFORE",
  "NPM_CONFIG_MIN_RELEASE_AGE",
  "NPM_CONFIG_MIN-RELEASE-AGE",
  "npm_config_before",
  "npm_config_min_release_age",
  "npm_config_min-release-age",
] as const;

type NpmFreshnessBypassMode = "before" | "min-release-age";

type NpmFreshnessConfigScope = {
  npmConfigCwd?: string;
  npmConfigPrefix?: string | null;
};

const NPM_CONFIG_PATH_PROBE_PARENT_ENV_KEYS = ["PATH", "Path", "PATHEXT", "SystemRoot", "ComSpec"];

function replaceNpmEnvRefs(value: string, env: NodeJS.ProcessEnv): string {
  return value.replace(
    /(?<!\\)(\\*)\$\{([^${}?]+)(\?)?\}/gu,
    (original, escapes: string, name: string, modifier: string | undefined) => {
      const fallback = modifier === "?" ? "" : `\${${name}}`;
      const resolved = env[name] !== undefined ? env[name] : fallback;
      if (escapes.length % 2) {
        return original.slice((escapes.length + 1) / 2);
      }
      return `${escapes.slice(escapes.length / 2)}${resolved}`;
    },
  );
}

function resolveNpmConfigPath(rawPath: string, env: NodeJS.ProcessEnv): string {
  const expanded = replaceNpmEnvRefs(rawPath, env);
  const home = env.HOME?.trim() || env.USERPROFILE?.trim() || os.homedir();
  const homePattern = process.platform === "win32" ? /^~(\/|\\)/u : /^~\//u;
  return homePattern.test(expanded) && home
    ? path.resolve(home, expanded.slice(2))
    : path.resolve(expanded);
}

function resolveEnvPath(env: NodeJS.ProcessEnv, upperKey: string, lowerKey: string): string | null {
  const raw = env[upperKey]?.trim() || env[lowerKey]?.trim();
  return raw ? resolveNpmConfigPath(raw, env) : null;
}

function resolveHomeNpmrc(env: NodeJS.ProcessEnv): string {
  const home = env.HOME?.trim() || env.USERPROFILE?.trim() || os.homedir();
  return path.join(home, ".npmrc");
}

function createNpmConfigPathProbeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const probeEnv = { ...env };
  for (const key of NPM_FRESHNESS_BYPASS_KEYS) {
    delete probeEnv[key];
  }
  for (const key of NPM_CONFIG_PATH_PROBE_PARENT_ENV_KEYS) {
    if (probeEnv[key] == null && process.env[key] != null) {
      probeEnv[key] = process.env[key];
    }
  }
  return probeEnv;
}

function readNpmGlobalConfigPath(
  env: NodeJS.ProcessEnv,
  scope: NpmFreshnessConfigScope,
): string | null {
  try {
    const raw = execFileSync("npm", ["config", "get", "globalconfig"], {
      encoding: "utf-8",
      env: {
        ...createNpmConfigPathProbeEnv(env),
        ...(scope.npmConfigPrefix ? { npm_config_prefix: scope.npmConfigPrefix } : {}),
      },
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2_000,
    }).trim();
    return raw && raw !== "null" && raw !== "undefined" ? raw : null;
  } catch {
    return null;
  }
}

function resolveScopedProjectNpmrc(scope: NpmFreshnessConfigScope): string | null {
  const cwd = scope.npmConfigCwd?.trim() || process.cwd();
  return cwd ? path.join(cwd, ".npmrc") : null;
}

function resolveScopedGlobalNpmrc(scope: NpmFreshnessConfigScope): string | null {
  const prefix = scope.npmConfigPrefix?.trim();
  return prefix ? path.join(prefix, "etc", "npmrc") : null;
}

function resolveNpmConfigFiles(
  env: NodeJS.ProcessEnv,
  scope: NpmFreshnessConfigScope = {},
): string[] {
  const files = [
    resolveScopedProjectNpmrc(scope),
    resolveEnvPath(env, "NPM_CONFIG_USERCONFIG", "npm_config_userconfig") ?? resolveHomeNpmrc(env),
    resolveEnvPath(env, "NPM_CONFIG_GLOBALCONFIG", "npm_config_globalconfig"),
    resolveScopedGlobalNpmrc(scope),
    readNpmGlobalConfigPath(env, scope),
  ];
  return [...new Set(files.filter((file): file is string => Boolean(file)))];
}

function hasNpmrcConfigKey(filePath: string, key: string): boolean {
  try {
    const raw = fsSync.readFileSync(filePath, "utf-8");
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`^\\s*${escapedKey}\\s*=`, "imu").test(raw);
  } catch {
    return false;
  }
}

function hasRawNpmConfigKey(
  env: NodeJS.ProcessEnv,
  key: "before" | "min-release-age",
  scope: NpmFreshnessConfigScope,
): boolean {
  return resolveNpmConfigFiles(env, scope).some((file) => hasNpmrcConfigKey(file, key));
}

function resolveNpmFreshnessBypassMode(
  env: NodeJS.ProcessEnv,
  scope: NpmFreshnessConfigScope,
): NpmFreshnessBypassMode {
  if (hasRawNpmConfigKey(env, "min-release-age", scope)) {
    return "min-release-age";
  }
  return hasRawNpmConfigKey(env, "before", scope) ? "before" : "min-release-age";
}

export function createNpmFreshnessBypassArgs(
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  scope: NpmFreshnessConfigScope = {},
): string[] {
  if (resolveNpmFreshnessBypassMode(env, scope) === "min-release-age") {
    return ["--min-release-age=0"];
  }
  return [`--before=${now.toISOString()}`];
}

export function applyNpmFreshnessBypassEnv(
  env: NodeJS.ProcessEnv,
  now = new Date(),
  scope: NpmFreshnessConfigScope = {},
): void {
  const [arg] = createNpmFreshnessBypassArgs(env, now, scope);
  for (const key of NPM_FRESHNESS_BYPASS_KEYS) {
    env[key] = "";
  }
  if (arg?.startsWith("--before=")) {
    env.npm_config_before = arg.slice("--before=".length);
  } else if (arg === "--min-release-age=0") {
    env.npm_config_min_release_age = "0";
  }
}

export function createNpmProjectInstallEnv(
  env: NodeJS.ProcessEnv,
  options: NpmProjectInstallEnvOptions = {},
  now = new Date(),
): NodeJS.ProcessEnv {
  const nextEnv = { ...env };
  for (const key of Object.keys(nextEnv)) {
    if (NPM_CONFIG_KEYS_TO_RESET.has(key.toLowerCase())) {
      delete nextEnv[key];
    }
  }
  const installEnv = {
    ...nextEnv,
    npm_config_global: "false",
    npm_config_location: "project",
    npm_config_package_lock: "false",
    npm_config_save: "false",
    ...(options.cacheDir ? { npm_config_cache: options.cacheDir } : {}),
  };
  applyNpmFreshnessBypassEnv(installEnv, now, options);
  return installEnv;
}
