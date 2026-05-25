import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTrackedTempDirs } from "../../test-utils/tracked-temp-dirs.js";
import { createCanonicalFixtureSkill } from "../skills.test-helpers.js";
import type { SkillEntry } from "../skills/types.js";
import {
  createSkillsListTool,
  createSkillViewTool,
  loadSkillViewPayload,
  renderSkillInvocationPrompt,
} from "./skills-tool.js";

const tempDirs = createTrackedTempDirs();

afterEach(async () => {
  await tempDirs.cleanup();
});

async function createWorkspaceSkill(params: {
  workspaceDir: string;
  name: string;
  description?: string;
  body?: string;
}): Promise<{ skillDir: string; entry: SkillEntry }> {
  const description = params.description ?? "Test skill";
  const skillDir = path.join(params.workspaceDir, "skills", params.name);
  const filePath = path.join(skillDir, "SKILL.md");
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    filePath,
    [
      "---",
      `name: ${params.name}`,
      `description: ${description}`,
      "---",
      params.body ?? "Use files under {baseDir}. Session ${KOVA_SESSION_ID}.",
      "",
    ].join("\n"),
    "utf8",
  );
  return {
    skillDir,
    entry: {
      skill: createCanonicalFixtureSkill({
        name: params.name,
        description,
        filePath,
        baseDir: skillDir,
        source: "kova-workspace",
      }),
      frontmatter: {},
    },
  };
}

async function makeEmptySkillDir(label: string) {
  const dir = await tempDirs.make(label);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe("skills tools", () => {
  it("uses stable core tool names", async () => {
    const workspaceDir = await tempDirs.make("kova-skills-tools-");
    expect(createSkillsListTool({ workspaceDir }).name).toBe("skills_list");
    expect(createSkillViewTool({ workspaceDir }).name).toBe("skill_view");
  });

  it("lists and views visible workspace skills", async () => {
    const workspaceDir = await tempDirs.make("kova-skills-tools-");
    const managedSkillsDir = await makeEmptySkillDir("kova-skills-managed-");
    const bundledSkillsDir = await makeEmptySkillDir("kova-skills-bundled-");
    const { entry } = await createWorkspaceSkill({
      workspaceDir,
      name: "daily-review",
      description: "Review daily notes",
    });

    const listResult = await createSkillsListTool({
      workspaceDir,
      entries: [entry],
      managedSkillsDir,
      bundledSkillsDir,
    }).execute("call", { query: "daily" });

    expect(listResult.details).toMatchObject({
      success: true,
      count: 1,
      skills: [
        {
          name: "daily-review",
          description: "Review daily notes",
          source: "kova-workspace",
        },
      ],
    });

    const viewResult = await createSkillViewTool({
      workspaceDir,
      entries: [entry],
      managedSkillsDir,
      bundledSkillsDir,
      sessionId: "agent:main:test",
    }).execute("call", { name: "daily_review" });

    expect(viewResult.details).toMatchObject({
      success: true,
      name: "daily-review",
      filePath: "SKILL.md",
      source: "kova-workspace",
    });
    expect(JSON.stringify(viewResult.details)).toContain("Session agent:main:test.");
  });

  it("surfaces support files without allowing path escape", async () => {
    const workspaceDir = await tempDirs.make("kova-skills-tools-");
    const managedSkillsDir = await makeEmptySkillDir("kova-skills-managed-");
    const bundledSkillsDir = await makeEmptySkillDir("kova-skills-bundled-");
    const { skillDir, entry } = await createWorkspaceSkill({
      workspaceDir,
      name: "runbook",
      body: "Load references/steps.md before acting.",
    });
    await fs.mkdir(path.join(skillDir, "references"), { recursive: true });
    await fs.writeFile(path.join(skillDir, "references", "steps.md"), "Step 1", "utf8");

    const payload = loadSkillViewPayload({
      workspaceDir,
      entries: [entry],
      managedSkillsDir,
      bundledSkillsDir,
      name: "runbook",
    });

    expect(payload.linkedFiles.references).toEqual(["references/steps.md"]);
    expect(
      loadSkillViewPayload({
        workspaceDir,
        entries: [entry],
        managedSkillsDir,
        bundledSkillsDir,
        name: "runbook",
        filePath: "references/steps.md",
      }).content,
    ).toBe("Step 1");

    expect(() =>
      loadSkillViewPayload({
        workspaceDir,
        entries: [entry],
        managedSkillsDir,
        bundledSkillsDir,
        name: "runbook",
        filePath: "../outside.md",
      }),
    ).toThrow("filePath must stay inside the skill directory");
  });

  it("rejects support files that resolve outside through symlinks", async () => {
    if (process.platform === "win32") {
      return;
    }
    const workspaceDir = await tempDirs.make("kova-skills-tools-");
    const managedSkillsDir = await makeEmptySkillDir("kova-skills-managed-");
    const bundledSkillsDir = await makeEmptySkillDir("kova-skills-bundled-");
    const outsideDir = await tempDirs.make("kova-skill-outside-");
    const { skillDir, entry } = await createWorkspaceSkill({
      workspaceDir,
      name: "safe-runbook",
    });
    await fs.mkdir(path.join(skillDir, "references"), { recursive: true });
    await fs.writeFile(path.join(outsideDir, "secret.md"), "nope", "utf8");
    await fs.symlink(
      path.join(outsideDir, "secret.md"),
      path.join(skillDir, "references", "secret.md"),
    );

    expect(() =>
      loadSkillViewPayload({
        workspaceDir,
        entries: [entry],
        managedSkillsDir,
        bundledSkillsDir,
        name: "safe-runbook",
        filePath: "references/secret.md",
      }),
    ).toThrow("skill file could not be read safely");
  });

  it("renders slash-command skill preload prompts with instructions and user input", async () => {
    const workspaceDir = await tempDirs.make("kova-skills-tools-");
    const managedSkillsDir = await makeEmptySkillDir("kova-skills-managed-");
    const bundledSkillsDir = await makeEmptySkillDir("kova-skills-bundled-");
    const { entry } = await createWorkspaceSkill({
      workspaceDir,
      name: "planner",
      body: "Plan with checkpoints.",
    });

    const prompt = renderSkillInvocationPrompt({
      payload: loadSkillViewPayload({
        workspaceDir,
        entries: [entry],
        managedSkillsDir,
        bundledSkillsDir,
        name: "planner",
      }),
      userInput: "ship the release",
    });

    expect(prompt).toContain('Kova loaded the "planner" skill');
    expect(prompt).toContain("Plan with checkpoints.");
    expect(prompt).toContain("User input:\nship the release");
  });
});
