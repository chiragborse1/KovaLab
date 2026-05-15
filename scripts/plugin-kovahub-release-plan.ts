#!/usr/bin/env -S node --import tsx

import { pathToFileURL } from "node:url";
import {
  collectPluginKovaHubReleasePlan,
  parsePluginReleaseArgs,
} from "./lib/plugin-kovahub-release.ts";

export async function collectPluginReleasePlanForKovaHub(argv: string[]) {
  const { selection, selectionMode, baseRef, headRef } = parsePluginReleaseArgs(argv);
  return await collectPluginKovaHubReleasePlan({
    selection,
    selectionMode,
    gitRange: baseRef && headRef ? { baseRef, headRef } : undefined,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const plan = await collectPluginReleasePlanForKovaHub(process.argv.slice(2));
  console.log(JSON.stringify(plan, null, 2));
}
