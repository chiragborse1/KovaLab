import { type ChannelPresenceSignalSource } from "../channels/config-presence.js";
import type { KovaConfig } from "../config/types.kova.js";
import type { PluginManifestRecord } from "./manifest-registry.js";
export type ConfiguredChannelPresenceSource = "explicit-config" | Exclude<ChannelPresenceSignalSource, "config"> | "manifest-env";
export type ConfiguredChannelBlockedReason = "plugins-disabled" | "blocked-by-denylist" | "plugin-disabled" | "not-in-allowlist" | "workspace-disabled-by-default" | "bundled-disabled-by-default" | "untrusted-plugin" | "no-channel-owner" | "not-activated";
export type ConfiguredChannelPresencePolicyEntry = {
    channelId: string;
    sources: ConfiguredChannelPresenceSource[];
    effective: boolean;
    pluginIds: string[];
    blockedReasons: ConfiguredChannelBlockedReason[];
};
export declare function hasExplicitChannelConfig(params: {
    config: KovaConfig;
    channelId: string;
}): boolean;
export declare function listExplicitConfiguredChannelIdsForConfig(config: KovaConfig): string[];
export declare function resolveConfiguredChannelPresencePolicy(params: {
    config: KovaConfig;
    activationSourceConfig?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    cache?: boolean;
    includePersistedAuthState?: boolean;
    manifestRecords?: readonly PluginManifestRecord[];
}): ConfiguredChannelPresencePolicyEntry[];
export declare function listConfiguredChannelIdsForReadOnlyScope(params: Parameters<typeof resolveConfiguredChannelPresencePolicy>[0]): string[];
export declare function hasConfiguredChannelsForReadOnlyScope(params: Parameters<typeof resolveConfiguredChannelPresencePolicy>[0]): boolean;
export declare function listConfiguredAnnounceChannelIdsForConfig(params: {
    config: KovaConfig;
    activationSourceConfig?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    cache?: boolean;
}): string[];
export declare function resolveDiscoverableScopedChannelPluginIds(params: {
    config: KovaConfig;
    activationSourceConfig?: KovaConfig;
    channelIds: readonly string[];
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
    cache?: boolean;
    manifestRecords?: readonly PluginManifestRecord[];
}): string[];
export declare function resolveConfiguredChannelPluginIds(params: {
    config: KovaConfig;
    activationSourceConfig?: KovaConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
}): string[];
