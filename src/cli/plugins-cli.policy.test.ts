import { beforeEach, describe, expect, it } from "vitest";
import type { KovaConfig } from "../config/config.js";
import {
  enablePluginInConfig,
  loadConfig,
  refreshPluginRegistry,
  resetPluginsCliTestState,
  runPluginsCommand,
  writeConfigFile,
} from "./plugins-cli-test-helpers.js";

describe("plugins cli policy mutations", () => {
  beforeEach(() => {
    resetPluginsCliTestState();
  });

  it("refreshes the persisted plugin registry after enabling a plugin", async () => {
    const enabledConfig = {
      plugins: {
        entries: {
          alpha: { enabled: true },
        },
      },
    } as KovaConfig;
    loadConfig.mockReturnValue({} as KovaConfig);
    enablePluginInConfig.mockReturnValue({
      config: enabledConfig,
      enabled: true,
    });

    await runPluginsCommand(["plugins", "enable", "alpha"]);

    expect(writeConfigFile).toHaveBeenCalledWith(enabledConfig);
    expect(refreshPluginRegistry).toHaveBeenCalledWith({
      config: enabledConfig,
      installRecords: {},
      reason: "policy-changed",
    });
  });

  it("refreshes the persisted plugin registry after disabling a plugin", async () => {
    loadConfig.mockReturnValue({
      plugins: {
        entries: {
          alpha: { enabled: true },
        },
      },
    } as KovaConfig);

    await runPluginsCommand(["plugins", "disable", "alpha"]);

    const nextConfig = writeConfigFile.mock.calls[0]?.[0] as KovaConfig;
    expect(nextConfig.plugins?.entries?.alpha?.enabled).toBe(false);
    expect(refreshPluginRegistry).toHaveBeenCalledWith({
      config: nextConfig,
      installRecords: {},
      reason: "policy-changed",
    });
  });
});
