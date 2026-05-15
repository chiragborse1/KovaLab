import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Agent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAllBootstrapSnapshots } from "../agents/bootstrap-cache.js";
import { clearConfigCache, clearRuntimeConfigSnapshot } from "../config/config.js";
import { clearSessionStoreCacheForTest } from "../config/sessions/store.js";
import { resetAgentRunContextForTest } from "../infra/agent-events.js";
import { PROXY_ENV_KEYS } from "../infra/net/proxy-env.js";
import { clearGatewaySubagentRuntime } from "../plugins/runtime/index.js";
import { captureEnv } from "../test-utils/env.js";
import { startGatewayServer } from "./server.js";
import { getFreeGatewayPort } from "./test-helpers.e2e.js";

const NETWORK_GATEWAY_ENV_KEYS = [
  "HOME",
  "KOVA_STATE_DIR",
  "KOVA_CONFIG_PATH",
  "KOVA_GATEWAY_TOKEN",
  "KOVA_SKIP_CHANNELS",
  "KOVA_SKIP_GMAIL_WATCHER",
  "KOVA_SKIP_CRON",
  "KOVA_SKIP_CANVAS_HOST",
  "KOVA_SKIP_BROWSER_CONTROL_SERVER",
  "KOVA_SKIP_PROVIDERS",
  "KOVA_BUNDLED_PLUGINS_DIR",
  "KOVA_TEST_MINIMAL_GATEWAY",
  ...PROXY_ENV_KEYS,
  "NO_PROXY",
  "no_proxy",
] as const;

function isEnvHttpProxyDispatcher(dispatcher: unknown): boolean {
  return (
    (dispatcher as { constructor?: { name?: string } } | undefined)?.constructor?.name ===
    "EnvHttpProxyAgent"
  );
}

describe("gateway network runtime", () => {
  beforeEach(() => {
    clearRuntimeConfigSnapshot();
    clearConfigCache();
    clearSessionStoreCacheForTest();
    resetAgentRunContextForTest();
    clearAllBootstrapSnapshots();
    clearGatewaySubagentRuntime();
  });

  afterEach(() => {
    clearRuntimeConfigSnapshot();
    clearConfigCache();
    clearSessionStoreCacheForTest();
    resetAgentRunContextForTest();
    clearAllBootstrapSnapshots();
    clearGatewaySubagentRuntime();
  });

  it("bootstraps env proxy dispatching when the gateway starts directly", async () => {
    const envSnapshot = captureEnv([...NETWORK_GATEWAY_ENV_KEYS]);
    const originalDispatcher = getGlobalDispatcher();
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "kova-gw-proxy-home-"));
    let server: Awaited<ReturnType<typeof startGatewayServer>> | undefined;

    try {
      setGlobalDispatcher(new Agent());
      for (const key of NETWORK_GATEWAY_ENV_KEYS) {
        delete process.env[key];
      }
      process.env.HTTPS_PROXY = "http://127.0.0.1:9";

      process.env.HOME = tempHome;
      process.env.KOVA_STATE_DIR = path.join(tempHome, ".kova");
      process.env.KOVA_SKIP_CHANNELS = "1";
      process.env.KOVA_SKIP_GMAIL_WATCHER = "1";
      process.env.KOVA_SKIP_CRON = "1";
      process.env.KOVA_SKIP_CANVAS_HOST = "1";
      process.env.KOVA_SKIP_BROWSER_CONTROL_SERVER = "1";
      process.env.KOVA_SKIP_PROVIDERS = "1";
      process.env.KOVA_TEST_MINIMAL_GATEWAY = "1";
      process.env.KOVA_BUNDLED_PLUGINS_DIR = path.join(tempHome, "empty-bundled-plugins");
      await fs.mkdir(process.env.KOVA_BUNDLED_PLUGINS_DIR, { recursive: true });

      const token = `proxy-token-${process.pid}-${process.env.VITEST_POOL_ID ?? "0"}`;
      process.env.KOVA_GATEWAY_TOKEN = token;
      const configPath = path.join(tempHome, ".kova", "kova.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        `${JSON.stringify({ gateway: { auth: { mode: "token", token } } }, null, 2)}\n`,
      );
      process.env.KOVA_CONFIG_PATH = configPath;

      server = await startGatewayServer(await getFreeGatewayPort(), {
        bind: "loopback",
        auth: { mode: "token", token },
        controlUiEnabled: false,
      });

      expect(isEnvHttpProxyDispatcher(getGlobalDispatcher())).toBe(true);
    } finally {
      await server?.close({ reason: "gateway proxy bootstrap test complete" });
      setGlobalDispatcher(originalDispatcher);
      await fs.rm(tempHome, { recursive: true, force: true });
      envSnapshot.restore();
    }
  });
});
