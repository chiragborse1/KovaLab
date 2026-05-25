import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { resolveConfigDir } from "../utils.js";
import { resolveRequiredHomeDir } from "./home-dir.js";
import {
  isDangerousHostEnvOverrideVarName,
  isDangerousHostEnvVarName,
  normalizeEnvVarKey,
} from "./host-env-security.js";

const BLOCKED_WORKSPACE_DOTENV_KEYS = new Set([
  "ALL_PROXY",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_OAUTH_TOKEN",
  "BROWSER_EXECUTABLE_PATH",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "IRC_HOST",
  "MATTERMOST_URL",
  "MATRIX_HOMESERVER",
  "MINIMAX_API_HOST",
  "NODE_TLS_REJECT_UNAUTHORIZED",
  "NO_PROXY",
  "KOVA_AGENT_DIR",
  "KOVA_ALLOW_INSECURE_PRIVATE_WS",
  "KOVA_ALLOW_PROJECT_LOCAL_BIN",
  "KOVA_BROWSER_CONTROL_MODULE",
  "KOVA_BROWSER_EXECUTABLE_PATH",
  "KOVA_BUNDLED_HOOKS_DIR",
  "KOVA_BUNDLED_PLUGINS_DIR",
  "KOVA_BUNDLED_SKILLS_DIR",
  "KOVA_CACHE_TRACE",
  "KOVA_CACHE_TRACE_FILE",
  "KOVA_CACHE_TRACE_MESSAGES",
  "KOVA_CACHE_TRACE_PROMPT",
  "KOVA_CACHE_TRACE_SYSTEM",
  "KOVA_CONFIG_PATH",
  "KOVA_GATEWAY_PASSWORD",
  "KOVA_GATEWAY_PORT",
  "KOVA_GATEWAY_SECRET",
  "KOVA_GATEWAY_TOKEN",
  "KOVA_GATEWAY_URL",
  "KOVA_HOME",
  "KOVA_LIVE_ANTHROPIC_KEY",
  "KOVA_LIVE_ANTHROPIC_KEYS",
  "KOVA_LIVE_GEMINI_KEY",
  "KOVA_LIVE_OPENAI_KEY",
  "KOVA_MPM_CATALOG_PATHS",
  "KOVA_NODE_EXEC_FALLBACK",
  "KOVA_NODE_EXEC_HOST",
  "KOVA_OAUTH_DIR",
  "KOVA_PINNED_PYTHON",
  "KOVA_PINNED_WRITE_PYTHON",
  "KOVA_PLUGIN_CATALOG_PATHS",
  "KOVA_PROFILE",
  "KOVA_RAW_STREAM",
  "KOVA_RAW_STREAM_PATH",
  "KOVA_SHOW_SECRETS",
  "KOVA_SKIP_BROWSER_CONTROL_SERVER",
  "KOVA_STATE_DIR",
  "KOVA_TEST_TAILSCALE_BINARY",
  "OPENAI_API_KEY",
  "OPENAI_API_KEYS",
  "KOVA_AGENT_DIR",
  "KOVA_ALLOW_INSECURE_PRIVATE_WS",
  "KOVA_ALLOW_PROJECT_LOCAL_BIN",
  "KOVA_BROWSER_EXECUTABLE_PATH",
  "KOVA_BROWSER_CONTROL_MODULE",
  "KOVA_BUNDLED_HOOKS_DIR",
  "KOVA_BUNDLED_PLUGINS_DIR",
  "KOVA_BUNDLED_SKILLS_DIR",
  "KOVA_CACHE_TRACE",
  "KOVA_CACHE_TRACE_FILE",
  "KOVA_CACHE_TRACE_MESSAGES",
  "KOVA_CACHE_TRACE_PROMPT",
  "KOVA_CACHE_TRACE_SYSTEM",
  "KOVA_CONFIG_PATH",
  "KOVA_GATEWAY_PASSWORD",
  "KOVA_GATEWAY_PORT",
  "KOVA_GATEWAY_SECRET",
  "KOVA_GATEWAY_TOKEN",
  "KOVA_GATEWAY_URL",
  "KOVA_HOME",
  "KOVA_LIVE_ANTHROPIC_KEY",
  "KOVA_LIVE_ANTHROPIC_KEYS",
  "KOVA_LIVE_GEMINI_KEY",
  "KOVA_LIVE_OPENAI_KEY",
  "KOVA_MPM_CATALOG_PATHS",
  "KOVA_NODE_EXEC_FALLBACK",
  "KOVA_NODE_EXEC_HOST",
  "KOVA_OAUTH_DIR",
  "KOVA_PINNED_PYTHON",
  "KOVA_PINNED_WRITE_PYTHON",
  "KOVA_PLUGIN_CATALOG_PATHS",
  "KOVA_PROFILE",
  "KOVA_RAW_STREAM",
  "KOVA_RAW_STREAM_PATH",
  "KOVA_SHOW_SECRETS",
  "KOVA_SKIP_BROWSER_CONTROL_SERVER",
  "KOVA_STATE_DIR",
  "KOVA_TEST_TAILSCALE_BINARY",
  "PI_CODING_AGENT_DIR",
  "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
  "SYNOLOGY_CHAT_INCOMING_URL",
  "SYNOLOGY_NAS_HOST",
  "UV_PYTHON",
]);

// Block endpoint redirection for any service without overfitting per-provider names.
// `_HOMESERVER` covers Matrix's per-account scoped keys (MATRIX_<ACCOUNT>_HOMESERVER)
// in addition to the bare MATRIX_HOMESERVER listed above.
const BLOCKED_WORKSPACE_DOTENV_SUFFIXES = ["_API_HOST", "_BASE_URL", "_HOMESERVER"];
const BLOCKED_WORKSPACE_DOTENV_PREFIXES = [
  "ANTHROPIC_API_KEY_",
  "OPENAI_API_KEY_",
  // Workspace .env is untrusted; reserve the full Kova runtime namespace
  // for shell/global config so new KOVA_* controls are fail-closed by default.
  "KOVA_",
  "KOVA_DISABLE_",
  "KOVA_SKIP_",
  "KOVA_UPDATE_",
  "KOVA_",
  "KOVA_DISABLE_",
  "KOVA_SKIP_",
  "KOVA_UPDATE_",
];

function shouldBlockWorkspaceRuntimeDotEnvKey(key: string): boolean {
  return isDangerousHostEnvVarName(key) || isDangerousHostEnvOverrideVarName(key);
}

function shouldBlockRuntimeDotEnvKey(key: string): boolean {
  // The global ~/.kova/.env (or KOVA_STATE_DIR/.env) is a trusted
  // operator-controlled runtime surface. Workspace .env is untrusted and gets
  // the strict blocklist, but the trusted global fallback is allowed to set
  // runtime vars like proxy/base-url/auth values.
  void key;
  return false;
}

function shouldBlockWorkspaceDotEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    shouldBlockWorkspaceRuntimeDotEnvKey(upper) ||
    BLOCKED_WORKSPACE_DOTENV_KEYS.has(upper) ||
    BLOCKED_WORKSPACE_DOTENV_PREFIXES.some((prefix) => upper.startsWith(prefix)) ||
    BLOCKED_WORKSPACE_DOTENV_SUFFIXES.some((suffix) => upper.endsWith(suffix))
  );
}

type DotEnvEntry = {
  key: string;
  value: string;
};

type LoadedDotEnvFile = {
  filePath: string;
  entries: DotEnvEntry[];
};

function readDotEnvFile(params: {
  filePath: string;
  shouldBlockKey: (key: string) => boolean;
  quiet?: boolean;
}): LoadedDotEnvFile | null {
  let content: string;
  try {
    content = fs.readFileSync(params.filePath, "utf8");
  } catch (error) {
    if (!params.quiet) {
      const code =
        error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
      if (code !== "ENOENT") {
        console.warn(`[dotenv] Failed to read ${params.filePath}: ${String(error)}`);
      }
    }
    return null;
  }

  let parsed: Record<string, string>;
  try {
    parsed = dotenv.parse(content);
  } catch (error) {
    if (!params.quiet) {
      console.warn(`[dotenv] Failed to parse ${params.filePath}: ${String(error)}`);
    }
    return null;
  }
  const entries: DotEnvEntry[] = [];
  for (const [rawKey, value] of Object.entries(parsed)) {
    const key = normalizeEnvVarKey(rawKey, { portable: true });
    if (!key || params.shouldBlockKey(key)) {
      continue;
    }
    entries.push({ key, value });
  }
  return { filePath: params.filePath, entries };
}

export function loadRuntimeDotEnvFile(filePath: string, opts?: { quiet?: boolean }) {
  const parsed = readDotEnvFile({
    filePath,
    shouldBlockKey: shouldBlockRuntimeDotEnvKey,
    quiet: opts?.quiet ?? true,
  });
  if (!parsed) {
    return;
  }
  for (const { key, value } of parsed.entries) {
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }
}

export function loadWorkspaceDotEnvFile(filePath: string, opts?: { quiet?: boolean }) {
  const parsed = readDotEnvFile({
    filePath,
    shouldBlockKey: shouldBlockWorkspaceDotEnvKey,
    quiet: opts?.quiet ?? true,
  });
  if (!parsed) {
    return;
  }
  for (const { key, value } of parsed.entries) {
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }
}

function loadParsedDotEnvFiles(files: LoadedDotEnvFile[]) {
  const preExistingKeys = new Set(Object.keys(process.env));
  const conflicts = new Map<string, { keptPath: string; ignoredPath: string; keys: Set<string> }>();
  const firstSeen = new Map<string, { value: string; filePath: string }>();

  for (const file of files) {
    for (const { key, value } of file.entries) {
      if (preExistingKeys.has(key)) {
        continue;
      }
      const previous = firstSeen.get(key);
      if (previous) {
        if (previous.value !== value) {
          const conflictKey = `${previous.filePath}\u0000${file.filePath}`;
          const existing = conflicts.get(conflictKey);
          if (existing) {
            existing.keys.add(key);
          } else {
            conflicts.set(conflictKey, {
              keptPath: previous.filePath,
              ignoredPath: file.filePath,
              keys: new Set([key]),
            });
          }
        }
        continue;
      }
      firstSeen.set(key, { value, filePath: file.filePath });
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  for (const conflict of conflicts.values()) {
    const keys = [...conflict.keys].toSorted();
    if (keys.length === 0) {
      continue;
    }
    console.warn(
      `[dotenv] Conflicting values in ${conflict.keptPath} and ${conflict.ignoredPath} for ${keys.join(", ")}; keeping ${conflict.keptPath}.`,
    );
  }
}

export function loadGlobalRuntimeDotEnvFiles(opts?: { quiet?: boolean; stateEnvPath?: string }) {
  const quiet = opts?.quiet ?? true;
  const stateEnvPath = opts?.stateEnvPath ?? path.join(resolveConfigDir(process.env), ".env");
  const defaultStateEnvPath = path.join(
    resolveRequiredHomeDir(process.env, os.homedir),
    ".kova",
    ".env",
  );
  const hasExplicitNonDefaultStateDir =
    process.env.KOVA_STATE_DIR?.trim() !== undefined &&
    path.resolve(stateEnvPath) !== path.resolve(defaultStateEnvPath);
  const parsedFiles = [
    readDotEnvFile({
      filePath: stateEnvPath,
      shouldBlockKey: shouldBlockRuntimeDotEnvKey,
      quiet,
    }),
  ];
  if (!hasExplicitNonDefaultStateDir) {
    parsedFiles.push(
      readDotEnvFile({
        filePath: path.join(
          resolveRequiredHomeDir(process.env, os.homedir),
          ".config",
          "kova",
          "gateway.env",
        ),
        shouldBlockKey: shouldBlockRuntimeDotEnvKey,
        quiet,
      }),
    );
  }
  const parsed = parsedFiles.filter((file): file is LoadedDotEnvFile => file !== null);
  loadParsedDotEnvFiles(parsed);
}

export function loadDotEnv(opts?: { quiet?: boolean }) {
  const quiet = opts?.quiet ?? true;
  const cwdEnvPath = path.join(process.cwd(), ".env");
  loadWorkspaceDotEnvFile(cwdEnvPath, { quiet });

  // Then load global fallback: ~/.kova/.env (or KOVA_STATE_DIR/.env),
  // without overriding any env vars already present.
  loadGlobalRuntimeDotEnvFiles({ quiet });
}
