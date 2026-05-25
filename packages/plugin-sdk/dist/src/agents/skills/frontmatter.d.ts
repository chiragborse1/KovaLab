import type { Skill } from "./skill-contract.js";
import type { KovaSkillMetadata, ParsedSkillFrontmatter, SkillEntry, SkillInvocationPolicy } from "./types.js";
export declare function parseFrontmatter(content: string): ParsedSkillFrontmatter;
export declare function resolveKovaMetadata(frontmatter: ParsedSkillFrontmatter): KovaSkillMetadata | undefined;
export declare function resolveSkillInvocationPolicy(frontmatter: ParsedSkillFrontmatter): SkillInvocationPolicy;
export declare function resolveSkillKey(skill: Skill, entry?: SkillEntry): string;
