const COMMON_LIVE_ENV_NAMES = [
  "KOVA_AGENT_RUNTIME",
  "KOVA_CONFIG_PATH",
  "KOVA_GATEWAY_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "KOVA_SKIP_BROWSER_CONTROL_SERVER",
  "KOVA_SKIP_CANVAS_HOST",
  "KOVA_SKIP_CHANNELS",
  "KOVA_SKIP_CRON",
  "KOVA_SKIP_GMAIL_WATCHER",
  "KOVA_STATE_DIR",
] as const;

export type LiveEnvSnapshot = Record<string, string | undefined>;

export function snapshotLiveEnv(extraNames: readonly string[] = []): LiveEnvSnapshot {
  const snapshot: LiveEnvSnapshot = {};
  for (const name of [...COMMON_LIVE_ENV_NAMES, ...extraNames]) {
    snapshot[name] = process.env[name];
  }
  return snapshot;
}

export function restoreLiveEnv(snapshot: LiveEnvSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
