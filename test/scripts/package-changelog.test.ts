import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractCurrentPackageChangelog,
  preparePackageChangelog,
  resolvePackageChangelogVersions,
  restorePackageChangelog,
} from "../../scripts/package-changelog.mjs";

const roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "kova-package-changelog-"));
  roots.push(root);
  return root;
}

function writePackage(root: string, version: string): void {
  writeFileSync(path.join(root, "package.json"), `${JSON.stringify({ version })}\n`);
}

function writeChangelog(root: string, content: string): void {
  writeFileSync(path.join(root, "CHANGELOG.md"), content);
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("resolvePackageChangelogVersions", () => {
  it("allows prerelease packages to fall back through stable and unreleased notes", () => {
    expect(resolvePackageChangelogVersions("2.0.0-beta.11")).toEqual([
      "2.0.0-beta.11",
      "2.0.0",
      "Unreleased",
    ]);
  });

  it("uses the exact section for stable packages", () => {
    expect(resolvePackageChangelogVersions("2.0.0")).toEqual(["2.0.0"]);
  });
});

describe("extractCurrentPackageChangelog", () => {
  it("keeps only the matching release section and shared preamble", () => {
    const content = `# Changelog

Intro.

## 2.0.0-beta.11

- Fast terminal launch for release package users.
- Trimmed package notes avoid shipping stale history.

## 2.0.0-beta.10

- Older notes should not be packaged.
`;

    expect(extractCurrentPackageChangelog(content, "2.0.0-beta.11")).toBe(`# Changelog

Intro.

## 2.0.0-beta.11

- Fast terminal launch for release package users.
- Trimmed package notes avoid shipping stale history.
`);
  });

  it("falls back to unreleased notes for beta packages", () => {
    const content = `# Changelog

## Unreleased

- Current beta package notes are staged here before tagging.
- The tarball should include these notes only.

## 1.9.0

- Old release.
`;

    expect(extractCurrentPackageChangelog(content, "2.0.0-beta.11")).toContain("## Unreleased");
    expect(extractCurrentPackageChangelog(content, "2.0.0-beta.11")).not.toContain("## 1.9.0");
  });

  it("rejects tiny release sections", () => {
    expect(() =>
      extractCurrentPackageChangelog("# Changelog\n\n## 2.0.0\n\n- Small.\n", "2.0.0"),
    ).toThrow(/below the 32 byte safety minimum/u);
  });
});

describe("preparePackageChangelog", () => {
  it("trims and restores the source changelog around package creation", async () => {
    const root = makeRoot();
    const original = `# Changelog

## 2.0.0

- Public package notes for this version.
- These are long enough to satisfy the safety guard.

## 1.9.0

- Old release notes should be restored after packing.
`;
    writePackage(root, "2.0.0");
    writeChangelog(root, original);

    await expect(preparePackageChangelog(root)).resolves.toBe(true);
    expect(readFileSync(path.join(root, "CHANGELOG.md"), "utf8")).not.toContain("## 1.9.0");
    await expect(restorePackageChangelog(root)).resolves.toBe(true);
    expect(readFileSync(path.join(root, "CHANGELOG.md"), "utf8")).toBe(original);
  });
});
