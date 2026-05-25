import type { KovaConfig } from "../../config/types.kova.js";
import type { SkillEligibilityContext, SkillCommandSpec, SkillEntry } from "./types.js";
export declare function buildWorkspaceSkillCommandSpecs(workspaceDir: string, opts?: {
    config?: KovaConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
    entries?: SkillEntry[];
    agentId?: string;
    skillFilter?: string[];
    eligibility?: SkillEligibilityContext;
    reservedNames?: Set<string>;
}): SkillCommandSpec[];
