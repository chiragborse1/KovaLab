import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseCommandTestConfig, buildCommandTestParams } from "./commands.test-harness.js";

const getActiveMemorySearchManagerMock = vi.hoisted(() => vi.fn());

vi.mock("../../plugins/memory-runtime.js", () => ({
  getActiveMemorySearchManager: getActiveMemorySearchManagerMock,
}));

const { handleMemoryCommand } = await import("./commands-memory.js");

const baseStatus = {
  backend: "builtin",
  provider: "openai",
  model: "text-embedding-3-small",
  files: 3,
  chunks: 12,
  dirty: false,
  sources: ["memory"],
  vector: { enabled: true, available: true },
  fts: { enabled: true, available: true },
  cache: { enabled: true, entries: 2 },
} as const;

function buildParams(commandBody: string) {
  return buildCommandTestParams(commandBody, baseCommandTestConfig);
}

describe("handleMemoryCommand", () => {
  beforeEach(() => {
    getActiveMemorySearchManagerMock.mockReset();
  });

  it("shows memory command help", async () => {
    const result = await handleMemoryCommand(buildParams("/memory"), true);

    expect(result?.shouldContinue).toBe(false);
    expect(result?.reply?.text).toContain("/memory status");
    expect(result?.reply?.text).toContain("kova memory search");
    expect(getActiveMemorySearchManagerMock).not.toHaveBeenCalled();
  });

  it("formats lightweight memory status", async () => {
    getActiveMemorySearchManagerMock.mockResolvedValue({
      manager: { status: () => baseStatus },
    });

    const result = await handleMemoryCommand(buildParams("/memory status"), true);

    expect(result?.reply?.text).toContain("Memory status:");
    expect(result?.reply?.text).toContain("backend builtin");
    expect(result?.reply?.text).toContain("3 files");
    expect(result?.reply?.text).toContain("vector ready");
    expect(getActiveMemorySearchManagerMock).toHaveBeenCalledWith({
      cfg: baseCommandTestConfig,
      agentId: "main",
    });
  });

  it("searches active memory for the current session", async () => {
    const search = vi.fn(async () => [
      {
        path: "memory/people.md",
        startLine: 4,
        endLine: 8,
        score: 0.876,
        snippet: "Chirag prefers terminal-first workflows.",
        source: "memory",
        citation: "memory/people.md:4-8",
      },
    ]);
    getActiveMemorySearchManagerMock.mockResolvedValue({
      manager: { search },
    });

    const result = await handleMemoryCommand(
      buildParams("/memory search terminal workflows"),
      true,
    );

    expect(result?.reply?.text).toContain('Memory search: "terminal workflows"');
    expect(result?.reply?.text).toContain("memory/people.md:4-8");
    expect(result?.reply?.text).toContain("score 0.88");
    expect(search).toHaveBeenCalledWith("terminal workflows", {
      maxResults: 5,
      sessionKey: "agent:main:main",
    });
  });

  it("returns usage for missing search query", async () => {
    const result = await handleMemoryCommand(buildParams("/memory search"), true);

    expect(result?.reply?.text).toBe("Usage: /memory search <query>");
    expect(getActiveMemorySearchManagerMock).not.toHaveBeenCalled();
  });
});
