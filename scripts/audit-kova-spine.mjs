#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

process.stdout.on("error", (error) => {
  if (error?.code === "EPIPE") {
    process.exit(0);
  }
  throw error;
});

const args = new Set(process.argv.slice(2));
const json = args.has("--json");

function gitLsFiles() {
  const result = spawnSync("git", ["ls-files"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const message = result.stderr.trim() || "git ls-files failed";
    throw new Error(message);
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .toSorted((a, b) => a.localeCompare(b));
}

function increment(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topEntries(map, limit) {
  return [...map.entries()]
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([path, files]) => ({ path, files }));
}

function countTopLevel(files, root) {
  const counts = new Map();
  const prefix = `${root}/`;
  for (const file of files) {
    if (!file.startsWith(prefix)) {
      continue;
    }
    const [name] = file.slice(prefix.length).split("/");
    if (name) {
      increment(counts, `${root}/${name}`);
    }
  }
  return counts;
}

function isTextHotspotCandidate(file) {
  return (
    /^(src|extensions|ui\/src)\//.test(file) &&
    /\.(css|js|jsx|mjs|ts|tsx)$/.test(file) &&
    !file.includes("/dist/")
  );
}

function lineCount(file) {
  try {
    const content = readFileSync(file, "utf8");
    if (content.length === 0) {
      return 0;
    }
    return content.split(/\r\n|\r|\n/).length;
  } catch {
    return null;
  }
}

function largestFiles(files, limit) {
  return files
    .filter(isTextHotspotCandidate)
    .map((file) => ({ path: file, lines: lineCount(file) }))
    .filter((entry) => typeof entry.lines === "number")
    .toSorted((a, b) => b.lines - a.lines || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function countPattern(files, pattern) {
  let occurrences = 0;
  let matchingFiles = 0;
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const matches = content.match(pattern);
    if (!matches) {
      continue;
    }
    matchingFiles += 1;
    occurrences += matches.length;
  }
  return { files: matchingFiles, occurrences };
}

function buildAudit() {
  const files = gitLsFiles();
  const docsFiles = files.filter(
    (file) =>
      file.startsWith("docs/") &&
      file.endsWith(".md") &&
      !file.startsWith("docs/archive/") &&
      !file.startsWith("docs/research/"),
  );
  const extensionDirs = new Set(
    files
      .filter((file) => file.startsWith("extensions/"))
      .map((file) => file.split("/").slice(0, 2).join("/"))
      .filter((dir) => dir !== "extensions/AGENTS.md"),
  );
  const bundledPluginManifests = files.filter((file) =>
    /^extensions\/[^/]+\/kova\.plugin\.json$/.test(file),
  );
  const uiStyleFiles = files.filter(
    (file) => file.startsWith("ui/src/styles/") && file.endsWith(".css"),
  );

  return {
    snapshot: {
      bundledPluginManifests: bundledPluginManifests.length,
      topLevelExtensionDirs: extensionDirs.size,
      docsMarkdownPages: docsFiles.length,
    },
    largestSourceAreas: topEntries(countTopLevel(files, "src"), 10),
    largestExtensionAreas: topEntries(countTopLevel(files, "extensions"), 10),
    largestTextFiles: largestFiles(files, 20),
    controlUiDriftSignals: {
      cardOrElevatedTokens: countPattern(uiStyleFiles, /var\(--(?:card|bg-elevated)\)/g),
      shadowDeclarations: countPattern(uiStyleFiles, /box-shadow\s*:/g),
      gradientDeclarations: countPattern(uiStyleFiles, /(?:linear|radial)-gradient\(/g),
      radiusTokenDeclarations: countPattern(uiStyleFiles, /border-radius\s*:\s*var\(--radius/g),
    },
  };
}

function printMarkdown(audit) {
  console.log("# Kova Spine Static Audit");
  console.log("");
  console.log(
    "Tracked files only. Generated files and large files are signals, not automatic bugs.",
  );
  console.log("");
  console.log("## Snapshot");
  console.log("");
  console.log(`- Bundled plugin manifest files: ${audit.snapshot.bundledPluginManifests}`);
  console.log(`- Top-level extension directories: ${audit.snapshot.topLevelExtensionDirs}`);
  console.log(`- Tracked docs pages under docs/: ${audit.snapshot.docsMarkdownPages}`);
  console.log("");
  console.log("## Largest Source Areas");
  console.log("");
  for (const entry of audit.largestSourceAreas) {
    console.log(`- ${entry.path}: ${entry.files}`);
  }
  console.log("");
  console.log("## Largest Extension Areas");
  console.log("");
  for (const entry of audit.largestExtensionAreas) {
    console.log(`- ${entry.path}: ${entry.files}`);
  }
  console.log("");
  console.log("## Largest Text Files");
  console.log("");
  for (const entry of audit.largestTextFiles) {
    console.log(`- ${entry.path}: ${entry.lines}`);
  }
  console.log("");
  console.log("## Control UI Drift Signals");
  console.log("");
  for (const [name, value] of Object.entries(audit.controlUiDriftSignals)) {
    console.log(`- ${name}: ${value.occurrences} occurrences in ${value.files} files`);
  }
}

const audit = buildAudit();
if (json) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  printMarkdown(audit);
}
