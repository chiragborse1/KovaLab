import type { KovaConfig } from "../config/types.kova.js";
import { loadInstalledPluginIndexInstallRecords } from "../plugins/installed-plugin-index-records.js";
import type { InstalledPluginIndexRefreshReason } from "../plugins/installed-plugin-index.js";
export type PluginRegistryRefreshLogger = {
    warn?: (message: string) => void;
};
export declare function refreshPluginRegistryAfterConfigMutation(params: {
    config: KovaConfig;
    reason: InstalledPluginIndexRefreshReason;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    installRecords?: Awaited<ReturnType<typeof loadInstalledPluginIndexInstallRecords>>;
    logger?: PluginRegistryRefreshLogger;
}): Promise<void>;
