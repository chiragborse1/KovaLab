import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveEffectivePluginIds(params: {
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
    workspaceDir?: string;
}): string[];
