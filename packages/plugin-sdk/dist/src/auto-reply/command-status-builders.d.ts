import type { SkillCommandSpec } from "../agents/skills.js";
import type { KovaConfig } from "../config/types.kova.js";
export declare function buildHelpMessage(cfg?: KovaConfig): string;
export type CommandsMessageOptions = {
    page?: number;
    surface?: string;
    forcePaginatedList?: boolean;
};
export type CommandsMessageResult = {
    text: string;
    totalPages: number;
    currentPage: number;
    hasNext: boolean;
    hasPrev: boolean;
};
export declare function buildCommandsMessage(cfg?: KovaConfig, skillCommands?: SkillCommandSpec[], options?: CommandsMessageOptions): string;
export declare function buildCommandsMessagePaginated(cfg?: KovaConfig, skillCommands?: SkillCommandSpec[], options?: CommandsMessageOptions): CommandsMessageResult;
