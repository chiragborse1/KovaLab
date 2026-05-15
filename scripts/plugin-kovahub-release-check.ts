#!/usr/bin/env -S node --import tsx

import { pathToFileURL } from "node:url";
import {
  collectKovaHubPublishablePluginPackages,
  collectKovaHubVersionGateErrors,
  parsePluginReleaseArgs,
  resolveSelectedKovaHubPublishablePluginPackages,
} from "./lib/plugin-kovahub-release.ts";

export async function runPluginKovaHubReleaseCheck(argv: string[]) {
  const { selection, selectionMode, baseRef, headRef } = parsePluginReleaseArgs(argv);
  const publishable = collectKovaHubPublishablePluginPackages();
  const gitRange = baseRef && headRef ? { baseRef, headRef } : undefined;
  const selected = resolveSelectedKovaHubPublishablePluginPackages({
    plugins: publishable,
    selection,
    selectionMode,
    gitRange,
  });

  if (gitRange) {
    const errors = collectKovaHubVersionGateErrors({
      plugins: publishable,
      gitRange,
    });
    if (errors.length > 0) {
      throw new Error(
        `plugin-kovahub-release-check: version bumps required before KovaHub publish:\n${errors
          .map((error) => `  - ${error}`)
          .join("\n")}`,
      );
    }
  }

  console.log("plugin-kovahub-release-check: publishable plugin metadata looks OK.");
  if (gitRange && selected.length === 0) {
    console.log(
      `  - no publishable plugin package changes detected between ${gitRange.baseRef} and ${gitRange.headRef}`,
    );
  }
  for (const plugin of selected) {
    console.log(
      `  - ${plugin.packageName}@${plugin.version} (${plugin.channel}, ${plugin.extensionId})`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runPluginKovaHubReleaseCheck(process.argv.slice(2));
}
