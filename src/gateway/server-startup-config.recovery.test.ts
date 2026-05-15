import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigFileSnapshot, KovaConfig } from "../config/types.js";
import { buildTestConfigSnapshot } from "./test-helpers.config-snapshots.js";

vi.mock("../config/config.js", () => ({
  applyConfigOverrides: vi.fn((config: KovaConfig) => config),
  isNixMode: false,
  readConfigFileSnapshot: vi.fn(),
  recoverConfigFromLastKnownGood: vi.fn(),
  recoverConfigFromJsonRootSuffix: vi.fn(),
  isPluginLocalInvalidConfigSnapshot: vi.fn((snapshot: ConfigFileSnapshot) => {
    if (snapshot.valid || snapshot.legacyIssues.length > 0 || snapshot.issues.length === 0) {
      return false;
    }
    return snapshot.issues.every((issue) => issue.path.startsWith("plugins.entries."));
  }),
  shouldAttemptLastKnownGoodRecovery: vi.fn((snapshot: ConfigFileSnapshot) => {
    if (snapshot.valid) {
      return false;
    }
    return !(
      snapshot.legacyIssues.length === 0 &&
      snapshot.issues.length > 0 &&
      snapshot.issues.every((issue) => issue.path.startsWith("plugins.entries."))
    );
  }),
  validateConfigObjectWithPlugins: vi.fn((config: KovaConfig) => ({
    ok: true,
    config,
    warnings: [],
  })),
  writeConfigFile: vi.fn(),
}));

vi.mock("./config-recovery-notice.js", () => ({
  enqueueConfigRecoveryNotice: vi.fn(),
}));

let loadGatewayStartupConfigSnapshot: typeof import("./server-startup-config.js").loadGatewayStartupConfigSnapshot;
let configIo: typeof import("../config/config.js");
let recoveryNotice: typeof import("./config-recovery-notice.js");

const configPath = "/tmp/kova-startup-recovery.json";
const validConfig = {
  gateway: {
    mode: "local",
  },
} as KovaConfig;

function buildSnapshot(params: {
  valid: boolean;
  raw: string;
  config?: KovaConfig;
}): ConfigFileSnapshot {
  return buildTestConfigSnapshot({
    path: configPath,
    exists: true,
    raw: params.raw,
    parsed: params.config ?? null,
    valid: params.valid,
    config: params.config ?? ({} as KovaConfig),
    issues: params.valid ? [] : [{ path: "gateway.mode", message: "Expected 'local' or 'remote'" }],
    legacyIssues: [],
  });
}

describe("gateway startup config recovery", () => {
  beforeAll(async () => {
    ({ loadGatewayStartupConfigSnapshot } = await import("./server-startup-config.js"));
    configIo = await import("../config/config.js");
    recoveryNotice = await import("./config-recovery-notice.js");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores last-known-good config before startup validation", async () => {
    const invalidSnapshot = buildSnapshot({ valid: false, raw: "{ invalid json" });
    const recoveredSnapshot = buildSnapshot({
      valid: true,
      raw: `${JSON.stringify(validConfig)}\n`,
      config: validConfig,
    });
    vi.mocked(configIo.readConfigFileSnapshot)
      .mockResolvedValueOnce(invalidSnapshot)
      .mockResolvedValueOnce(recoveredSnapshot);
    vi.mocked(configIo.recoverConfigFromLastKnownGood).mockResolvedValueOnce(true);
    const log = { info: vi.fn(), warn: vi.fn() };

    await expect(
      loadGatewayStartupConfigSnapshot({
        minimalTestGateway: true,
        log,
      }),
    ).resolves.toEqual({
      snapshot: recoveredSnapshot,
      wroteConfig: true,
    });

    expect(configIo.recoverConfigFromLastKnownGood).toHaveBeenCalledWith({
      snapshot: invalidSnapshot,
      reason: "startup-invalid-config",
    });
    expect(log.warn).toHaveBeenCalledWith(
      `gateway: invalid config was restored from last-known-good backup: ${configPath}`,
    );
    expect(recoveryNotice.enqueueConfigRecoveryNotice).toHaveBeenCalledWith({
      cfg: recoveredSnapshot.config,
      phase: "startup",
      reason: "startup-invalid-config",
      configPath,
    });
  });

  it("keeps startup validation loud when last-known-good recovery is unavailable", async () => {
    const invalidSnapshot = buildSnapshot({ valid: false, raw: "{ invalid json" });
    vi.mocked(configIo.readConfigFileSnapshot).mockResolvedValueOnce(invalidSnapshot);
    vi.mocked(configIo.recoverConfigFromLastKnownGood).mockResolvedValueOnce(false);
    vi.mocked(configIo.recoverConfigFromJsonRootSuffix).mockResolvedValueOnce(false);

    await expect(
      loadGatewayStartupConfigSnapshot({
        minimalTestGateway: true,
        log: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow(
      `Invalid config at ${configPath}.\ngateway.mode: Expected 'local' or 'remote'\nRun "kova doctor --fix" to repair, then retry.`,
    );

    expect(recoveryNotice.enqueueConfigRecoveryNotice).not.toHaveBeenCalled();
  });

  it("continues startup in degraded mode for plugin-local startup invalidity", async () => {
    const invalidSnapshot = buildTestConfigSnapshot({
      path: configPath,
      exists: true,
      raw: `${JSON.stringify({
        gateway: { mode: "local" },
        plugins: {
          entries: {
            feishu: { enabled: true },
          },
        },
      })}\n`,
      parsed: {
        gateway: { mode: "local" },
        plugins: {
          entries: {
            feishu: { enabled: true },
          },
        },
      },
      valid: false,
      config: {
        gateway: { mode: "local" },
        plugins: {
          entries: {
            feishu: { enabled: true },
          },
        },
      } as KovaConfig,
      issues: [
        {
          path: "plugins.entries.feishu",
          message:
            "plugin feishu: plugin requires Kova >=2026.4.23, but this host is 2026.4.22; skipping load",
        },
      ],
      legacyIssues: [],
    });
    vi.mocked(configIo.readConfigFileSnapshot).mockResolvedValueOnce(invalidSnapshot);
    const log = { info: vi.fn(), warn: vi.fn() };

    await expect(
      loadGatewayStartupConfigSnapshot({
        minimalTestGateway: true,
        log,
      }),
    ).resolves.toEqual({
      snapshot: expect.objectContaining({
        valid: true,
        issues: [],
        warnings: invalidSnapshot.issues,
      }),
      wroteConfig: false,
      degradedPluginConfig: true,
    });

    expect(configIo.recoverConfigFromLastKnownGood).not.toHaveBeenCalled();
    expect(configIo.recoverConfigFromJsonRootSuffix).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      `gateway: skipped plugin config validation issue at plugins.entries.feishu: plugin feishu: plugin requires Kova >=2026.4.23, but this host is 2026.4.22; skipping load. Run "kova doctor --fix" to quarantine the plugin config.`,
    );
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "gateway: config warnings:\n- plugins.entries.feishu: plugin feishu: plugin requires Kova >=2026.4.23",
      ),
    );
    expect(recoveryNotice.enqueueConfigRecoveryNotice).not.toHaveBeenCalled();
  });

  it("logs config warnings without failing startup", async () => {
    const snapshot = buildTestConfigSnapshot({
      path: configPath,
      exists: true,
      raw: `${JSON.stringify(validConfig)}\n`,
      parsed: validConfig,
      valid: true,
      config: validConfig,
      issues: [],
      warnings: [
        {
          path: "channels.acme-chat",
          message:
            'channel plugin is not available: acme-chat (install or enable plugin "acme-chat", then run kova doctor --fix)',
        },
      ],
      legacyIssues: [],
    });
    vi.mocked(configIo.readConfigFileSnapshot).mockResolvedValueOnce(snapshot);
    const log = { info: vi.fn(), warn: vi.fn() };

    await expect(
      loadGatewayStartupConfigSnapshot({
        minimalTestGateway: true,
        log,
      }),
    ).resolves.toEqual({
      snapshot,
      wroteConfig: false,
    });

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'channels.acme-chat: channel plugin is not available: acme-chat (install or enable plugin "acme-chat", then run kova doctor --fix)',
      ),
    );
  });

  it("keeps mixed plugin and core startup invalidity fatal", async () => {
    const invalidSnapshot = buildTestConfigSnapshot({
      path: configPath,
      exists: true,
      raw: `${JSON.stringify({
        gateway: { mode: "invalid" },
        plugins: {
          entries: {
            feishu: { enabled: true },
          },
        },
      })}\n`,
      parsed: {
        gateway: { mode: "invalid" },
        plugins: {
          entries: {
            feishu: { enabled: true },
          },
        },
      },
      valid: false,
      config: {
        gateway: { mode: "invalid" },
        plugins: {
          entries: {
            feishu: { enabled: true },
          },
        },
      } as unknown as KovaConfig,
      issues: [
        {
          path: "gateway.mode",
          message: "Expected 'local' or 'remote'",
        },
        {
          path: "plugins.entries.feishu.config.token",
          message: "invalid config: must be string",
        },
      ],
      legacyIssues: [],
    });
    vi.mocked(configIo.readConfigFileSnapshot).mockResolvedValueOnce(invalidSnapshot);
    vi.mocked(configIo.recoverConfigFromLastKnownGood).mockResolvedValueOnce(false);
    vi.mocked(configIo.recoverConfigFromJsonRootSuffix).mockResolvedValueOnce(false);

    await expect(
      loadGatewayStartupConfigSnapshot({
        minimalTestGateway: true,
        log: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow(`Invalid config at ${configPath}.`);

    expect(configIo.recoverConfigFromLastKnownGood).toHaveBeenCalledWith({
      snapshot: invalidSnapshot,
      reason: "startup-invalid-config",
    });
  });

  it("skips providers with stale model api enum values during startup", async () => {
    const config = {
      gateway: { mode: "local" },
      models: {
        providers: {
          openrouter: {
            baseUrl: "https://openrouter.ai/api/v1",
            api: "openai",
            models: [
              {
                id: "openai/gpt-4o-mini",
                name: "OpenRouter GPT-4o Mini",
                api: "openai",
                reasoning: false,
                input: ["text"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 128_000,
                maxTokens: 16_384,
              },
            ],
          },
          anthropic: {
            baseUrl: "https://api.anthropic.com",
            api: "anthropic-messages",
            models: [],
          },
        },
      },
    } as unknown as KovaConfig;
    const invalidSnapshot = buildTestConfigSnapshot({
      path: configPath,
      exists: true,
      raw: `${JSON.stringify(config)}\n`,
      parsed: config,
      valid: false,
      config,
      issues: [
        {
          path: "models.providers.openrouter.api",
          message:
            'Invalid option: expected one of "openai-completions"|"openai-responses"|"openai-codex-responses"|"anthropic-messages"|"google-generative-ai"|"github-copilot"|"bedrock-converse-stream"|"ollama"|"azure-openai-responses"',
        },
        {
          path: "models.providers.openrouter.models.0.api",
          message:
            'Invalid option: expected one of "openai-completions"|"openai-responses"|"openai-codex-responses"|"anthropic-messages"|"google-generative-ai"|"github-copilot"|"bedrock-converse-stream"|"ollama"|"azure-openai-responses"',
        },
      ],
      legacyIssues: [],
    });
    vi.mocked(configIo.readConfigFileSnapshot).mockResolvedValueOnce(invalidSnapshot);
    const log = { info: vi.fn(), warn: vi.fn() };

    const result = await loadGatewayStartupConfigSnapshot({
      minimalTestGateway: false,
      log,
    });

    expect(result.wroteConfig).toBe(false);
    expect(result.degradedProviderApi).toBe(true);
    expect(result.snapshot.valid).toBe(true);
    expect(result.snapshot.sourceConfig.models?.providers?.openrouter).toBeUndefined();
    expect(result.snapshot.sourceConfig.models?.providers?.anthropic).toEqual(
      config.models?.providers?.anthropic,
    );
    expect(configIo.recoverConfigFromLastKnownGood).not.toHaveBeenCalled();
    expect(configIo.writeConfigFile).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'gateway: skipped model provider openrouter; configured provider api is invalid. Run "kova doctor --fix" to repair the config.',
    );
  });

  it("strips a valid JSON suffix when last-known-good recovery is unavailable", async () => {
    const invalidSnapshot = buildSnapshot({
      valid: false,
      raw: `Found and updated: False\n${JSON.stringify(validConfig)}\n`,
    });
    const repairedSnapshot = buildSnapshot({
      valid: true,
      raw: `${JSON.stringify(validConfig)}\n`,
      config: validConfig,
    });
    vi.mocked(configIo.readConfigFileSnapshot)
      .mockResolvedValueOnce(invalidSnapshot)
      .mockResolvedValueOnce(repairedSnapshot);
    vi.mocked(configIo.recoverConfigFromLastKnownGood).mockResolvedValueOnce(false);
    vi.mocked(configIo.recoverConfigFromJsonRootSuffix).mockResolvedValueOnce(true);
    const log = { info: vi.fn(), warn: vi.fn() };

    await expect(
      loadGatewayStartupConfigSnapshot({
        minimalTestGateway: true,
        log,
      }),
    ).resolves.toEqual({
      snapshot: repairedSnapshot,
      wroteConfig: true,
    });

    expect(configIo.recoverConfigFromJsonRootSuffix).toHaveBeenCalledWith(invalidSnapshot);
    expect(log.warn).toHaveBeenCalledWith(
      `gateway: invalid config was repaired by stripping a non-JSON prefix: ${configPath}`,
    );
  });
});
