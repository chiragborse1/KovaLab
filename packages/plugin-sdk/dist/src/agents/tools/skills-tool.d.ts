import type { KovaConfig } from "../../config/types.kova.js";
import type { SkillEntry, SkillEligibilityContext } from "../skills/types.js";
import type { AnyAgentTool } from "./common.js";
declare const SUPPORT_DIR_NAMES: readonly ["references", "templates", "scripts", "assets"];
type SupportDirName = (typeof SUPPORT_DIR_NAMES)[number];
export type SkillToolOptions = {
    workspaceDir: string;
    config?: KovaConfig;
    entries?: SkillEntry[];
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
    agentId?: string;
    skillFilter?: string[];
    eligibility?: SkillEligibilityContext;
    sessionId?: string;
    maxFileBytes?: number;
};
export type SkillListItem = {
    name: string;
    description: string;
    path: string;
    skillDir: string;
    source?: string;
    primaryEnv?: string;
};
export type SkillViewPayload = SkillListItem & {
    success: true;
    filePath: string;
    content: string;
    linkedFiles: Record<SupportDirName, string[]>;
    hint: string;
};
export declare function loadSkillViewPayload(params: SkillToolOptions & {
    name: string;
    filePath?: string;
}): {
    name: string;
    description: string;
    skillDir: string;
    source?: string;
    primaryEnv?: string;
    success: true;
    filePath: string;
    path: string;
    content: string;
    linkedFiles: Record<"assets" | "references" | "scripts" | "templates", string[]>;
    hint: string;
};
export declare function renderSkillInvocationPrompt(params: {
    payload: SkillViewPayload;
    userInput?: string;
}): string;
export declare function createSkillsListTool(options: SkillToolOptions): AnyAgentTool;
export declare function createSkillViewTool(options: SkillToolOptions): AnyAgentTool;
export {};
