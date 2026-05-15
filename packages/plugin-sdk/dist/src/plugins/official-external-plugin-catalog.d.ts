import { MANIFEST_KEY } from "../compat/legacy-names.js";
import type { PluginPackageInstall } from "./manifest.js";
type ManifestKey = typeof MANIFEST_KEY;
export type OfficialExternalPluginCatalogManifest = {
    plugin?: {
        id?: string;
        label?: string;
    };
    channel?: {
        id?: string;
        label?: string;
    };
    install?: PluginPackageInstall;
};
export type OfficialExternalPluginCatalogEntry = {
    name?: string;
    version?: string;
    description?: string;
    source?: string;
    kind?: string;
} & Partial<Record<ManifestKey, OfficialExternalPluginCatalogManifest>>;
export declare function getOfficialExternalPluginCatalogManifest(entry: OfficialExternalPluginCatalogEntry): OfficialExternalPluginCatalogManifest | undefined;
export declare function resolveOfficialExternalPluginId(entry: OfficialExternalPluginCatalogEntry): string | undefined;
export declare function resolveOfficialExternalPluginInstall(entry: OfficialExternalPluginCatalogEntry): PluginPackageInstall | null;
export declare function listOfficialExternalPluginCatalogEntries(): OfficialExternalPluginCatalogEntry[];
export declare function getOfficialExternalPluginCatalogEntry(pluginIdOrPackage: string): OfficialExternalPluginCatalogEntry | undefined;
export declare function resolveOfficialExternalPluginNpmSpec(pluginIdOrPackage: string): string | undefined;
export declare function isOfficialExternalPluginId(pluginId: string | undefined): boolean;
export declare function isOfficialExternalPluginPackageName(packageName: string | undefined): boolean;
export {};
