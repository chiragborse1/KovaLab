import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSkillCurator, restoreArchivedSkill } from "./curator.js";
import { SkillWorkshopStore } from "./store.js";
import type { SkillProposal } from "./types.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-skill-curator-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function createProposal(workspaceDir: string): SkillProposal {
  const now = Date.now();
  return {
    id: "proposal-background",
    createdAt: now,
    updatedAt: now,
    workspaceDir,
    skillName: "agent-fix-workflow",
    title: "Agent Fix Workflow",
    reason: "Reusable fix",
    source: "reviewer",
    status: "applied",
    change: {
      kind: "create",
      description: "Reusable fix workflow.",
      body: "## Workflow\n\n- Reproduce the failure.\n- Add a focused regression test.",
    },
  };
}

async function ageTrackedSkill(params: {
  store: SkillWorkshopStore;
  skillName: string;
  timestamp: number;
}) {
  const raw = JSON.parse(await fs.readFile(params.store.filePath, "utf8")) as {
    usage: Record<string, Record<string, unknown>>;
  };
  raw.usage[params.skillName] = {
    ...raw.usage[params.skillName],
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
    lastAppliedAt: params.timestamp,
  };
  await fs.writeFile(params.store.filePath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

describe("skill curator", () => {
  it("previews, archives, reports, and restores stale background skills", async () => {
    const workspaceDir = await makeTempDir();
    const stateDir = await makeTempDir();
    const skillDir = path.join(workspaceDir, "skills", "agent-fix-workflow");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: agent-fix-workflow\ndescription: Reusable fix workflow.\n---\n\n## Workflow\n\n- Reproduce the failure.\n",
    );

    const store = new SkillWorkshopStore({ stateDir, workspaceDir });
    await store.recordAppliedProposal(createProposal(workspaceDir));
    const now = Date.now();
    await ageTrackedSkill({
      store,
      skillName: "agent-fix-workflow",
      timestamp: now - 100 * 24 * 60 * 60 * 1000,
    });

    const config = {
      enabled: true,
      intervalTurns: 1,
      minSkillAgeDays: 7,
      staleDays: 30,
      archiveDays: 90,
      maxActions: 20,
    };
    const preview = await runSkillCurator({
      store,
      stateDir,
      workspaceDir,
      config,
      apply: false,
      now,
    });
    expect(preview.report.actions).toEqual([
      expect.objectContaining({ type: "archive", skillName: "agent-fix-workflow" }),
    ]);
    await expect(fs.access(path.join(skillDir, "SKILL.md"))).resolves.toBeUndefined();

    const applied = await runSkillCurator({
      store,
      stateDir,
      workspaceDir,
      config,
      apply: true,
      now,
    });
    expect(applied.reportPath).toMatch(/\.json$/);
    await expect(fs.access(applied.reportPath)).resolves.toBeUndefined();
    await expect(fs.access(path.join(skillDir, "SKILL.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect((await store.getUsage("agent-fix-workflow"))?.state).toBe("archived");

    const restoredPath = await restoreArchivedSkill({
      store,
      workspaceDir,
      skillName: "agent-fix-workflow",
    });
    expect(restoredPath).toBe(skillDir);
    await expect(fs.access(path.join(skillDir, "SKILL.md"))).resolves.toBeUndefined();
    expect((await store.getUsage("agent-fix-workflow"))?.state).toBe("active");
  });
});
