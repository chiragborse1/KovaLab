import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchKovaHubSkillDetailMock = vi.fn();
const downloadKovaHubSkillArchiveMock = vi.fn();
const listKovaHubSkillsMock = vi.fn();
const resolveKovaHubBaseUrlMock = vi.fn(() => "https://kovahub.ai");
const searchKovaHubSkillsMock = vi.fn();
const archiveCleanupMock = vi.fn();
const withExtractedArchiveRootMock = vi.fn();
const installPackageDirMock = vi.fn();
const fileExistsMock = vi.fn();

vi.mock("../infra/kovahub.js", () => ({
  fetchKovaHubSkillDetail: fetchKovaHubSkillDetailMock,
  downloadKovaHubSkillArchive: downloadKovaHubSkillArchiveMock,
  listKovaHubSkills: listKovaHubSkillsMock,
  resolveKovaHubBaseUrl: resolveKovaHubBaseUrlMock,
  searchKovaHubSkills: searchKovaHubSkillsMock,
}));

vi.mock("../infra/install-flow.js", () => ({
  withExtractedArchiveRoot: withExtractedArchiveRootMock,
}));

vi.mock("../infra/install-package-dir.js", () => ({
  installPackageDir: installPackageDirMock,
}));

vi.mock("../infra/archive.js", () => ({
  fileExists: fileExistsMock,
}));

const {
  installSkillFromKovaHub,
  searchSkillsFromKovaHub,
  uninstallSkillFromKovaHub,
  updateSkillsFromKovaHub,
} = await import("./skills-kovahub.js");

describe("skills-kovahub", () => {
  beforeEach(() => {
    fetchKovaHubSkillDetailMock.mockReset();
    downloadKovaHubSkillArchiveMock.mockReset();
    listKovaHubSkillsMock.mockReset();
    resolveKovaHubBaseUrlMock.mockReset();
    searchKovaHubSkillsMock.mockReset();
    archiveCleanupMock.mockReset();
    withExtractedArchiveRootMock.mockReset();
    installPackageDirMock.mockReset();
    fileExistsMock.mockReset();

    resolveKovaHubBaseUrlMock.mockReturnValue("https://kovahub.ai");
    fileExistsMock.mockImplementation(async (input: string) => input.endsWith("SKILL.md"));
    fetchKovaHubSkillDetailMock.mockResolvedValue({
      skill: {
        slug: "agentreceipt",
        displayName: "AgentReceipt",
        createdAt: 1,
        updatedAt: 2,
      },
      latestVersion: {
        version: "1.0.0",
        createdAt: 3,
      },
    });
    downloadKovaHubSkillArchiveMock.mockResolvedValue({
      archivePath: "/tmp/agentreceipt.zip",
      integrity: "sha256-test",
      cleanup: archiveCleanupMock,
    });
    archiveCleanupMock.mockResolvedValue(undefined);
    searchKovaHubSkillsMock.mockResolvedValue([]);
    withExtractedArchiveRootMock.mockImplementation(async (params) => {
      expect(params.rootMarkers).toEqual(["SKILL.md"]);
      return await params.onExtracted("/tmp/extracted-skill");
    });
    installPackageDirMock.mockResolvedValue({
      ok: true,
      targetDir: "/tmp/workspace/skills/agentreceipt",
    });
  });

  it("installs KovaHub skills from flat-root archives", async () => {
    const result = await installSkillFromKovaHub({
      workspaceDir: "/tmp/workspace",
      slug: "agentreceipt",
    });

    expect(downloadKovaHubSkillArchiveMock).toHaveBeenCalledWith({
      slug: "agentreceipt",
      version: "1.0.0",
      baseUrl: undefined,
    });
    expect(installPackageDirMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDir: "/tmp/extracted-skill",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      slug: "agentreceipt",
      version: "1.0.0",
      targetDir: "/tmp/workspace/skills/agentreceipt",
    });
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("uninstalls tracked KovaHub skills and updates the lockfile", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-skills-kovahub-"));
    const skillDir = path.join(workspaceDir, "skills", "github");
    await fs.mkdir(path.join(skillDir, ".kovahub"), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, ".kovahub"), { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# GitHub\n", "utf8");
    await fs.writeFile(
      path.join(skillDir, ".kovahub", "origin.json"),
      `${JSON.stringify(
        {
          version: 1,
          registry: "https://kovahub.ai",
          slug: "github",
          installedVersion: "1.0.0",
          installedAt: 123,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await fs.writeFile(
      path.join(workspaceDir, ".kovahub", "lock.json"),
      `${JSON.stringify(
        {
          version: 1,
          skills: {
            github: {
              version: "1.0.0",
              installedAt: 123,
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    fileExistsMock.mockImplementation(async (input: string) => input === skillDir);

    try {
      const result = await uninstallSkillFromKovaHub({
        workspaceDir,
        slug: "github",
      });

      expect(result).toMatchObject({
        ok: true,
        slug: "github",
        targetDir: skillDir,
        removed: true,
      });
      await expect(fs.stat(skillDir)).rejects.toThrow();
      const lock = JSON.parse(
        await fs.readFile(path.join(workspaceDir, ".kovahub", "lock.json"), "utf8"),
      );
      expect(lock.skills).toEqual({});
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  describe("legacy tracked slugs remain updatable", () => {
    async function createLegacyTrackedSkillFixture(slug: string) {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-skills-kovahub-"));
      const skillDir = path.join(workspaceDir, "skills", slug);
      await fs.mkdir(path.join(skillDir, ".kovahub"), { recursive: true });
      await fs.mkdir(path.join(workspaceDir, ".kovahub"), { recursive: true });
      await fs.writeFile(
        path.join(skillDir, ".kovahub", "origin.json"),
        `${JSON.stringify(
          {
            version: 1,
            registry: "https://legacy.kovahub.ai",
            slug,
            installedVersion: "0.9.0",
            installedAt: 123,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await fs.writeFile(
        path.join(workspaceDir, ".kovahub", "lock.json"),
        `${JSON.stringify(
          {
            version: 1,
            skills: {
              [slug]: {
                version: "0.9.0",
                installedAt: 123,
              },
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      return { workspaceDir, skillDir };
    }

    function expectLegacyUpdateSuccess(results: unknown, workspaceDir: string, slug: string) {
      expect(results).toMatchObject([
        {
          ok: true,
          slug,
          previousVersion: "0.9.0",
          version: "1.0.0",
          targetDir: path.join(workspaceDir, "skills", slug),
        },
      ]);
    }

    it("updates all tracked legacy Unicode slugs in place", async () => {
      const slug = "re\u0430ct";
      const { workspaceDir } = await createLegacyTrackedSkillFixture(slug);
      installPackageDirMock.mockResolvedValueOnce({
        ok: true,
        targetDir: path.join(workspaceDir, "skills", slug),
      });

      try {
        const results = await updateSkillsFromKovaHub({
          workspaceDir,
        });

        expect(fetchKovaHubSkillDetailMock).toHaveBeenCalledWith({
          slug,
          baseUrl: "https://legacy.kovahub.ai",
        });
        expect(downloadKovaHubSkillArchiveMock).toHaveBeenCalledWith({
          slug,
          version: "1.0.0",
          baseUrl: "https://legacy.kovahub.ai",
        });
        expectLegacyUpdateSuccess(results, workspaceDir, slug);
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("updates a legacy Unicode slug when requested explicitly", async () => {
      const slug = "re\u0430ct";
      const { workspaceDir } = await createLegacyTrackedSkillFixture(slug);
      installPackageDirMock.mockResolvedValueOnce({
        ok: true,
        targetDir: path.join(workspaceDir, "skills", slug),
      });

      try {
        const results = await updateSkillsFromKovaHub({
          workspaceDir,
          slug,
        });

        expectLegacyUpdateSuccess(results, workspaceDir, slug);
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });

    it("still rejects an untracked Unicode slug passed to update", async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-skills-kovahub-"));

      try {
        await expect(
          updateSkillsFromKovaHub({
            workspaceDir,
            slug: "re\u0430ct",
          }),
        ).rejects.toThrow("Invalid skill slug");
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
    });
  });

  describe("normalizeSlug rejects non-ASCII homograph slugs", () => {
    it("rejects Cyrillic homograph 'а' (U+0430) in slug", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "re\u0430ct",
      });
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("Invalid skill slug"),
      });
    });

    it("rejects Cyrillic homograph 'е' (U+0435) in slug", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "r\u0435act",
      });
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("Invalid skill slug"),
      });
    });

    it("rejects Cyrillic homograph 'о' (U+043E) in slug", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "t\u043Edo",
      });
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("Invalid skill slug"),
      });
    });

    it("rejects slug with mixed Unicode and ASCII", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "cаlеndаr",
      });
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("Invalid skill slug"),
      });
    });

    it("rejects slug with non-Latin scripts", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "技能",
      });
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("Invalid skill slug"),
      });
    });

    it("rejects Unicode that case-folds to ASCII (Kelvin sign U+212A)", async () => {
      // "\u212A" (Kelvin sign) lowercases to "k" — must be caught before lowercasing
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "\u212Aalendar",
      });
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("Invalid skill slug"),
      });
    });

    it("rejects slug starting with a hyphen", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "-calendar",
      });
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("Invalid skill slug"),
      });
    });

    it("rejects slug ending with a hyphen", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "calendar-",
      });
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("Invalid skill slug"),
      });
    });

    it("accepts uppercase ASCII slugs (preserves original casing behavior)", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "React",
      });
      expect(result).toMatchObject({ ok: true });
    });

    it("accepts valid lowercase ASCII slugs", async () => {
      const result = await installSkillFromKovaHub({
        workspaceDir: "/tmp/workspace",
        slug: "calendar-2",
      });
      expect(result).toMatchObject({ ok: true });
    });
  });

  it("uses search for browse-all skill discovery", async () => {
    searchKovaHubSkillsMock.mockResolvedValueOnce([
      {
        score: 1,
        slug: "calendar",
        displayName: "Calendar",
        summary: "Calendar skill",
        version: "1.2.3",
        updatedAt: 123,
      },
    ]);

    await expect(searchSkillsFromKovaHub({ limit: 20 })).resolves.toEqual([
      {
        score: 1,
        slug: "calendar",
        displayName: "Calendar",
        summary: "Calendar skill",
        version: "1.2.3",
        updatedAt: 123,
      },
    ]);
    expect(searchKovaHubSkillsMock).toHaveBeenCalledWith({
      query: "*",
      limit: 20,
      baseUrl: undefined,
    });
    expect(listKovaHubSkillsMock).not.toHaveBeenCalled();
  });
});
