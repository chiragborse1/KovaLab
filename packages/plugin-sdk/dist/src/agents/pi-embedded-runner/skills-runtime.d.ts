import type { KovaConfig } from "../../config/types.kova.js";
import { type SkillEntry, type SkillSnapshot } from "../skills.js";
export declare function resolveEmbeddedRunSkillEntries(params: {
    workspaceDir: string;
    config?: KovaConfig;
    agentId?: string;
    skillsSnapshot?: SkillSnapshot;
}): {
    shouldLoadSkillEntries: boolean;
    skillEntries: SkillEntry[];
};
