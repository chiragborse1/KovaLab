import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseCommandTestConfig, buildCommandTestParams } from "./commands.test-harness.js";

const { handlePersonaCommand } = await import("./commands-persona.js");

function buildParams(commandBody: string, workspaceDir: string) {
  return {
    ...buildCommandTestParams(commandBody, {
      ...baseCommandTestConfig,
      agents: { list: [{ id: "main", workspace: workspaceDir }] },
    }),
    workspaceDir,
  };
}

describe("handlePersonaCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows persona status from chat", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-persona-chat-"));
    try {
      await fs.writeFile(path.join(workspaceDir, "SOUL.md"), "warm\nsharp\n", "utf-8");

      const result = await handlePersonaCommand(buildParams("/persona", workspaceDir), true);

      expect(result?.shouldContinue).toBe(false);
      expect(result?.reply?.text).toContain("Persona status (main)");
      expect(result?.reply?.text).toContain("State: ready");
      expect(result?.reply?.text).toContain("kova persona edit --agent main");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("reads bounded persona content from chat", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-persona-chat-show-"));
    try {
      await fs.writeFile(
        path.join(workspaceDir, "SOUL.md"),
        ["line one", "line two", "line three"].join("\n"),
        "utf-8",
      );

      const result = await handlePersonaCommand(
        buildParams("/persona show lines=2", workspaceDir),
        true,
      );

      expect(result?.reply?.text).toContain("Showing: first 2 of 3 lines");
      expect(result?.reply?.text).toContain("line one\nline two");
      expect(result?.reply?.text).not.toContain("line three");
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("keeps persona writes terminal-only from chat", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-persona-chat-edit-"));
    try {
      const result = await handlePersonaCommand(buildParams("/persona edit", workspaceDir), true);

      expect(result?.reply?.text).toBe(
        "Use the terminal for persona writes: kova persona edit --agent main",
      );
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });
});
