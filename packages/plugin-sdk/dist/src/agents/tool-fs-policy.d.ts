import type { KovaConfig } from "../config/types.kova.js";
export type ToolFsPolicy = {
    workspaceOnly: boolean;
};
export declare function createToolFsPolicy(params: {
    workspaceOnly?: boolean;
}): ToolFsPolicy;
export declare function resolveToolFsConfig(params: {
    cfg?: KovaConfig;
    agentId?: string;
}): {
    workspaceOnly?: boolean;
};
export declare function resolveEffectiveToolFsWorkspaceOnly(params: {
    cfg?: KovaConfig;
    agentId?: string;
}): boolean;
export declare function resolveEffectiveToolFsRootExpansionAllowed(params: {
    cfg?: KovaConfig;
    agentId?: string;
}): boolean;
