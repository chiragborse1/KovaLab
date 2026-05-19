import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AnyAgentTool } from "getkova/plugin-sdk/agent-harness";
import { describe, expect, it, vi } from "vitest";
import { __testing } from "./run-attempt.js";

function createRuntimeDynamicTool(name: string): AnyAgentTool {
  return {
    name,
    label: name,
    description: `${name} test tool`,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: vi.fn(
      async (): Promise<AgentToolResult<unknown>> => ({
        content: [{ type: "text", text: `${name} done` }],
        details: {},
      }),
    ),
  } as unknown as AnyAgentTool;
}

describe("Codex app-server sandbox shell tools", () => {
  it("exposes Kova sandbox shell tools under distinct names for non-Docker sandbox backends", () => {
    const tools = __testing.addSandboxShellDynamicToolsIfAvailable(
      [createRuntimeDynamicTool("message")],
      [
        createRuntimeDynamicTool("exec"),
        createRuntimeDynamicTool("process"),
        createRuntimeDynamicTool("message"),
      ],
      {
        sandbox: { enabled: true, backendId: "ssh" },
        pluginConfig: {},
      } as never,
    );

    expect(tools.map((tool) => tool.name)).toEqual(["message", "sandbox_exec", "sandbox_process"]);
    expect(tools.find((tool) => tool.name === "sandbox_exec")?.description).toContain(
      "Kova's configured sandbox backend",
    );
    expect(tools.find((tool) => tool.name === "sandbox_process")?.description).toContain(
      "sandbox_exec sessions",
    );
  });

  it("does not expose sandbox shell tools without non-Docker sandbox routing and follow-up support", () => {
    const baseTools = [createRuntimeDynamicTool("exec"), createRuntimeDynamicTool("process")];
    const dockerTools = __testing.addSandboxShellDynamicToolsIfAvailable([], baseTools, {
      sandbox: { enabled: true, backendId: "docker" },
      pluginConfig: {},
    } as never);
    const disabledSandboxTools = __testing.addSandboxShellDynamicToolsIfAvailable([], baseTools, {
      sandbox: { enabled: false, backendId: "ssh" },
      pluginConfig: {},
    } as never);
    const missingProcessTools = __testing.addSandboxShellDynamicToolsIfAvailable(
      [],
      [createRuntimeDynamicTool("exec")],
      {
        sandbox: { enabled: true, backendId: "ssh" },
        pluginConfig: {},
      } as never,
    );

    expect(dockerTools).toEqual([]);
    expect(disabledSandboxTools).toEqual([]);
    expect(missingProcessTools).toEqual([]);
  });

  it("honors Codex dynamic tool excludes for sandbox shell exposure", () => {
    const baseTools = [createRuntimeDynamicTool("exec"), createRuntimeDynamicTool("process")];

    for (const excludedToolName of ["exec", "sandbox_process"]) {
      const tools = __testing.addSandboxShellDynamicToolsIfAvailable([], baseTools, {
        sandbox: { enabled: true, backendId: "ssh" },
        pluginConfig: { codexDynamicToolsExclude: [excludedToolName] },
      } as never);

      expect(tools).toEqual([]);
    }
  });

  it("points yielded sandbox_exec follow-up guidance at sandbox_process", async () => {
    const execTool = createRuntimeDynamicTool("exec");
    vi.mocked(execTool.execute).mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "Command still running (session exec-1, pid 123). Use process (list/poll/log/write/send-keys/submit/paste/kill/clear/remove) for follow-up.",
        },
      ],
      details: { status: "running" },
    });
    const tools = __testing.addSandboxShellDynamicToolsIfAvailable(
      [],
      [execTool, createRuntimeDynamicTool("process")],
      {
        sandbox: { enabled: true, backendId: "ssh" },
        pluginConfig: {},
      } as never,
    );

    const sandboxExec = tools.find((tool) => tool.name === "sandbox_exec");
    const result = await sandboxExec?.execute("call-1", {}, undefined);

    expect(result?.content).toEqual([
      {
        type: "text",
        text: "Command still running (session exec-1, pid 123). Use sandbox_process (list/poll/log/write/send-keys/submit/paste/kill/clear/remove) for follow-up.",
      },
    ]);
  });

  it("normalizes Codex dynamic toolsAllow entries before filtering", () => {
    const tools = ["exec", "sandbox_exec", "sandbox_process", "apply_patch", "read", "message"].map(
      (name) => ({ name }),
    );

    expect(
      __testing
        .filterCodexDynamicToolsForAllowlist(tools, [" BASH ", "apply-patch", "READ"])
        .map((tool) => tool.name),
    ).toEqual(["exec", "sandbox_exec", "sandbox_process", "apply_patch", "read"]);
    expect(__testing.filterCodexDynamicToolsForAllowlist(tools, [])).toEqual([]);
    expect(__testing.filterCodexDynamicToolsForAllowlist(tools, ["*"])).toEqual(tools);
  });
});
