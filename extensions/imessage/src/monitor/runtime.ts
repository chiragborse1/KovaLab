import { createNonExitingRuntime, type RuntimeEnv } from "getkova/plugin-sdk/runtime-env";
import { normalizeStringEntries } from "getkova/plugin-sdk/text-runtime";
import type { MonitorIMessageOpts } from "./types.js";

export function resolveRuntime(opts: MonitorIMessageOpts): RuntimeEnv {
  return opts.runtime ?? createNonExitingRuntime();
}

export function normalizeAllowList(list?: Array<string | number>) {
  return normalizeStringEntries(list);
}
