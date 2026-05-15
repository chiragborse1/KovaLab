// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to the bundled diffs surface.

export { definePluginEntry } from "./plugin-entry.js";
export type { KovaConfig } from "../config/config.js";
export { resolvePreferredKovaTmpDir } from "../infra/tmp-kova-dir.js";
export type {
  AnyAgentTool,
  KovaPluginApi,
  KovaPluginConfigSchema,
  KovaPluginToolContext,
  PluginLogger,
} from "../plugins/types.js";
