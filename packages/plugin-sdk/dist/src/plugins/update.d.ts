import type { KovaConfig } from "../config/types.kova.js";
import type { UpdateChannel } from "../infra/update-channels.js";
import { type ExternalizedBundledPluginBridge } from "./externalized-bundled-plugins.js";
export type PluginUpdateLogger = {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
};
export type PluginUpdateStatus = "updated" | "unchanged" | "skipped" | "error";
export type PluginUpdateOutcome = {
    pluginId: string;
    status: PluginUpdateStatus;
    message: string;
    currentVersion?: string;
    nextVersion?: string;
};
export type PluginUpdateSummary = {
    config: KovaConfig;
    changed: boolean;
    outcomes: PluginUpdateOutcome[];
};
export type PluginUpdateIntegrityDriftParams = {
    pluginId: string;
    spec: string;
    expectedIntegrity: string;
    actualIntegrity: string;
    resolvedSpec?: string;
    resolvedVersion?: string;
    dryRun: boolean;
};
export type PluginChannelSyncSummary = {
    switchedToBundled: string[];
    switchedToNpm: string[];
    warnings: string[];
    errors: string[];
};
export type PluginChannelSyncResult = {
    config: KovaConfig;
    changed: boolean;
    summary: PluginChannelSyncSummary;
};
export declare function updateNpmInstalledPlugins(params: {
    config: KovaConfig;
    logger?: PluginUpdateLogger;
    pluginIds?: string[];
    skipIds?: Set<string>;
    timeoutMs?: number;
    dryRun?: boolean;
    dangerouslyForceUnsafeInstall?: boolean;
    specOverrides?: Record<string, string>;
    onIntegrityDrift?: (params: PluginUpdateIntegrityDriftParams) => boolean | Promise<boolean>;
}): Promise<PluginUpdateSummary>;
export declare function syncPluginsForUpdateChannel(params: {
    config: KovaConfig;
    channel: UpdateChannel;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    logger?: PluginUpdateLogger;
    externalizedBundledPluginBridges?: readonly ExternalizedBundledPluginBridge[];
}): Promise<PluginChannelSyncResult>;
