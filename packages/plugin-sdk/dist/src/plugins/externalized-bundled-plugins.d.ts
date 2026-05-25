export type ExternalizedBundledPluginBridge = {
    /** Plugin id used while the plugin was bundled in core. */
    bundledPluginId: string;
    /** Plugin id declared by the external package. Defaults to bundledPluginId. */
    pluginId?: string;
    /** npm spec Kova should install when migrating the bundled plugin out. */
    npmSpec: string;
    /** Bundled directory name, when it differs from bundledPluginId. */
    bundledDirName?: string;
    /** Previous bundled manifest default enablement from the persisted registry. */
    enabledByDefault?: boolean;
    /** Legacy ids that should be treated as this plugin during enablement checks. */
    legacyPluginIds?: readonly string[];
    /** Channel ids that imply this plugin is enabled when configured. */
    channelIds?: readonly string[];
    /** Plugin ids this external package supersedes for channel selection. */
    preferOver?: readonly string[];
};
export declare function getExternalizedBundledPluginTargetId(bridge: ExternalizedBundledPluginBridge): string;
export declare function getExternalizedBundledPluginLookupIds(bridge: ExternalizedBundledPluginBridge): readonly string[];
export declare function getExternalizedBundledPluginLegacyPathSuffix(bridge: ExternalizedBundledPluginBridge): string;
