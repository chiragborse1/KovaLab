#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCAN_PATHS = ["README.md", "CHANGELOG.md", "package.json", "apps", "docs", ".github", "ui"];

const SKIP_PREFIXES = ["docs/.generated/"];

const LEGACY_BRAND_RE = /\bopenclaw\b/iu;

function isBinaryBuffer(buffer) {
  return buffer.includes(0);
}

function toRepoPath(cwd, filePath) {
  return path.relative(cwd, filePath).split(path.sep).join("/");
}

function shouldSkipRepoPath(repoPath) {
  return SKIP_PREFIXES.some((prefix) => repoPath.startsWith(prefix));
}

export function listBrandingFiles(cwd = process.cwd()) {
  const output = execFileSync("git", ["ls-files", "-z", "--", ...SCAN_PATHS], {
    cwd,
    encoding: "utf8",
  });
  return output
    .split("\0")
    .filter(Boolean)
    .filter((repoPath) => !shouldSkipRepoPath(repoPath))
    .map((repoPath) => path.join(cwd, repoPath));
}

export function findLegacyBrandingViolations(
  filePaths,
  cwd = process.cwd(),
  readFile = fs.readFileSync,
) {
  const violations = [];
  for (const filePath of filePaths) {
    const repoPath = toRepoPath(cwd, filePath);
    if (LEGACY_BRAND_RE.test(repoPath)) {
      violations.push({
        repoPath,
        lines: ["path"],
      });
    }

    let content;
    try {
      content = readFile(filePath);
    } catch {
      continue;
    }
    if (!Buffer.isBuffer(content)) {
      content = Buffer.from(String(content));
    }
    if (isBinaryBuffer(content)) {
      continue;
    }

    const lines = content.toString("utf8").split(/\r?\n/u);
    const matchedLines = [];
    for (const [index, line] of lines.entries()) {
      if (LEGACY_BRAND_RE.test(line)) {
        matchedLines.push(String(index + 1));
      }
    }
    if (matchedLines.length > 0) {
      violations.push({
        repoPath,
        lines: matchedLines,
      });
    }
  }
  return violations;
}

export async function main() {
  const cwd = process.cwd();
  const violations = findLegacyBrandingViolations(listBrandingFiles(cwd), cwd);
  if (violations.length === 0) {
    console.log("branding guard passed");
    return;
  }

  console.error("Found legacy OpenClaw branding in Kova-facing files:");
  for (const violation of violations) {
    console.error(`- ${violation.repoPath}:${violation.lines.join(",")}`);
  }
  console.error(
    "Use Kova wording in docs, app/UI copy, package metadata, and GitHub-visible text. Plugin compatibility paths are intentionally outside this guard.",
  );
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
