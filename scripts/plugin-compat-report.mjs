#!/usr/bin/env node

import { readFileSync } from "node:fs";

process.stdout.on("error", (error) => {
  if (error?.code === "EPIPE") {
    process.exit(0);
  }
  throw error;
});

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const json = args.includes("--json");
const asOfArg = args.find((arg) => arg.startsWith("--as-of="));
const asOf = asOfArg?.slice("--as-of=".length) || new Date().toISOString().slice(0, 10);
const help = args.includes("--help") || args.includes("-h");

function optionValue(name) {
  const match = args.find((arg) => arg.startsWith(`${name}=`));
  return match?.slice(name.length + 1) ?? null;
}

function optionSet(name) {
  const value = optionValue(name);
  if (!value) {
    return null;
  }
  return new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function integerOption(name, fallback) {
  const value = optionValue(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

const filters = {
  owners: optionSet("--owner"),
  sources: optionSet("--source"),
  statuses: optionSet("--status"),
  dueDays: integerOption("--due-days", 90),
  limit: integerOption("--limit", 0),
};

function printHelp() {
  console.log(`Usage: node scripts/plugin-compat-report.mjs [options]

Options:
  --json                  Print JSON instead of markdown
  --as-of=YYYY-MM-DD      Date used for removal-window math
  --owner=a,b             Filter by owner, for example sdk or provider
  --source=plugin,doctor  Filter by source
  --status=a,b            Filter by status, for example deprecated
  --due-days=N            Review queue window in days, default 90
  --limit=N               Limit review queue entries, 0 means no limit
  --help                  Show this help
`);
}

if (help) {
  printHelp();
  process.exit(0);
}

function readSource(path) {
  return readFileSync(path, "utf8");
}

function getStringField(block, name) {
  const match = block.match(new RegExp(`${name}:\\s*"([^"]+)"`));
  return match?.[1] ?? null;
}

function getConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s+=\\s+"([^"]+)"`));
  return match?.[1] ?? null;
}

function extractObjectBlocks(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Missing marker: ${startMarker}`);
  }

  const blocks = [];
  let depth = 0;
  let blockStart = -1;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      if (depth === 0) {
        blockStart = index;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && blockStart >= 0) {
        blocks.push(source.slice(blockStart, index + 1));
        blockStart = -1;
      }
    } else if (depth === 0 && char === "]") {
      break;
    }
  }
  return blocks;
}

function extractDoctorBlocks(source) {
  const blocks = [];
  const marker = "deprecatedCompatRecord({";
  let cursor = 0;
  while (true) {
    const markerIndex = source.indexOf(marker, cursor);
    if (markerIndex === -1) {
      break;
    }
    const objectStart = markerIndex + "deprecatedCompatRecord(".length;
    let depth = 0;
    for (let index = objectStart; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(objectStart, index + 1));
          cursor = index + 1;
          break;
        }
      }
    }
  }
  return blocks;
}

function normalizeRecord(block, defaults, source) {
  const code = getStringField(block, "code");
  const owner = getStringField(block, "owner");
  if (!code || !owner) {
    return null;
  }
  return {
    code,
    source,
    owner,
    status: getStringField(block, "status") || defaults.status,
    introduced: getStringField(block, "introduced"),
    deprecated: getStringField(block, "deprecated") || defaults.deprecated,
    warningStarts: getStringField(block, "warningStarts") || defaults.warningStarts,
    removeAfter: getStringField(block, "removeAfter") || defaults.removeAfter,
    replacement: getStringField(block, "replacement"),
    docsPath: getStringField(block, "docsPath"),
  };
}

function countBy(records, key) {
  const counts = new Map();
  for (const record of records) {
    const value = record[key] ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function countByPair(records, first, second) {
  const counts = new Map();
  for (const record of records) {
    const key = `${record[first] ?? "unknown"} / ${record[second] ?? "unknown"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].toSorted((a, b) => a[0].localeCompare(b[0]));
}

function daysUntil(date, baseline) {
  if (!date) {
    return null;
  }
  const target = Date.parse(`${date}T00:00:00Z`);
  const current = Date.parse(`${baseline}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(current)) {
    return null;
  }
  return Math.round((target - current) / 86_400_000);
}

function matchesSet(value, set) {
  return !set || set.has(value);
}

function matchesFilters(record) {
  return (
    matchesSet(record.owner, filters.owners) &&
    matchesSet(record.source, filters.sources) &&
    matchesSet(record.status, filters.statuses)
  );
}

function serializeSet(set) {
  return set ? [...set].toSorted((a, b) => a.localeCompare(b)) : [];
}

function buildReport() {
  const pluginSource = readSource("src/plugins/compat/registry.ts");
  const doctorSource = readSource("src/commands/doctor/shared/deprecation-compat.ts");
  const doctorToday = getConstant(doctorSource, "TODAY");
  const doctorRemoveAfter = getConstant(doctorSource, "MAX_REMOVE_AFTER");

  const pluginRecords = extractObjectBlocks(pluginSource, "export const PLUGIN_COMPAT_RECORDS = [")
    .map((block) => normalizeRecord(block, { status: "active" }, "plugin"))
    .filter(Boolean);
  const doctorRecords = extractDoctorBlocks(doctorSource)
    .map((block) =>
      normalizeRecord(
        block,
        {
          status: "deprecated",
          deprecated: doctorToday,
          warningStarts: doctorToday,
          removeAfter: doctorRemoveAfter,
        },
        "doctor",
      ),
    )
    .filter(Boolean);
  const records = [...pluginRecords, ...doctorRecords].filter(matchesFilters);
  const datedRecords = records
    .map((record) => ({ ...record, daysUntilRemoveAfter: daysUntil(record.removeAfter, asOf) }))
    .toSorted((a, b) => {
      const aDays = a.daysUntilRemoveAfter ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysUntilRemoveAfter ?? Number.POSITIVE_INFINITY;
      return aDays - bDays || a.source.localeCompare(b.source) || a.code.localeCompare(b.code);
    });

  const reviewQueue = datedRecords.filter(
    (record) =>
      ["deprecated", "removal-pending"].includes(record.status) &&
      typeof record.daysUntilRemoveAfter === "number" &&
      record.daysUntilRemoveAfter <= filters.dueDays,
  );

  return {
    asOf,
    filters: {
      owners: serializeSet(filters.owners),
      sources: serializeSet(filters.sources),
      statuses: serializeSet(filters.statuses),
      dueDays: filters.dueDays,
      limit: filters.limit,
    },
    totals: {
      all: records.length,
      plugin: records.filter((record) => record.source === "plugin").length,
      doctor: records.filter((record) => record.source === "doctor").length,
      deprecatedOrPending: records.filter((record) =>
        ["deprecated", "removal-pending"].includes(record.status),
      ).length,
      active: records.filter((record) => record.status === "active").length,
    },
    statusCounts: countBy(records, "status"),
    ownerCounts: countBy(records, "owner"),
    ownerStatusCounts: countByPair(records, "owner", "status"),
    reviewQueue: filters.limit > 0 ? reviewQueue.slice(0, filters.limit) : reviewQueue,
  };
}

function printMarkdown(report) {
  console.log("# Plugin Compatibility Report");
  console.log("");
  console.log(`As of: ${report.asOf}`);
  console.log(`Review window: ${report.filters.dueDays} days`);
  const activeFilters = [
    report.filters.owners.length > 0 ? `owners=${report.filters.owners.join(",")}` : "",
    report.filters.sources.length > 0 ? `sources=${report.filters.sources.join(",")}` : "",
    report.filters.statuses.length > 0 ? `statuses=${report.filters.statuses.join(",")}` : "",
  ].filter(Boolean);
  if (activeFilters.length > 0) {
    console.log(`Filters: ${activeFilters.join("; ")}`);
  }
  console.log("");
  console.log("## Totals");
  console.log("");
  console.log(`- All records: ${report.totals.all}`);
  console.log(`- Runtime/plugin records: ${report.totals.plugin}`);
  console.log(`- Doctor repair records: ${report.totals.doctor}`);
  console.log(`- Deprecated or removal-pending: ${report.totals.deprecatedOrPending}`);
  console.log(`- Active: ${report.totals.active}`);
  console.log("");
  console.log("## Status Counts");
  console.log("");
  for (const [status, count] of report.statusCounts) {
    console.log(`- ${status}: ${count}`);
  }
  console.log("");
  console.log("## Owner Counts");
  console.log("");
  for (const [owner, count] of report.ownerCounts) {
    console.log(`- ${owner}: ${count}`);
  }
  console.log("");
  console.log("## Owner / Status Counts");
  console.log("");
  for (const [key, count] of report.ownerStatusCounts) {
    console.log(`- ${key}: ${count}`);
  }
  console.log("");
  console.log("## Removal Review Queue");
  console.log("");
  if (report.reviewQueue.length === 0) {
    console.log(
      `- No deprecated or removal-pending records fall within the next ${report.filters.dueDays} days.`,
    );
    return;
  }
  for (const record of report.reviewQueue) {
    console.log(
      `- ${record.source}:${record.code} (${record.owner}, ${record.status}) removeAfter=${record.removeAfter} days=${record.daysUntilRemoveAfter}`,
    );
  }
}

const report = buildReport();
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printMarkdown(report);
}
