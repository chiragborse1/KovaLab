import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../../config/types.kova.js";

const loadConfigMock = vi.fn<() => KovaConfig>();

vi.mock("../../config/config.js", async () => {
  const actual =
    await vi.importActual<typeof import("../../config/config.js")>("../../config/config.js");
  return {
    ...actual,
    getRuntimeConfig: () => loadConfigMock(),
  };
});

describe("agents_list tool", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    loadConfigMock.mockReset();
  });

  it("returns model and agent runtime metadata for allowed agents", async () => {
    loadConfigMock.mockReturnValue({
      agents: {
        defaults: {
          model: "anthropic/claude-opus-4.5",
          agentRuntime: { id: "pi", fallback: "pi" },
          subagents: { allowAgents: ["codex"] },
        },
        list: [
          { id: "main", default: true },
          {
            id: "codex",
            name: "Codex",
            model: "openai/gpt-5.5",
            agentRuntime: { id: "codex", fallback: "none" },
          },
        ],
      },
    } satisfies KovaConfig);

    const { createAgentsListTool } = await import("./agents-list-tool.js");
    const result = await createAgentsListTool({ agentSessionKey: "agent:main:main" }).execute(
      "call",
      {},
    );

    expect(result.details).toMatchObject({
      requester: "main",
      agents: [
        {
          id: "main",
          configured: true,
          model: "anthropic/claude-opus-4.5",
          agentRuntime: { id: "pi", source: "defaults" },
        },
        {
          id: "codex",
          name: "Codex",
          configured: true,
          model: "openai/gpt-5.5",
          agentRuntime: { id: "codex", fallback: "none", source: "agent" },
        },
      ],
    });
  });

  it("marks KOVA_AGENT_RUNTIME as the effective runtime source", async () => {
    vi.stubEnv("KOVA_AGENT_RUNTIME", "codex");
    loadConfigMock.mockReturnValue({
      agents: {
        defaults: {
          model: "openai/gpt-5.5",
        },
        list: [{ id: "main", default: true }],
      },
    } satisfies KovaConfig);

    const { createAgentsListTool } = await import("./agents-list-tool.js");
    const result = await createAgentsListTool({ agentSessionKey: "agent:main:main" }).execute(
      "call",
      {},
    );

    expect(result.details).toMatchObject({
      agents: [
        {
          id: "main",
          agentRuntime: { id: "codex", source: "env" },
        },
      ],
    });
  });
});
