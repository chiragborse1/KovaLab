import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillSnapshot } from "../../agents/skills.js";

const emptySkillSnapshot = (): SkillSnapshot => ({ prompt: "", skills: [], resolvedSkills: [] });

const {
  buildWorkspaceSkillSnapshotMock,
  ensureSkillsWatcherMock,
  getSkillsSnapshotVersionMock,
  shouldRefreshSnapshotForVersionMock,
  getRemoteSkillEligibilityMock,
  resolveAgentConfigMock,
  resolveSessionAgentIdMock,
  resolveAgentIdFromSessionKeyMock,
} = vi.hoisted(() => ({
  buildWorkspaceSkillSnapshotMock: vi.fn(
    (): SkillSnapshot => ({
      prompt: "",
      skills: [],
      resolvedSkills: [],
    }),
  ),
  ensureSkillsWatcherMock: vi.fn(),
  getSkillsSnapshotVersionMock: vi.fn(() => 0),
  shouldRefreshSnapshotForVersionMock: vi.fn(() => false),
  getRemoteSkillEligibilityMock: vi.fn(() => ({
    platforms: [],
    hasBin: () => false,
    hasAnyBin: () => false,
  })),
  resolveAgentConfigMock: vi.fn(() => undefined),
  resolveSessionAgentIdMock: vi.fn(() => "writer"),
  resolveAgentIdFromSessionKeyMock: vi.fn(() => "main"),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveAgentConfig: resolveAgentConfigMock,
  resolveSessionAgentId: resolveSessionAgentIdMock,
}));

vi.mock("../../agents/skills.js", () => ({
  buildWorkspaceSkillSnapshot: buildWorkspaceSkillSnapshotMock,
}));

vi.mock("../../agents/skills/refresh.js", () => ({
  ensureSkillsWatcher: ensureSkillsWatcherMock,
}));

vi.mock("../../agents/skills/refresh-state.js", () => ({
  getSkillsSnapshotVersion: getSkillsSnapshotVersionMock,
  shouldRefreshSnapshotForVersion: shouldRefreshSnapshotForVersionMock,
}));

vi.mock("../../config/sessions.js", () => ({
  updateSessionStore: vi.fn(),
  resolveSessionFilePath: vi.fn(),
  resolveSessionFilePathOptions: vi.fn(),
}));

vi.mock("../../infra/skills-remote.js", () => ({
  getRemoteSkillEligibility: getRemoteSkillEligibilityMock,
}));

vi.mock("../../routing/session-key.js", () => ({
  normalizeAgentId: (id: string) => id,
  normalizeMainKey: (key?: string) => key ?? "main",
  resolveAgentIdFromSessionKey: resolveAgentIdFromSessionKeyMock,
}));

const { __testing_resetResolvedSkillsCache, ensureSkillSnapshot } =
  await import("./session-updates.js");

describe("ensureSkillSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildWorkspaceSkillSnapshotMock.mockReturnValue(emptySkillSnapshot());
    getSkillsSnapshotVersionMock.mockReturnValue(0);
    shouldRefreshSnapshotForVersionMock.mockReturnValue(false);
    getRemoteSkillEligibilityMock.mockReturnValue({
      platforms: [],
      hasBin: () => false,
      hasAnyBin: () => false,
    });
    resolveAgentConfigMock.mockReturnValue(undefined);
    resolveSessionAgentIdMock.mockReturnValue("writer");
    resolveAgentIdFromSessionKeyMock.mockReturnValue("main");
  });

  afterEach(() => {
    __testing_resetResolvedSkillsCache();
    vi.unstubAllEnvs();
  });

  it("uses config-aware session agent resolution for legacy session keys", async () => {
    vi.stubEnv("KOVA_TEST_FAST", "0");

    await ensureSkillSnapshot({
      sessionKey: "main",
      isFirstTurnInSession: false,
      workspaceDir: "/tmp/workspace",
      cfg: {
        agents: {
          list: [{ id: "writer", default: true }],
        },
      },
    });

    expect(resolveSessionAgentIdMock).toHaveBeenCalledWith({
      sessionKey: "main",
      config: {
        agents: {
          list: [{ id: "writer", default: true }],
        },
      },
    });
    expect(buildWorkspaceSkillSnapshotMock).toHaveBeenCalledWith(
      "/tmp/workspace",
      expect.objectContaining({ agentId: "writer" }),
    );
    expect(resolveAgentIdFromSessionKeyMock).not.toHaveBeenCalled();
  });

  it("hydrates stripped resolved skills from the warm-start cache", async () => {
    vi.stubEnv("KOVA_TEST_FAST", "0");
    const snapshot: SkillSnapshot = {
      prompt: "skill prompt",
      skills: [{ name: "demo" }],
      resolvedSkills: [
        {
          name: "demo",
          description: "Demo skill",
          filePath: "/tmp/demo/SKILL.md",
          baseDir: "/tmp/demo",
          source: "test",
          sourceInfo: {
            path: "/tmp/demo/SKILL.md",
            source: "test",
            scope: "temporary",
            origin: "top-level",
            baseDir: "/tmp/demo",
          },
          disableModelInvocation: false,
        },
      ],
      version: 1,
    };
    buildWorkspaceSkillSnapshotMock.mockReturnValue(snapshot);
    getSkillsSnapshotVersionMock.mockReturnValue(1);

    const first = await ensureSkillSnapshot({
      sessionKey: "main",
      isFirstTurnInSession: false,
      workspaceDir: "/tmp/workspace",
      cfg: { agents: { list: [{ id: "writer", default: true }] } },
    });
    expect(first.skillsSnapshot?.resolvedSkills).toEqual(snapshot.resolvedSkills);
    expect(buildWorkspaceSkillSnapshotMock).toHaveBeenCalledTimes(1);

    buildWorkspaceSkillSnapshotMock.mockClear();
    const strippedSnapshot = {
      prompt: "skill prompt",
      skills: [{ name: "demo" }],
      version: 1,
    };

    const second = await ensureSkillSnapshot({
      sessionEntry: { sessionId: "s1", updatedAt: 1, skillsSnapshot: strippedSnapshot },
      sessionKey: "main",
      isFirstTurnInSession: false,
      workspaceDir: "/tmp/workspace",
      cfg: { agents: { list: [{ id: "writer", default: true }] } },
    });

    expect(buildWorkspaceSkillSnapshotMock).not.toHaveBeenCalled();
    expect(second.skillsSnapshot).toEqual({
      ...strippedSnapshot,
      resolvedSkills: snapshot.resolvedSkills,
    });
  });
});
