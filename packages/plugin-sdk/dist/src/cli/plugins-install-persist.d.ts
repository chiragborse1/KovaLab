import type { KovaConfig } from "../config/types.kova.js";
import { type HookInstallUpdate } from "../hooks/installs.js";
import type { PluginInstallUpdate } from "../plugins/installs.js";
export type ConfigSnapshotForInstallPersist = {
    config: KovaConfig;
    baseHash: string | undefined;
};
export declare function persistPluginInstall(params: {
    snapshot: ConfigSnapshotForInstallPersist;
    pluginId: string;
    install: Omit<PluginInstallUpdate, "pluginId">;
    enable?: boolean;
    successMessage?: string;
    warningMessage?: string;
}): Promise<KovaConfig>;
export declare function persistHookPackInstall(params: {
    snapshot: ConfigSnapshotForInstallPersist;
    hookPackId: string;
    hooks: string[];
    install: Omit<HookInstallUpdate, "hookId" | "hooks">;
    successMessage?: string;
}): Promise<KovaConfig>;
