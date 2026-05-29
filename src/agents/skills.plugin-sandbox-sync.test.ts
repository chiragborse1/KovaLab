import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { writeSkill } from "./skills.e2e-test-helpers.js";
import { buildWorkspaceSkillsPrompt, syncSkillsToWorkspace } from "./skills/workspace.js";

const mockResolvePluginSkillDirs = vi.hoisted(() => vi.fn(() => [] as string[]));

vi.mock("./skills/plugin-skills.js", () => ({
  resolvePluginSkillDirs: mockResolvePluginSkillDirs,
}));

let fixtureRoot = "";
let fixtureCount = 0;

async function createCaseDir(prefix: string): Promise<string> {
  const dir = path.join(fixtureRoot, `${prefix}-${fixtureCount++}`);
  await fsPromises.mkdir(dir, { recursive: true });
  return dir;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  fixtureRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), "kova-plugin-skills-sync-"));
});

afterAll(async () => {
  await fsPromises.rm(fixtureRoot, { recursive: true, force: true });
});

describe("syncSkillsToWorkspace for plugin skills", () => {
  it("syncs generated plugin skill symlinks as real sandbox workspace directories", async () => {
    const sourceWorkspace = await createCaseDir("source");
    const targetWorkspace = await createCaseDir("target");

    const realPluginSkillDir = await createCaseDir("real-plugin-skill");
    await writeSkill({
      dir: realPluginSkillDir,
      name: "wiki-maintainer",
      description: "Wiki maintenance skill for sandboxed agents",
    });

    const pluginSkillsDir = path.join(sourceWorkspace, ".kova", "plugin-skills");
    await fsPromises.mkdir(pluginSkillsDir, { recursive: true });
    const symlinkPath = path.join(pluginSkillsDir, "wiki-maintainer");
    fs.symlinkSync(
      realPluginSkillDir,
      symlinkPath,
      process.platform === "win32" ? "junction" : "dir",
    );

    mockResolvePluginSkillDirs.mockReturnValueOnce([realPluginSkillDir]);

    await syncSkillsToWorkspace({
      sourceWorkspaceDir: sourceWorkspace,
      targetWorkspaceDir: targetWorkspace,
      pluginSkillsDir,
      bundledSkillsDir: path.join(sourceWorkspace, ".bundled"),
      managedSkillsDir: path.join(sourceWorkspace, ".managed"),
    });

    const syncedSkillDir = path.join(targetWorkspace, "skills", "wiki-maintainer");
    const syncedSkillMd = path.join(syncedSkillDir, "SKILL.md");
    const syncedStat = await fsPromises.lstat(syncedSkillDir);
    const prompt = buildWorkspaceSkillsPrompt(targetWorkspace, {
      bundledSkillsDir: path.join(targetWorkspace, ".bundled"),
      managedSkillsDir: path.join(targetWorkspace, ".managed"),
      pluginSkillsDir: path.join(targetWorkspace, ".kova", "plugin-skills"),
    }).replaceAll("\\", "/");

    expect(await pathExists(syncedSkillMd)).toBe(true);
    expect(syncedStat.isSymbolicLink()).toBe(false);
    expect(prompt).toContain("Wiki maintenance skill for sandboxed agents");
    expect(prompt).toContain("skills/wiki-maintainer/SKILL.md");
    expect(prompt).not.toContain(realPluginSkillDir.replaceAll("\\", "/"));
    expect(prompt).not.toContain(pluginSkillsDir.replaceAll("\\", "/"));
    expect(prompt).not.toContain(symlinkPath.replaceAll("\\", "/"));
  });

  it("does not sync generated plugin skill symlinks outside allowed plugin roots", async () => {
    const sourceWorkspace = await createCaseDir("source-escape");
    const targetWorkspace = await createCaseDir("target-escape");

    const outsideRoot = await createCaseDir("outside-root");
    const escapedSkillDir = path.join(outsideRoot, "escaped-skill");
    await writeSkill({
      dir: escapedSkillDir,
      name: "escaped-skill",
      description: "Should not be synced",
    });

    const pluginSkillsDir = path.join(sourceWorkspace, ".kova", "plugin-skills");
    await fsPromises.mkdir(pluginSkillsDir, { recursive: true });
    fs.symlinkSync(
      escapedSkillDir,
      path.join(pluginSkillsDir, "escaped-skill"),
      process.platform === "win32" ? "junction" : "dir",
    );

    const allowedRoot = await createCaseDir("allowed-root");
    mockResolvePluginSkillDirs.mockReturnValueOnce([allowedRoot]);

    await syncSkillsToWorkspace({
      sourceWorkspaceDir: sourceWorkspace,
      targetWorkspaceDir: targetWorkspace,
      pluginSkillsDir,
      bundledSkillsDir: path.join(sourceWorkspace, ".bundled"),
      managedSkillsDir: path.join(sourceWorkspace, ".managed"),
    });

    expect(
      await pathExists(path.join(targetWorkspace, "skills", "escaped-skill", "SKILL.md")),
    ).toBe(false);
  });
});
