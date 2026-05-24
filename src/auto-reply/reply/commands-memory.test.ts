import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
    expect(result?.reply?.text).toContain("/memory sync");
    expect(result?.reply?.text).toContain("/memory dreams");
    expect(result?.reply?.text).toContain("kova memory search");
    expect(getActiveMemorySearchManagerMock).not.toHaveBeenCalled();
  });

  it("formats lightweight memory status", async () => {
    const close = vi.fn();
    getActiveMemorySearchManagerMock.mockResolvedValue({
      manager: { status: () => baseStatus, close },
    });

    const result = await handleMemoryCommand(buildParams("/memory status"), true);

    expect(result?.reply?.text).toContain("Memory status:");
    expect(result?.reply?.text).toContain("backend builtin");
    expect(result?.reply?.text).toContain("3 files");
    expect(result?.reply?.text).toContain("vector ready");
    expect(getActiveMemorySearchManagerMock).toHaveBeenCalledWith({
      cfg: baseCommandTestConfig,
      agentId: "main",
      purpose: "status",
    });
    expect(close).toHaveBeenCalledOnce();
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
    expect(getActiveMemorySearchManagerMock).toHaveBeenCalledWith({
      cfg: baseCommandTestConfig,
      agentId: "main",
    });
  });

  it("returns usage for missing search query", async () => {
    const result = await handleMemoryCommand(buildParams("/memory search"), true);

    expect(result?.reply?.text).toBe("Usage: /memory search <query>");
    expect(getActiveMemorySearchManagerMock).not.toHaveBeenCalled();
  });

  it("syncs active memory on demand", async () => {
    const sync = vi.fn(
      async (params: {
        progress?: (update: { completed: number; total: number; label?: string }) => void;
      }) => {
        params.progress?.({ completed: 2, total: 3, label: "sessions" });
        params.progress?.({ completed: 3, total: 3, label: "memory" });
      },
    );
    getActiveMemorySearchManagerMock.mockResolvedValue({
      manager: { status: () => baseStatus, sync },
    });

    const result = await handleMemoryCommand(buildParams("/memory sync force"), true);

    expect(result?.reply?.text).toContain("Memory sync complete (forced).");
    expect(result?.reply?.text).toContain("Indexed 3/3: memory");
    expect(result?.reply?.text).toContain("Memory status:");
    expect(sync).toHaveBeenCalledWith({
      reason: "chat-command",
      force: true,
      progress: expect.any(Function),
    });
  });

  it("reports sync unavailable when the active backend cannot sync", async () => {
    getActiveMemorySearchManagerMock.mockResolvedValue({
      manager: { status: () => baseStatus },
    });

    const result = await handleMemoryCommand(buildParams("/memory sync"), true);

    expect(result?.reply?.text).toContain("Memory sync unavailable for active backend.");
  });

  it("reads memory source excerpts from citations", async () => {
    const readFile = vi.fn(async () => ({
      path: "memory/people.md",
      from: 4,
      lines: 2,
      text: "Chirag prefers terminal-first workflows.\nKova should make recall inspectable.",
    }));
    getActiveMemorySearchManagerMock.mockResolvedValue({
      manager: { readFile },
    });

    const result = await handleMemoryCommand(
      buildParams("/memory read memory/people.md:4-5"),
      true,
    );

    expect(result?.reply?.text).toContain("Memory read: memory/people.md:4-5");
    expect(result?.reply?.text).toContain("terminal-first workflows");
    expect(readFile).toHaveBeenCalledWith({
      relPath: "memory/people.md",
      from: 4,
      lines: 2,
    });
  });

  it("returns usage for missing read target", async () => {
    const result = await handleMemoryCommand(buildParams("/memory read"), true);

    expect(result?.reply?.text).toBe(
      "Usage: /memory read <path[:line[-end]]> [from=<line>] [lines=<count>]",
    );
    expect(getActiveMemorySearchManagerMock).not.toHaveBeenCalled();
  });

  it("reads the Dream Diary through memory commands", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-memory-dreams-"));
    const close = vi.fn();
    try {
      await fs.writeFile(
        path.join(workspaceDir, "DREAMS.md"),
        ["# Dream Diary", "older note", "newer note"].join("\n"),
        "utf-8",
      );
      getActiveMemorySearchManagerMock.mockResolvedValue({
        manager: { status: () => ({ ...baseStatus, workspaceDir }), close },
      });

      const result = await handleMemoryCommand(buildParams("/memory dreams lines=2"), true);

      expect(result?.reply?.text).toContain("Dream Diary (main): DREAMS.md");
      expect(result?.reply?.text).toContain("Showing: last 2 of 3 lines");
      expect(result?.reply?.text).toContain("older note\nnewer note");
      expect(result?.reply?.text).not.toContain("# Dream Diary");
      expect(close).toHaveBeenCalledOnce();
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("reports when the Dream Diary has not been created yet", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-memory-dreams-missing-"));
    const close = vi.fn();
    try {
      getActiveMemorySearchManagerMock.mockResolvedValue({
        manager: { status: () => ({ ...baseStatus, workspaceDir }), close },
      });

      const result = await handleMemoryCommand(buildParams("/memory dreams"), true);

      expect(result?.reply?.text).toContain("Dream Diary not found");
      expect(result?.reply?.text).toContain("DREAMS.md");
      expect(close).toHaveBeenCalledOnce();
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});
