import type { KovaConfig } from "../../config/types.kova.js";
export declare function ensureSelectedAgentHarnessPlugin(params: {
    provider: string;
    modelId: string;
    config?: KovaConfig;
    agentId?: string;
    sessionKey?: string;
    workspaceDir: string;
}): Promise<void>;
