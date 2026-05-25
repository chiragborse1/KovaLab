import type { KovaConfig } from "../../config/types.kova.js";
import type { SkillConfig } from "../../config/types.skills.js";
import { hasBinary, resolveConfigPath, resolveRuntimePlatform } from "../../shared/config-eval.js";
import type { SkillEligibilityContext, SkillEntry } from "./types.js";
export { hasBinary, resolveConfigPath, resolveRuntimePlatform };
export declare function isConfigPathTruthy(config: KovaConfig | undefined, pathStr: string): boolean;
export declare function resolveSkillConfig(config: KovaConfig | undefined, skillKey: string): SkillConfig | undefined;
export declare function resolveBundledAllowlist(config?: KovaConfig): string[] | undefined;
export declare function isBundledSkillAllowed(entry: SkillEntry, allowlist?: string[]): boolean;
export declare function shouldIncludeSkill(params: {
    entry: SkillEntry;
    config?: KovaConfig;
    eligibility?: SkillEligibilityContext;
}): boolean;
