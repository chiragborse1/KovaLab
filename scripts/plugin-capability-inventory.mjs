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
const help = args.has("--help") || args.has("-h");

function printHelp() {
  console.log(`Usage: node scripts/plugin-capability-inventory.mjs [options]

Options:
  --json   Print JSON instead of markdown
  --help   Show this help
`);
}

if (help) {
  printHelp();
  process.exit(0);
}

function gitLsFiles() {
  const result = spawnSync("git", ["ls-files", "extensions/*/kova.plugin.json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
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

function readManifest(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { error: String(error) };
  }
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function commandAliasNames(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) =>
      entry && typeof entry === "object" && typeof entry.name === "string" ? entry.name : null,
    )
    .filter(Boolean);
}

function pushGroup(groups, group, pluginId, values) {
  if (values.length === 0) {
    return;
  }
  const current = groups.get(group) ?? new Map();
  current.set(
    pluginId,
    values.toSorted((a, b) => a.localeCompare(b)),
  );
  groups.set(group, current);
}

function buildInventory() {
  const files = gitLsFiles();
  const groups = new Map();
  const manifests = [];
  const errors = [];

  for (const file of files) {
    const raw = readManifest(file);
    const fallbackId = file.split("/")[1] ?? file;
    if (raw.error) {
      errors.push({ file, error: raw.error });
      continue;
    }
    const manifest = raw && typeof raw === "object" ? raw : {};
    const pluginId = typeof manifest.id === "string" ? manifest.id : fallbackId;
    manifests.push({ file, id: pluginId });

    pushGroup(groups, "channels", pluginId, stringArray(manifest.channels));
    pushGroup(groups, "providers", pluginId, stringArray(manifest.providers));
    pushGroup(groups, "cliBackends", pluginId, stringArray(manifest.cliBackends));
    pushGroup(groups, "skills", pluginId, stringArray(manifest.skills));
    pushGroup(groups, "commandAliases", pluginId, commandAliasNames(manifest.commandAliases));

    const contracts =
      manifest.contracts &&
      typeof manifest.contracts === "object" &&
      !Array.isArray(manifest.contracts)
        ? manifest.contracts
        : {};
    for (const [key, value] of Object.entries(contracts)) {
      pushGroup(groups, `contracts.${key}`, pluginId, stringArray(value));
    }
  }

  const capabilityGroups = Object.fromEntries(
    [...groups.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([group, pluginMap]) => [
        group,
        Object.fromEntries(
          [...pluginMap.entries()].toSorted(([left], [right]) => left.localeCompare(right)),
        ),
      ]),
  );
  const groupSummary = Object.fromEntries(
    Object.entries(capabilityGroups).map(([group, pluginMap]) => {
      const values = Object.values(pluginMap).flat();
      return [
        group,
        {
          plugins: Object.keys(pluginMap).length,
          values: values.length,
          uniqueValues: new Set(values).size,
        },
      ];
    }),
  );

  return {
    source: "extensions/*/kova.plugin.json",
    pluginCount: manifests.length,
    manifests,
    errors,
    groupSummary,
    capabilityGroups,
  };
}

function printMarkdown(inventory) {
  console.log("# Plugin Manifest Capability Inventory");
  console.log("");
  console.log(`Source: \`${inventory.source}\``);
  console.log(`Plugins: ${inventory.pluginCount}`);
  if (inventory.errors.length > 0) {
    console.log(`Manifest read errors: ${inventory.errors.length}`);
  }
  console.log("");
  console.log("## Groups");
  console.log("");
  for (const [group, summary] of Object.entries(inventory.groupSummary)) {
    console.log(
      `- ${group}: ${summary.plugins} plugin${summary.plugins === 1 ? "" : "s"}, ${summary.uniqueValues} unique value${summary.uniqueValues === 1 ? "" : "s"}`,
    );
  }
  console.log("");
  console.log("## Ownership");
  for (const [group, pluginMap] of Object.entries(inventory.capabilityGroups)) {
    console.log("");
    console.log(`### ${group}`);
    console.log("");
    for (const [plugin, values] of Object.entries(pluginMap)) {
      console.log(`- ${plugin}: ${values.join(", ")}`);
    }
  }
}

const inventory = buildInventory();
if (json) {
  console.log(JSON.stringify(inventory, null, 2));
} else {
  printMarkdown(inventory);
}
