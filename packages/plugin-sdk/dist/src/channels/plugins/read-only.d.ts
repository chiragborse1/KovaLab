import type { KovaConfig } from "../../config/types.kova.js";
import { resolveReadOnlyChannelCommandDefaults } from "./read-only-command-defaults.js";
import type { ChannelPlugin } from "./types.plugin.js";
type ReadOnlyChannelPluginOptions = {
    env?: NodeJS.ProcessEnv;
    stateDir?: string;
    workspaceDir?: string;
    activationSourceConfig?: KovaConfig;
    includePersistedAuthState?: boolean;
    includeSetupRuntimeFallback?: boolean;
    cache?: boolean;
};
type ReadOnlyChannelPluginResolution = {
    plugins: ChannelPlugin[];
    configuredChannelIds: string[];
    missingConfiguredChannelIds: string[];
};
export { resolveReadOnlyChannelCommandDefaults };
export declare function listReadOnlyChannelPluginsForConfig(cfg: KovaConfig, options?: ReadOnlyChannelPluginOptions): ChannelPlugin[];
export declare function resolveReadOnlyChannelPluginsForConfig(cfg: KovaConfig, options?: ReadOnlyChannelPluginOptions): ReadOnlyChannelPluginResolution;
