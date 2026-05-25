import type { KovaConfig } from "../config/types.kova.js";
import type { PluginManifestRecord } from "./manifest-registry.js";
export declare function normalizePluginConfigId(id: unknown): string;
export declare function isWorkspacePluginAllowedByConfig(params: {
    config: KovaConfig | undefined;
    isImplicitlyAllowed?: (pluginId: string) => boolean;
    plugin: PluginManifestRecord;
}): boolean;
