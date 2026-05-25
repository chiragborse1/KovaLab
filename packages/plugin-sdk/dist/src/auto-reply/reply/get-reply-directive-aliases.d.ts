import type { SkillCommandSpec } from "../../agents/skills.js";
import type { KovaConfig } from "../../config/types.kova.js";
export declare function reserveSkillCommandNames(params: {
    reservedCommands: Set<string>;
    skillCommands: SkillCommandSpec[];
}): void;
export declare function resolveConfiguredDirectiveAliases(params: {
    cfg: KovaConfig;
    commandTextHasSlash: boolean;
    reservedCommands: Set<string>;
}): string[];
