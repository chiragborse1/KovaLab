import type { SkillCommandSpec } from "../agents/skills/types.js";
import type { KovaConfig } from "../config/types.kova.js";
import type { ChatCommandDefinition } from "./commands-registry.types.js";
export declare function listChatCommands(params?: {
    skillCommands?: SkillCommandSpec[];
}): ChatCommandDefinition[];
export declare function isCommandEnabled(cfg: KovaConfig, commandKey: string): boolean;
export declare function listChatCommandsForConfig(cfg: KovaConfig, params?: {
    skillCommands?: SkillCommandSpec[];
}): ChatCommandDefinition[];
