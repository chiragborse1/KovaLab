import { type SkillCommandSpec } from "../agents/skills.js";
import type { KovaConfig } from "../config/types.kova.js";
export { listReservedChatSlashCommandNames, resolveSkillCommandInvocation, } from "./skill-commands-base.js";
export declare function listSkillCommandsForWorkspace(params: {
    workspaceDir: string;
    cfg: KovaConfig;
    agentId?: string;
    skillFilter?: string[];
}): SkillCommandSpec[];
declare function dedupeBySkillName(commands: SkillCommandSpec[]): SkillCommandSpec[];
export declare function listSkillCommandsForAgents(params: {
    cfg: KovaConfig;
    agentIds?: string[];
}): SkillCommandSpec[];
export declare const __testing: {
    dedupeBySkillName: typeof dedupeBySkillName;
};
