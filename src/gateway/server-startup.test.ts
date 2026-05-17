import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../config/config.js";

const ensureKovaModelsJsonMock = vi.fn<
  (
    config: unknown,
    agentDir: unknown,
    options?: unknown,
  ) => Promise<{ agentDir: string; wrote: boolean }>
>(async () => ({ agentDir: "/tmp/agent", wrote: false }));
const piModelModuleLoadedMock = vi.fn();
const resolveEmbeddedAgentRuntimeMock = vi.fn(() => "auto");

vi.mock("../agents/agent-paths.js", () => ({
  resolveKovaAgentDir: () => "/tmp/agent",
}));

vi.mock("../agents/models-config.js", () => ({
  ensureKovaModelsJson: (config: unknown, agentDir: unknown, options?: unknown) =>
    ensureKovaModelsJsonMock(config, agentDir, options),
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveAgentWorkspaceDir: () => "/tmp/workspace",
  resolveDefaultAgentId: () => "main",
}));

vi.mock("../agents/pi-embedded-runner/model.js", () => {
  piModelModuleLoadedMock();
  return {
    resolveModel: () => ({}),
  };
});

vi.mock("../agents/pi-embedded-runner/runtime.js", () => ({
  resolveEmbeddedAgentRuntime: () => resolveEmbeddedAgentRuntimeMock(),
}));

let prewarmConfiguredPrimaryModel: typeof import("./server-startup.js").__testing.prewarmConfiguredPrimaryModel;
let shouldSkipStartupModelPrewarm: typeof import("./server-startup.js").__testing.shouldSkipStartupModelPrewarm;

function expectModelsJsonPrewarmCall(cfg: KovaConfig) {
  expect(ensureKovaModelsJsonMock).toHaveBeenCalledTimes(1);
  const [calledConfig, agentDir, options] = ensureKovaModelsJsonMock.mock.calls.at(0) ?? [];
  expect(calledConfig).toBe(cfg);
  expect(agentDir).toBe("/tmp/agent");
  expect(options).toEqual({
    workspaceDir: "/tmp/workspace",
    providerDiscoveryProviderIds: ["openai-codex"],
    providerDiscoveryTimeoutMs: 5000,
    providerDiscoveryEntriesOnly: true,
  });
}

describe("gateway startup primary model warmup", () => {
  beforeAll(async () => {
    ({
      __testing: { prewarmConfiguredPrimaryModel, shouldSkipStartupModelPrewarm },
    } = await import("./server-startup.js"));
  });

  beforeEach(() => {
    ensureKovaModelsJsonMock.mockClear();
    piModelModuleLoadedMock.mockClear();
    resolveEmbeddedAgentRuntimeMock.mockClear();
    resolveEmbeddedAgentRuntimeMock.mockReturnValue("auto");
  });

  it("prewarms an explicit configured primary model", async () => {
    const cfg = {
      agents: {
        defaults: {
          model: {
            primary: "openai-codex/gpt-5.4",
          },
        },
      },
    } as KovaConfig;

    await prewarmConfiguredPrimaryModel({
      cfg,
      log: { warn: vi.fn() },
    });

    expectModelsJsonPrewarmCall(cfg);
    expect(piModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("skips warmup when no explicit primary model is configured", async () => {
    await prewarmConfiguredPrimaryModel({
      cfg: {} as KovaConfig,
      log: { warn: vi.fn() },
    });

    expect(ensureKovaModelsJsonMock).not.toHaveBeenCalled();
    expect(piModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("skips warmup for auto model aliases", async () => {
    await prewarmConfiguredPrimaryModel({
      cfg: {
        agents: {
          defaults: {
            model: {
              primary: "openrouter/auto",
            },
          },
        },
      } as KovaConfig,
      log: { warn: vi.fn() },
    });

    expect(ensureKovaModelsJsonMock).not.toHaveBeenCalled();
    expect(piModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("honors the startup model prewarm skip env", () => {
    expect(shouldSkipStartupModelPrewarm({})).toBe(false);
    expect(
      shouldSkipStartupModelPrewarm({
        KOVA_SKIP_STARTUP_MODEL_PREWARM: "1",
      }),
    ).toBe(true);
    expect(
      shouldSkipStartupModelPrewarm({
        KOVA_SKIP_STARTUP_MODEL_PREWARM: "true",
      }),
    ).toBe(true);
  });

  it("skips static warmup for configured CLI backends", async () => {
    await prewarmConfiguredPrimaryModel({
      cfg: {
        agents: {
          defaults: {
            model: {
              primary: "codex-cli/gpt-5.5",
            },
            cliBackends: {
              "codex-cli": {
                command: "codex",
                args: ["exec"],
              },
            },
          },
        },
      } as KovaConfig,
      log: { warn: vi.fn() },
    });

    expect(ensureKovaModelsJsonMock).not.toHaveBeenCalled();
    expect(piModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("skips static warmup when a non-PI agent runtime is forced", async () => {
    resolveEmbeddedAgentRuntimeMock.mockReturnValue("codex");
    await prewarmConfiguredPrimaryModel({
      cfg: {
        agents: {
          defaults: {
            model: {
              primary: "codex/gpt-5.4",
            },
          },
        },
      } as KovaConfig,
      log: { warn: vi.fn() },
    });

    expect(ensureKovaModelsJsonMock).not.toHaveBeenCalled();
    expect(piModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("keeps PI static warmup when the PI agent runtime is forced", async () => {
    resolveEmbeddedAgentRuntimeMock.mockReturnValue("pi");
    const cfg = {
      agents: {
        defaults: {
          model: {
            primary: "openai-codex/gpt-5.4",
          },
        },
      },
    } as KovaConfig;

    await prewarmConfiguredPrimaryModel({
      cfg,
      log: { warn: vi.fn() },
    });

    expectModelsJsonPrewarmCall(cfg);
    expect(piModelModuleLoadedMock).not.toHaveBeenCalled();
  });

  it("warns when scoped models.json preparation fails", async () => {
    ensureKovaModelsJsonMock.mockRejectedValueOnce(new Error("models write failed"));
    const warn = vi.fn();

    await prewarmConfiguredPrimaryModel({
      cfg: {
        agents: {
          defaults: {
            model: {
              primary: "codex/gpt-5.4",
            },
          },
        },
      } as KovaConfig,
      log: { warn },
    });

    expect(warn).toHaveBeenCalledWith(
      "startup model warmup failed for codex/gpt-5.4: Error: models write failed",
    );
  });
});
