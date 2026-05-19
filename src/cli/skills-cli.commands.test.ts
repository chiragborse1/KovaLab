import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerSkillsCli } from "./skills-cli.js";

const mocks = vi.hoisted(() => {
  const runtimeLogs: string[] = [];
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
      runtimeLogs.push(stringifyArgs(args));
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
    resolveAgentIdByWorkspacePathMock: vi.fn(() => undefined),
    resolveDefaultAgentIdMock: vi.fn(() => "main"),
    resolveAgentWorkspaceDirMock: vi.fn(() => "/tmp/workspace"),
    searchSkillsFromKovaHubMock: vi.fn(),
    installSkillFromKovaHubMock: vi.fn(),
    updateSkillsFromKovaHubMock: vi.fn(),
    readTrackedKovaHubSkillSlugsMock: vi.fn(),
    buildWorkspaceSkillStatusMock,
    skillStatusReportFixture,
    defaultRuntime,
    runtimeLogs,
    runtimeStdout,
    runtimeErrors,
  };
});

const {
  loadConfigMock,
  resolveAgentIdByWorkspacePathMock,
  resolveDefaultAgentIdMock,
  resolveAgentWorkspaceDirMock,
  searchSkillsFromKovaHubMock,
  installSkillFromKovaHubMock,
  updateSkillsFromKovaHubMock,
  readTrackedKovaHubSkillSlugsMock,
  buildWorkspaceSkillStatusMock,
  skillStatusReportFixture,
  defaultRuntime,
  runtimeLogs,
  runtimeStdout,
  runtimeErrors,
} = mocks;

vi.mock("../runtime.js", () => ({
  defaultRuntime: mocks.defaultRuntime,
}));

vi.mock("../utils.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils.js")>()),
  CONFIG_DIR: "/tmp/kova-config",
}));

vi.mock("../config/config.js", () => ({
  getRuntimeConfig: () => mocks.loadConfigMock(),
  loadConfig: () => mocks.loadConfigMock(),
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveAgentIdByWorkspacePath: (...args: unknown[]) =>
    mocks.resolveAgentIdByWorkspacePathMock(...args),
  resolveDefaultAgentId: () => mocks.resolveDefaultAgentIdMock(),
  resolveAgentWorkspaceDir: (...args: unknown[]) => mocks.resolveAgentWorkspaceDirMock(...args),
}));

vi.mock("../agents/skills-kovahub.js", () => ({
  searchSkillsFromKovaHub: (...args: unknown[]) => mocks.searchSkillsFromKovaHubMock(...args),
  installSkillFromKovaHub: (...args: unknown[]) => mocks.installSkillFromKovaHubMock(...args),
  updateSkillsFromKovaHub: (...args: unknown[]) => mocks.updateSkillsFromKovaHubMock(...args),
  readTrackedKovaHubSkillSlugs: (...args: unknown[]) =>
    mocks.readTrackedKovaHubSkillSlugsMock(...args),
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
    runtimeLogs.length = 0;
    runtimeStdout.length = 0;
    runtimeErrors.length = 0;
    loadConfigMock.mockReset();
    resolveAgentIdByWorkspacePathMock.mockReset();
    resolveDefaultAgentIdMock.mockReset();
    resolveAgentWorkspaceDirMock.mockReset();
    searchSkillsFromKovaHubMock.mockReset();
    installSkillFromKovaHubMock.mockReset();
    updateSkillsFromKovaHubMock.mockReset();
    readTrackedKovaHubSkillSlugsMock.mockReset();
    buildWorkspaceSkillStatusMock.mockReset();

    loadConfigMock.mockReturnValue({});
    resolveAgentIdByWorkspacePathMock.mockReturnValue(undefined);
    resolveDefaultAgentIdMock.mockReturnValue("main");
    resolveAgentWorkspaceDirMock.mockReturnValue("/tmp/workspace");
    searchSkillsFromKovaHubMock.mockResolvedValue([]);
    installSkillFromKovaHubMock.mockResolvedValue({
      ok: false,
      error: "install disabled in test",
    });
    updateSkillsFromKovaHubMock.mockResolvedValue([]);
    readTrackedKovaHubSkillSlugsMock.mockResolvedValue([]);
    buildWorkspaceSkillStatusMock.mockReturnValue(skillStatusReportFixture);
    defaultRuntime.log.mockClear();
    defaultRuntime.error.mockClear();
    defaultRuntime.writeStdout.mockClear();
    defaultRuntime.writeJson.mockClear();
    defaultRuntime.exit.mockClear();
  });

  it("searches KovaHub skills from the native CLI", async () => {
    searchSkillsFromKovaHubMock.mockResolvedValue([
      {
        slug: "calendar",
        displayName: "Calendar",
        summary: "CalDAV helpers",
        version: "1.2.3",
      },
    ]);

    await runCommand(["skills", "search", "calendar"]);

    expect(searchSkillsFromKovaHubMock).toHaveBeenCalledWith({
      query: "calendar",
      limit: undefined,
    });
    expect(runtimeLogs.some((line) => line.includes("calendar v1.2.3  Calendar"))).toBe(true);
  });

  it("installs a skill from KovaHub into the active workspace", async () => {
    installSkillFromKovaHubMock.mockResolvedValue({
      ok: true,
      slug: "calendar",
      version: "1.2.3",
      targetDir: "/tmp/workspace/skills/calendar",
    });

    await runCommand(["skills", "install", "calendar", "--version", "1.2.3"]);

    expect(installSkillFromKovaHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      slug: "calendar",
      version: "1.2.3",
      force: false,
      logger: expect.any(Object),
    });
    expect(
      runtimeLogs.some((line) =>
        line.includes("Installed calendar@1.2.3 -> /tmp/workspace/skills/calendar"),
      ),
    ).toBe(true);
  });

  it("installs a skill into the shared global skills directory", async () => {
    installSkillFromKovaHubMock.mockResolvedValue({
      ok: true,
      slug: "calendar",
      version: "1.2.3",
      targetDir: "/tmp/kova-config/skills/calendar",
    });

    await runCommand(["skills", "install", "calendar", "--global"]);

    expect(resolveAgentIdByWorkspacePathMock).not.toHaveBeenCalled();
    expect(resolveDefaultAgentIdMock).not.toHaveBeenCalled();
    expect(resolveAgentWorkspaceDirMock).not.toHaveBeenCalled();
    expect(installSkillFromKovaHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/kova-config",
      slug: "calendar",
      version: undefined,
      force: false,
      logger: expect.any(Object),
    });
  });

  it("rejects using --global and --agent together for installs", async () => {
    await expect(
      runCommand(["skills", "install", "calendar", "--global", "--agent", "main"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors).toContain("Use either --global or --agent, not both.");
    expect(installSkillFromKovaHubMock).not.toHaveBeenCalled();
  });

  it("rejects using parent --agent with install --global", async () => {
    await expect(
      runCommand(["skills", "--agent", "writer", "install", "calendar", "--global"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors).toContain("Use either --global or --agent, not both.");
    expect(installSkillFromKovaHubMock).not.toHaveBeenCalled();
  });

  it("updates all tracked KovaHub skills", async () => {
    readTrackedKovaHubSkillSlugsMock.mockResolvedValue(["calendar"]);
    updateSkillsFromKovaHubMock.mockResolvedValue([
      {
        ok: true,
        slug: "calendar",
        previousVersion: "1.2.2",
        version: "1.2.3",
        changed: true,
        targetDir: "/tmp/workspace/skills/calendar",
      },
    ]);

    await runCommand(["skills", "update", "--all"]);

    expect(readTrackedKovaHubSkillSlugsMock).toHaveBeenCalledWith("/tmp/workspace");
    expect(updateSkillsFromKovaHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      slug: undefined,
      logger: expect.any(Object),
    });
    expect(runtimeLogs.some((line) => line.includes("Updated calendar: 1.2.2 -> 1.2.3"))).toBe(
      true,
    );
    expect(runtimeErrors).toEqual([]);
  });

  it("updates tracked KovaHub skills in the shared global skills directory", async () => {
    readTrackedKovaHubSkillSlugsMock.mockResolvedValue(["calendar"]);
    updateSkillsFromKovaHubMock.mockResolvedValue([
      {
        ok: true,
        slug: "calendar",
        previousVersion: "1.2.2",
        version: "1.2.3",
        changed: true,
        targetDir: "/tmp/kova-config/skills/calendar",
      },
    ]);

    await runCommand(["skills", "update", "--all", "--global"]);

    expect(resolveAgentIdByWorkspacePathMock).not.toHaveBeenCalled();
    expect(resolveDefaultAgentIdMock).not.toHaveBeenCalled();
    expect(resolveAgentWorkspaceDirMock).not.toHaveBeenCalled();
    expect(readTrackedKovaHubSkillSlugsMock).toHaveBeenCalledWith("/tmp/kova-config");
    expect(updateSkillsFromKovaHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/kova-config",
      slug: undefined,
      logger: expect.any(Object),
    });
  });

  it("updates a single tracked KovaHub skill in the shared global skills directory", async () => {
    readTrackedKovaHubSkillSlugsMock.mockResolvedValue(["calendar"]);
    updateSkillsFromKovaHubMock.mockResolvedValue([
      {
        ok: true,
        slug: "calendar",
        previousVersion: "1.2.2",
        version: "1.2.3",
        changed: true,
        targetDir: "/tmp/kova-config/skills/calendar",
      },
    ]);

    await runCommand(["skills", "update", "calendar", "--global"]);

    expect(resolveAgentIdByWorkspacePathMock).not.toHaveBeenCalled();
    expect(resolveDefaultAgentIdMock).not.toHaveBeenCalled();
    expect(resolveAgentWorkspaceDirMock).not.toHaveBeenCalled();
    expect(readTrackedKovaHubSkillSlugsMock).toHaveBeenCalledWith("/tmp/kova-config");
    expect(updateSkillsFromKovaHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/kova-config",
      slug: "calendar",
      logger: expect.any(Object),
    });
  });

  it("rejects using --global and --agent together for updates", async () => {
    await expect(
      runCommand(["skills", "update", "--all", "--global", "--agent", "main"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors).toContain("Use either --global or --agent, not both.");
    expect(readTrackedKovaHubSkillSlugsMock).not.toHaveBeenCalled();
    expect(updateSkillsFromKovaHubMock).not.toHaveBeenCalled();
  });

  it("rejects using parent --agent with update --global", async () => {
    await expect(
      runCommand(["skills", "--agent", "writer", "update", "--all", "--global"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors).toContain("Use either --global or --agent, not both.");
    expect(readTrackedKovaHubSkillSlugsMock).not.toHaveBeenCalled();
    expect(updateSkillsFromKovaHubMock).not.toHaveBeenCalled();
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
    expect(runtimeStdout.at(-1)).toContain("kova skills search");
  });
});
