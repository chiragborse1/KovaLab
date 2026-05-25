import { beforeEach, describe, expect, it, vi } from "vitest";

const loadConfigMock = vi.fn(() => ({}));
const resolveDefaultAgentIdMock = vi.fn(() => "main");
const resolveAgentWorkspaceDirMock = vi.fn(() => "/tmp/workspace");
const installSkillMock = vi.fn();

vi.mock("../../config/config.js", () => ({
  getRuntimeConfig: () => loadConfigMock(),
  writeConfigFile: vi.fn(),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  listAgentIds: vi.fn(() => ["main"]),
  resolveDefaultAgentId: () => resolveDefaultAgentIdMock(),
  resolveAgentWorkspaceDir: () => resolveAgentWorkspaceDirMock(),
}));

vi.mock("../../agents/skills-install.js", () => ({
  installSkill: (...args: unknown[]) => installSkillMock(...args),
}));

const { skillsHandlers } = await import("./skills.js");

const makeContext = () => ({ getRuntimeConfig: () => ({}) });

describe("skills gateway handlers (kovahub)", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    resolveDefaultAgentIdMock.mockReset();
    resolveAgentWorkspaceDirMock.mockReset();
    installSkillMock.mockReset();

    loadConfigMock.mockReturnValue({});
    resolveDefaultAgentIdMock.mockReturnValue("main");
    resolveAgentWorkspaceDirMock.mockReturnValue("/tmp/workspace");
  });

  it("rejects KovaHub skill installs because the registry is disabled", async () => {
    let ok: boolean | null = null;
    let response: unknown;
    let error: unknown;
    await skillsHandlers["skills.install"]({
      params: {
        source: "kovahub",
        slug: "calendar",
        version: "1.2.3",
      },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: makeContext() as never,
      respond: (success, result, err) => {
        ok = success;
        response = result;
        error = err;
      },
    });

    expect(ok).toBe(false);
    expect(response).toBeUndefined();
    expect(error).toMatchObject({
      code: "UNAVAILABLE",
      message: expect.stringContaining("registry integration is not available"),
    });
  });

  it("forwards dangerous override for local skill installs", async () => {
    installSkillMock.mockResolvedValue({
      ok: true,
      message: "Installed",
      stdout: "",
      stderr: "",
      code: 0,
    });

    let ok: boolean | null = null;
    let response: unknown;
    let error: unknown;
    await skillsHandlers["skills.install"]({
      params: {
        name: "calendar",
        installId: "deps",
        dangerouslyForceUnsafeInstall: true,
        timeoutMs: 120_000,
      },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: makeContext() as never,
      respond: (success, result, err) => {
        ok = success;
        response = result;
        error = err;
      },
    });

    expect(installSkillMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      skillName: "calendar",
      installId: "deps",
      dangerouslyForceUnsafeInstall: true,
      timeoutMs: 120_000,
      config: {},
    });
    expect(ok).toBe(true);
    expect(error).toBeUndefined();
    expect(response).toMatchObject({
      ok: true,
      message: "Installed",
    });
  });

  it("rejects KovaHub skill updates because the registry is disabled", async () => {
    let ok: boolean | null = null;
    let response: unknown;
    let error: unknown;
    await skillsHandlers["skills.update"]({
      params: {
        source: "kovahub",
        slug: "calendar",
      },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: makeContext() as never,
      respond: (success, result, err) => {
        ok = success;
        response = result;
        error = err;
      },
    });

    expect(ok).toBe(false);
    expect(response).toBeUndefined();
    expect(error).toMatchObject({
      code: "UNAVAILABLE",
      message: expect.stringContaining("registry integration is not available"),
    });
  });

  it("rejects KovaHub skill uninstalls because the registry is disabled", async () => {
    let ok: boolean | null = null;
    let response: unknown;
    let error: unknown;
    await skillsHandlers["skills.uninstall"]({
      params: {
        source: "kovahub",
        slug: "calendar",
      },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: makeContext() as never,
      respond: (success, result, err) => {
        ok = success;
        response = result;
        error = err;
      },
    });

    expect(ok).toBe(false);
    expect(response).toBeUndefined();
    expect(error).toMatchObject({
      code: "UNAVAILABLE",
      message: expect.stringContaining("registry integration is not available"),
    });
  });

  it("returns unavailable before KovaHub update argument handling", async () => {
    let ok: boolean | null = null;
    let error: { code?: string; message?: string } | undefined;
    await skillsHandlers["skills.update"]({
      params: {
        source: "kovahub",
      },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: makeContext() as never,
      respond: (success, _result, err) => {
        ok = success;
        error = err as { code?: string; message?: string } | undefined;
      },
    });

    expect(ok).toBe(false);
    expect(error).toMatchObject({
      code: "UNAVAILABLE",
      message: expect.stringContaining("registry integration is not available"),
    });
  });
});
