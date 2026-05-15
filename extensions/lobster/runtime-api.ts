export { definePluginEntry } from "getkova/plugin-sdk/core";
export type {
  AnyAgentTool,
  KovaPluginApi,
  KovaPluginToolContext,
  KovaPluginToolFactory,
} from "getkova/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "getkova/plugin-sdk/windows-spawn";
