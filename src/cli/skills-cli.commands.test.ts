import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerSkillsCli } from "./skills-cli.js";

const mocks = vi.hoisted(() => {
  const runtimeStdout: string[] = [];
  const runtimeErrors: string[] = [];
  const stringifyArgs = (args: unknown[]) => args.map((value) => String(value)).join(" ");
  const skillStatusReportFixture = {
    workspaceDir: "/tmp/workspace",
    managedSkillsDir: "/tmp/workspace/skills",
    skills: [
      {
        name: "calendar",
        description: "Calendar helpers",
        source: "bundled",
        bundled: false,
        filePath: "/tmp/workspace/skills/calendar/SKILL.md",
        baseDir: "/tmp/workspace/skills/calendar",
        skillKey: "calendar",
        emoji: "📅",
        homepage: "https://example.com/calendar",
        always: false,
        disabled: false,
        blockedByAllowlist: false,
        eligible: true,
        primaryEnv: "CALENDAR_API_KEY",
        requirements: {
          bins: [],
          anyBins: [],
          env: ["CALENDAR_API_KEY"],
          config: [],
          os: [],
        },
        missing: {
          bins: [],
          anyBins: [],
          env: [],
          config: [],
          os: [],
        },
        configChecks: [],
        install: [],
      },
    ],
  };
  const defaultRuntime = {
    log: vi.fn((...args: unknown[]) => {
      void stringifyArgs(args);
    }),
    error: vi.fn((...args: unknown[]) => {
      runtimeErrors.push(stringifyArgs(args));
    }),
    writeStdout: vi.fn((value: string) => {
      runtimeStdout.push(value.endsWith("\n") ? value.slice(0, -1) : value);
    }),
    writeJson: vi.fn((value: unknown, space = 2) => {
      runtimeStdout.push(JSON.stringify(value, null, space > 0 ? space : undefined));
    }),
    exit: vi.fn((code: number) => {
      throw new Error(`__exit__:${code}`);
    }),
  };
  const buildWorkspaceSkillStatusMock = vi.fn((workspaceDir: string, options?: unknown) => {
    void workspaceDir;
    void options;
    return skillStatusReportFixture;
  });
  return {
    loadConfigMock: vi.fn(() => ({})),
    resolveAgentIdByWorkspacePathMock: vi.fn((_config: unknown, _cwd: string) => undefined),
    resolveDefaultAgentIdMock: vi.fn(() => "main"),
    resolveAgentWorkspaceDirMock: vi.fn((_config: unknown, _agentId: string) => "/tmp/workspace"),
    buildWorkspaceSkillStatusMock,
    skillStatusReportFixture,
    defaultRuntime,
    runtimeStdout,
    runtimeErrors,
  };
});

const {
  loadConfigMock,
  resolveAgentIdByWorkspacePathMock,
  resolveDefaultAgentIdMock,
  resolveAgentWorkspaceDirMock,
  buildWorkspaceSkillStatusMock,
  skillStatusReportFixture,
  defaultRuntime,
  runtimeStdout,
  runtimeErrors,
} = mocks;

vi.mock("../runtime.js", () => ({
  defaultRuntime: mocks.defaultRuntime,
}));

vi.mock("../config/config.js", () => ({
  getRuntimeConfig: () => mocks.loadConfigMock(),
  loadConfig: () => mocks.loadConfigMock(),
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveAgentIdByWorkspacePath: (config: unknown, cwd: string) =>
    mocks.resolveAgentIdByWorkspacePathMock(config, cwd),
  resolveDefaultAgentId: () => mocks.resolveDefaultAgentIdMock(),
  resolveAgentWorkspaceDir: (config: unknown, agentId: string) =>
    mocks.resolveAgentWorkspaceDirMock(config, agentId),
}));

vi.mock("../agents/skills-status.js", () => ({
  buildWorkspaceSkillStatus: (workspaceDir: string, options?: unknown) =>
    mocks.buildWorkspaceSkillStatusMock(workspaceDir, options),
}));

describe("skills cli commands", () => {
  const createProgram = () => {
    const program = new Command();
    program.exitOverride();
    registerSkillsCli(program);
    return program;
  };

  const runCommand = (argv: string[]) => createProgram().parseAsync(argv, { from: "user" });

  beforeEach(() => {
    runtimeStdout.length = 0;
    runtimeErrors.length = 0;
    loadConfigMock.mockReset();
    resolveAgentIdByWorkspacePathMock.mockReset();
    resolveDefaultAgentIdMock.mockReset();
    resolveAgentWorkspaceDirMock.mockReset();
    buildWorkspaceSkillStatusMock.mockReset();

    loadConfigMock.mockReturnValue({});
    resolveAgentIdByWorkspacePathMock.mockReturnValue(undefined);
    resolveDefaultAgentIdMock.mockReturnValue("main");
    resolveAgentWorkspaceDirMock.mockReturnValue("/tmp/workspace");
    buildWorkspaceSkillStatusMock.mockReturnValue(skillStatusReportFixture);
    defaultRuntime.log.mockClear();
    defaultRuntime.error.mockClear();
    defaultRuntime.writeStdout.mockClear();
    defaultRuntime.writeJson.mockClear();
    defaultRuntime.exit.mockClear();
  });

  it.each([
    {
      label: "list",
      argv: ["skills", "list", "--json"],
      assert: (payload: Record<string, unknown>) => {
        const skills = payload.skills as Array<Record<string, unknown>>;
        expect(skills).toHaveLength(1);
        expect(skills[0]?.name).toBe("calendar");
      },
    },
    {
      label: "info",
      argv: ["skills", "info", "calendar", "--json"],
      assert: (payload: Record<string, unknown>) => {
        expect(payload.name).toBe("calendar");
        expect(payload.primaryEnv).toBe("CALENDAR_API_KEY");
      },
    },
    {
      label: "check",
      argv: ["skills", "check", "--json"],
      assert: (payload: Record<string, unknown>) => {
        expect(payload.summary).toMatchObject({
          total: 1,
          eligible: 1,
        });
      },
    },
  ])("routes skills $label JSON output through stdout", async ({ argv, assert }) => {
    await runCommand(argv);

    expect(buildWorkspaceSkillStatusMock).toHaveBeenCalledWith("/tmp/workspace", {
      config: {},
    });
    expect(
      defaultRuntime.writeStdout.mock.calls.length + defaultRuntime.writeJson.mock.calls.length,
    ).toBeGreaterThan(0);
    expect(defaultRuntime.log).not.toHaveBeenCalled();
    expect(runtimeErrors).toEqual([]);
    expect(runtimeStdout.length).toBeGreaterThan(0);

    const payload = JSON.parse(runtimeStdout.at(-1) ?? "{}") as Record<string, unknown>;
    assert(payload);
  });

  it("keeps non-JSON skills list output on stdout with human-readable formatting", async () => {
    await runCommand(["skills", "list"]);

    expect(defaultRuntime.writeStdout).toHaveBeenCalledTimes(1);
    expect(defaultRuntime.log).not.toHaveBeenCalled();
    expect(runtimeErrors).toEqual([]);
    expect(runtimeStdout.at(-1)).toContain("calendar");
    expect(runtimeStdout.at(-1)).not.toContain("kova skills search");
  });
});
