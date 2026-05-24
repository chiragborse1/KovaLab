#!/usr/bin/env node

import { readFileSync } from "node:fs";

process.stdout.on("error", (error) => {
  if (error?.code === "EPIPE") {
    process.exit(0);
  }
  throw error;
});

const migratedStyleFiles = [
  "ui/src/styles/config-quick.css",
  "ui/src/styles/control-panel.css",
  "ui/src/styles/layout.mobile.css",
];

const forbiddenPatterns = [
  {
    id: "shadow",
    label: "box shadow",
    pattern: /box-shadow\s*:/,
  },
  {
    id: "gradient",
    label: "gradient",
    pattern: /(?:linear|radial)-gradient\(/,
  },
  {
    id: "backdrop",
    label: "backdrop filter",
    pattern: /backdrop-filter\s*:/,
  },
  {
    id: "surface-token",
    label: "card/elevated surface token",
    pattern: /var\(--(?:card|bg-elevated)\)/,
  },
  {
    id: "radius-token",
    label: "radius token",
    pattern: /border-radius\s*:\s*var\(--radius/,
  },
  {
    id: "nonzero-radius",
    label: "non-zero radius",
    pattern: /border-radius\s*:\s*(?!0(?:\s|;|$))(?:[.\d]+(?:px|rem|em|%)|50%|100%)/,
  },
  {
    id: "negative-tracking",
    label: "negative letter spacing",
    pattern: /letter-spacing\s*:\s*-/,
  },
];

const circularStatusSelectors = [".statusDot", ".qs-status-dot"];

function isAllowedViolation(patternId, selectors) {
  if (patternId !== "nonzero-radius") {
    return false;
  }
  return circularStatusSelectors.some((selector) => selectors.includes(selector));
}

function findViolations(file) {
  const lines = readFileSync(file, "utf8").split(/\r\n|\n|\r/);
  const violations = [];
  let currentSelectors = "";
  let selectorBuffer = "";

  lines.forEach((line, index) => {
    const beforeBlock = line.split("{", 1)[0];
    if (line.includes("{")) {
      currentSelectors = `${selectorBuffer} ${beforeBlock}`.trim();
      selectorBuffer = "";
    } else if (!currentSelectors && line.trim().length > 0 && !line.trim().startsWith("@")) {
      selectorBuffer = `${selectorBuffer} ${line.trim()}`.trim();
    }

    for (const entry of forbiddenPatterns) {
      if (!entry.pattern.test(line)) {
        continue;
      }
      if (isAllowedViolation(entry.id, currentSelectors)) {
        continue;
      }
      violations.push({
        file,
        line: index + 1,
        label: entry.label,
        text: line.trim(),
      });
    }

    if (line.includes("}")) {
      currentSelectors = "";
      selectorBuffer = "";
    }
  });

  return violations;
}

const violations = migratedStyleFiles.flatMap((file) => findViolations(file));

if (violations.length > 0) {
  console.error("Control UI design check failed.");
  console.error("Migrated style files must keep the Kova ruled, square, one-background design.");
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}: ${violation.label}: ${violation.text}`);
  }
  process.exit(1);
}

console.log(`Control UI design check passed for ${migratedStyleFiles.length} migrated files.`);
