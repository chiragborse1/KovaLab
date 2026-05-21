import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import type { KovaConfig } from "getkova/plugin-sdk/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerSkillWorkshopCli } from "./cli.js";
import { SkillWorkshopStore } from "./store.js";
import type { SkillProposal } from "./types.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-skill-workshop-cli-test-"));
  tempDirs.push(dir);
  return dir;
}

function createProposal(
  workspaceDir: string,
  overrides: Partial<SkillProposal> = {},
): SkillProposal {
  const now = Date.now();
  return {
    id: "proposal-123456",
    createdAt: now,
    updatedAt: now,
    workspaceDir,
    skillName: "media-qa",
    title: "Media QA",
    reason: "Reusable media QA workflow",
    source: "tool",
    status: "pending",
    change: {
      kind: "create",
      description: "Reusable media QA workflow.",
      body: "## Workflow\n\n- Verify dimensions.\n- Run focused tests.",
    },
    ...overrides,
  };
}

async function runSkillWorkshopCli(params: {
  argv: string[];
  workspaceDir: string;
  stateDir: string;
  config?: KovaConfig;
}): Promise<{ stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const program = new Command();
  program.exitOverride();
  registerSkillWorkshopCli(program, {
    config: params.config ?? {},
    workspaceDir: params.workspaceDir,
    stateDir: params.stateDir,
    io: {
      writeStdout: (text) => stdout.push(text),
      writeStderr: (text) => stderr.push(text),
    },
  });
  await program.parseAsync(params.argv, { from: "user" });
  return { stdout: stdout.join(""), stderr: stderr.join("") };
}

beforeEach(() => {
  process.exitCode = undefined;
});

afterEach(async () => {
  process.exitCode = undefined;
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("skill-workshop cli", () => {
  it("reviews pending and quarantined proposals without changing files", async () => {
    const workspaceDir = await makeTempDir();
    const stateDir = await makeTempDir();
    const store = new SkillWorkshopStore({ stateDir, workspaceDir });
    await store.add(createProposal(workspaceDir), 50);
    await store.add(
      createProposal(workspaceDir, {
        id: "proposal-quarantine",
        skillName: "unsafe-skill",
        status: "quarantined",
        quarantineReason: "Unsafe instruction",
      }),
      50,
    );

    const result = await runSkillWorkshopCli({
      argv: ["skill-workshop", "review"],
      workspaceDir,
      stateDir,
    });

    expect(result.stdout).toContain("Skill Workshop Review");
    expect(result.stdout).toContain("proposal-123456");
    expect(result.stdout).toContain("proposal-quarantine");
    expect(result.stdout).toContain("No files changed");
    expect(result.stdout).toContain("Managed skills are not changed by this command");
    await expect(
      fs.access(path.join(workspaceDir, "skills", "media-qa", "SKILL.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires explicit confirmation before applying a proposal", async () => {
    const workspaceDir = await makeTempDir();
    const stateDir = await makeTempDir();
    const store = new SkillWorkshopStore({ stateDir, workspaceDir });
    await store.add(createProposal(workspaceDir), 50);

    const result = await runSkillWorkshopCli({
      argv: ["skill-workshop", "apply", "proposal-123456"],
      workspaceDir,
      stateDir,
    });

    expect(result.stderr).toContain("Review required before applying media-qa");
    expect(result.stderr).toContain("Re-run with --yes");
    expect(process.exitCode).toBe(1);
    await expect(
      fs.access(path.join(workspaceDir, "skills", "media-qa", "SKILL.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("applies a pending proposal only to the selected workspace skills directory", async () => {
    const workspaceDir = await makeTempDir();
    const stateDir = await makeTempDir();
    const store = new SkillWorkshopStore({ stateDir, workspaceDir });
    await store.add(createProposal(workspaceDir), 50);

    const result = await runSkillWorkshopCli({
      argv: ["skill-workshop", "apply", "proposal-123456", "--yes"],
      workspaceDir,
      stateDir,
    });

    const skillPath = path.join(workspaceDir, "skills", "media-qa", "SKILL.md");
    await expect(fs.readFile(skillPath, "utf8")).resolves.toContain("Run focused tests");
    await expect(
      fs.access(path.join(stateDir, "skills", "media-qa", "SKILL.md")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect((await store.get("proposal-123456"))?.status).toBe("applied");
    expect(result.stdout).toContain(`Applied media-qa -> ${skillPath}`);

    const usage = await runSkillWorkshopCli({
      argv: ["skill-workshop", "usage"],
      workspaceDir,
      stateDir,
    });
    expect(usage.stdout).toContain("media-qa");
    expect(usage.stdout).toContain("active");
    expect(usage.stdout).toContain("foreground");
  });

  it("refuses to apply quarantined proposals", async () => {
    const workspaceDir = await makeTempDir();
    const stateDir = await makeTempDir();
    const store = new SkillWorkshopStore({ stateDir, workspaceDir });
    await store.add(
      createProposal(workspaceDir, {
        status: "quarantined",
        quarantineReason: "Unsafe instruction",
      }),
      50,
    );

    const result = await runSkillWorkshopCli({
      argv: ["skill-workshop", "apply", "proposal-123456", "--yes"],
      workspaceDir,
      stateDir,
    });

    expect(result.stderr).toContain("Quarantined proposals cannot be applied");
    expect(process.exitCode).toBe(1);
    await expect(
      fs.access(path.join(workspaceDir, "skills", "media-qa", "SKILL.md")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("curates, pins, archives, and restores tracked skills from the terminal", async () => {
    const workspaceDir = await makeTempDir();
    const stateDir = await makeTempDir();
    const skillDir = path.join(workspaceDir, "skills", "media-qa");
    const store = new SkillWorkshopStore({ stateDir, workspaceDir });
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: media-qa\ndescription: Media QA workflow.\n---\n\n## Workflow\n\n- Verify dimensions.\n",
    );
    await store.recordAppliedProposal(
      createProposal(workspaceDir, {
        source: "reviewer",
        status: "applied",
      }),
    );

    const pin = await runSkillWorkshopCli({
      argv: ["skill-workshop", "pin", "media-qa"],
      workspaceDir,
      stateDir,
    });
    expect(pin.stdout).toContain("Pinned media-qa");

    const usage = await runSkillWorkshopCli({
      argv: ["skill-workshop", "usage"],
      workspaceDir,
      stateDir,
    });
    expect(usage.stdout).toContain("pinned");

    const preview = await runSkillWorkshopCli({
      argv: ["skill-workshop", "curate", "--workspace", workspaceDir, "--json"],
      workspaceDir,
      stateDir,
      config: {
        plugins: {
          entries: {
            "skill-workshop": {
              enabled: true,
              config: {
                curatorIntervalTurns: 1,
                curatorMinSkillAgeDays: 0,
                curatorStaleDays: 1,
                curatorArchiveDays: 1,
              },
            },
          },
        },
      },
    });
    expect(JSON.parse(preview.stdout)).toMatchObject({
      report: {
        checked: 1,
        skipped: [expect.objectContaining({ skillName: "media-qa", reason: "pinned" })],
      },
    });

    await runSkillWorkshopCli({
      argv: ["skill-workshop", "unpin", "media-qa"],
      workspaceDir,
      stateDir,
    });
    const archive = await runSkillWorkshopCli({
      argv: ["skill-workshop", "archive", "media-qa", "--yes"],
      workspaceDir,
      stateDir,
    });
    expect(archive.stdout).toContain("Archived media-qa");
    await expect(fs.access(path.join(skillDir, "SKILL.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    const restore = await runSkillWorkshopCli({
      argv: ["skill-workshop", "restore", "media-qa", "--yes"],
      workspaceDir,
      stateDir,
    });
    expect(restore.stdout).toContain("Restored media-qa");
    await expect(fs.access(path.join(skillDir, "SKILL.md"))).resolves.toBeUndefined();
    expect((await store.getUsage("media-qa"))?.state).toBe("active");
  });
});
