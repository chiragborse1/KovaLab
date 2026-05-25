import type { ConfigWriteOptions } from "../config/io.js";
import type { KovaConfig } from "../config/types.kova.js";
import type { PluginInstallRecord } from "../config/types.plugins.js";
type ConfigCommit = (config: KovaConfig, writeOptions?: ConfigWriteOptions) => Promise<void>;
export declare function commitPluginInstallRecordsWithConfig(params: {
    previousInstallRecords?: Record<string, PluginInstallRecord>;
    nextInstallRecords: Record<string, PluginInstallRecord>;
    nextConfig: KovaConfig;
    baseHash?: string;
    writeOptions?: ConfigWriteOptions;
}): Promise<void>;
export declare function commitConfigWriteWithPendingPluginInstalls(params: {
    nextConfig: KovaConfig;
    writeOptions?: ConfigWriteOptions;
    commit: ConfigCommit;
}): Promise<{
    config: KovaConfig;
    installRecords: Record<string, PluginInstallRecord>;
    movedInstallRecords: boolean;
}>;
export declare function commitConfigWithPendingPluginInstalls(params: {
    nextConfig: KovaConfig;
    baseHash?: string;
    writeOptions?: ConfigWriteOptions;
}): Promise<{
    config: KovaConfig;
    installRecords: Record<string, PluginInstallRecord>;
    movedInstallRecords: boolean;
}>;
export {};
