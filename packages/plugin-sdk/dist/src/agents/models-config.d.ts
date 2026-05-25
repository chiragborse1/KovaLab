import { type KovaConfig } from "../config/config.js";
export { resetModelsJsonReadyCacheForTest } from "./models-config-state.js";
export declare function ensureModelsFileModeForModelsJson(pathname: string): Promise<void>;
export declare function writeModelsFileAtomicForModelsJson(targetPath: string, contents: string): Promise<void>;
export declare function ensureKovaModelsJson(config?: KovaConfig, agentDirOverride?: string, options?: {
    workspaceDir?: string;
    providerDiscoveryProviderIds?: readonly string[];
    providerDiscoveryTimeoutMs?: number;
    providerDiscoveryEntriesOnly?: boolean;
}): Promise<{
    agentDir: string;
    wrote: boolean;
}>;
