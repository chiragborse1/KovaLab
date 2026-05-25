import type { KovaConfig } from "../config/types.kova.js";
import type { WorkspaceBootstrapFile } from "./workspace.js";
export declare function applyBootstrapHookOverrides(params: {
    files: WorkspaceBootstrapFile[];
    workspaceDir: string;
    config?: KovaConfig;
    sessionKey?: string;
    sessionId?: string;
    agentId?: string;
}): Promise<WorkspaceBootstrapFile[]>;
