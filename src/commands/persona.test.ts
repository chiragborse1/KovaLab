import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../config/types.kova.js";
import type { OutputRuntimeEnv } from "../runtime.js";
import { makeTempWorkspace } from "../test-helpers/workspace.js";

const commandSharedMocks = vi.hoisted(() => ({
  requireValidConfig: vi.fn(),
}));

vi.mock("./agents.command-shared.js", () => ({
  requireValidConfig: commandSharedMocks.requireValidConfig,
}));

const {
  formatPersonaContent,
  personaInitCommand,
  personaPathCommand,
  personaShowCommand,
  personaStatusCommand,
  resolvePersonaStatus,
} = await import("./persona.js");

function createRuntime(): OutputRuntimeEnv & { logs: string[]; json: unknown[] } {
  const logs: string[] = [];
  const json: unknown[] = [];
  return {
    logs,
    json,
    log: vi.fn((message: unknown) => logs.push(String(message))),
    error: vi.fn(),
    exit: vi.fn(),
    writeStdout: vi.fn(),
    writeJson: vi.fn((value: unknown) => json.push(value)),
  };
}

function configForWorkspace(workspace: string): KovaConfig {
  return {
    agents: {
      list: [{ id: "main", workspace }],
    },
  };
}

describe("persona commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves SOUL.md status for the selected agent workspace", async () => {
    const workspace = await makeTempWorkspace("kova-persona-status-");
    try {
      await fs.writeFile(path.join(workspace, "SOUL.md"), "hello\nthere\n", "utf-8");

      const status = await resolvePersonaStatus({
        cfg: configForWorkspace(workspace),
        agent: "main",
      });

      expect(status).toMatchObject({
        agentId: "main",
        workspaceDir: workspace,
        found: true,
        lineCount: 3,
      });
      expect(status.personaPath).toBe(path.join(workspace, "SOUL.md"));
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it("formats bounded persona content with a continuation command", () => {
    const text = formatPersonaContent(
      {
        agentId: "main",
        workspaceDir: "/tmp/kova-persona",
        personaPath: "/tmp/kova-persona/SOUL.md",
        found: true,
        lineCount: 4,
        bytes: 20,
        content: ["one", "two", "three", "four"].join("\n"),
      },
      { lines: 2 },
    );

    expect(text).toContain("Showing: first 2 of 4 lines");
    expect(text).toContain("one\ntwo");
    expect(text).not.toContain("three");
    expect(text).toContain("kova persona show --agent main --all");
  });

  it("creates SOUL.md from the default template when missing", async () => {
    const workspace = await makeTempWorkspace("kova-persona-init-");
    const runtime = createRuntime();
    try {
      commandSharedMocks.requireValidConfig.mockResolvedValue(configForWorkspace(workspace));

      await personaInitCommand({ agent: "main" }, runtime);

      const content = await fs.readFile(path.join(workspace, "SOUL.md"), "utf-8");
      expect(content).toContain("# SOUL.md");
      expect(runtime.logs.join("\n")).toContain("Created");
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });

  it("prints status, show, and path output through the CLI command helpers", async () => {
    const workspace = await makeTempWorkspace("kova-persona-cli-");
    const runtime = createRuntime();
    try {
      await fs.writeFile(path.join(workspace, "SOUL.md"), "persona line\n", "utf-8");
      commandSharedMocks.requireValidConfig.mockResolvedValue(configForWorkspace(workspace));

      await personaStatusCommand({ agent: "main" }, runtime);
      await personaShowCommand({ agent: "main" }, runtime);
      await personaPathCommand({ agent: "main", json: true }, runtime);

      expect(runtime.logs.join("\n")).toContain("Persona status (main)");
      expect(runtime.logs.join("\n")).toContain("persona line");
      expect(runtime.json[0]).toMatchObject({
        agentId: "main",
        personaPath: path.join(workspace, "SOUL.md"),
      });
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });
});
