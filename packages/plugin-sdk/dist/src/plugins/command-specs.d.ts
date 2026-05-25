import type { KovaConfig } from "../config/types.kova.js";
export declare function getPluginCommandSpecs(provider?: string, options?: {
    env?: NodeJS.ProcessEnv;
    stateDir?: string;
    workspaceDir?: string;
    config?: KovaConfig;
}): Array<{
    name: string;
    description: string;
    acceptsArgs: boolean;
}>;
