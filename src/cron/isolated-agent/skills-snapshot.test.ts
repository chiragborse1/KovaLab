import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  canExecRequestNodeMock,
  getRemoteSkillEligibilityMock,
  resolveAgentSkillsFilterMock,
  resolveReusableWorkspaceSkillSnapshotMock,
} = vi.hoisted(() => ({
  canExecRequestNodeMock: vi.fn().mockReturnValue(false),
  getRemoteSkillEligibilityMock: vi.fn(),
  resolveAgentSkillsFilterMock: vi.fn(),
  resolveReusableWorkspaceSkillSnapshotMock: vi.fn(),
}));

vi.mock("./skills-snapshot.runtime.js", () => ({
  canExecRequestNode: canExecRequestNodeMock,
  getRemoteSkillEligibility: getRemoteSkillEligibilityMock,
  resolveAgentSkillsFilter: resolveAgentSkillsFilterMock,
  resolveReusableWorkspaceSkillSnapshot: resolveReusableWorkspaceSkillSnapshotMock,
}));

const { resolveCronSkillsSnapshot } = await import("./skills-snapshot.js");

describe("resolveCronSkillsSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAgentSkillsFilterMock.mockReturnValue(undefined);
    getRemoteSkillEligibilityMock.mockReturnValue({
      platforms: [],
      hasBin: () => false,
      hasAnyBin: () => false,
    });
    resolveReusableWorkspaceSkillSnapshotMock.mockReturnValue({
      snapshot: { prompt: "fresh", skills: [] },
      shouldRefresh: true,
      snapshotVersion: 0,
    });
  });

  it("delegates reusable snapshot resolution with the effective skill filter", async () => {
    resolveAgentSkillsFilterMock.mockReturnValue(["docs-search", "github"]);

    const result = await resolveCronSkillsSnapshot({
      workspaceDir: "/tmp/workspace",
      config: {} as never,
      agentId: "writer",
      existingSnapshot: {
        prompt: "old",
        skills: [{ name: "github" }],
        skillFilter: ["github"],
        version: 0,
      },
      isFastTestEnv: false,
    });

    expect(resolveReusableWorkspaceSkillSnapshotMock).toHaveBeenCalledOnce();
    expect(resolveReusableWorkspaceSkillSnapshotMock.mock.calls[0]?.[0]).toMatchObject({
      agentId: "writer",
      skillFilter: ["docs-search", "github"],
      watch: false,
      hydrateExisting: false,
    });
    expect(result).toEqual({ prompt: "fresh", skills: [] });
  });

  it("passes existing snapshots through to the reusable resolver", async () => {
    await resolveCronSkillsSnapshot({
      workspaceDir: "/tmp/workspace",
      config: {} as never,
      agentId: "writer",
      existingSnapshot: {
        prompt: "old",
        skills: [{ name: "github" }],
        version: 42,
      },
      isFastTestEnv: false,
    });

    expect(resolveReusableWorkspaceSkillSnapshotMock.mock.calls[0]?.[0]).toMatchObject({
      existingSnapshot: {
        prompt: "old",
        skills: [{ name: "github" }],
        version: 42,
      },
    });
  });
});
