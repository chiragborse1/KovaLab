import type { KovaConfig } from "../config/types.kova.js";
import type { SkillsInstallPreferences } from "./skills/types.js";
export { hasBinary, isBundledSkillAllowed, isConfigPathTruthy, resolveBundledAllowlist, resolveConfigPath, resolveRuntimePlatform, resolveSkillConfig, } from "./skills/config.js";
export { applySkillEnvOverrides, applySkillEnvOverridesFromSnapshot, } from "./skills/env-overrides.js";
export type { KovaSkillMetadata, SkillEligibilityContext, SkillCommandSpec, SkillEntry, SkillInstallSpec, SkillSnapshot, SkillsInstallPreferences, } from "./skills/types.js";
export { buildWorkspaceSkillSnapshot, buildWorkspaceSkillsPrompt, filterWorkspaceSkillEntries, filterWorkspaceSkillEntriesWithOptions, loadWorkspaceSkillEntries, resolveSkillsPromptForRun, syncSkillsToWorkspace, } from "./skills/workspace.js";
export { buildWorkspaceSkillCommandSpecs } from "./skills/command-specs.js";
export declare function resolveSkillsInstallPreferences(config?: KovaConfig): SkillsInstallPreferences;
