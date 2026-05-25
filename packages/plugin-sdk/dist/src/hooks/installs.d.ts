import type { HookInstallRecord } from "../config/types.hooks.js";
import type { KovaConfig } from "../config/types.kova.js";
export type HookInstallUpdate = HookInstallRecord & {
    hookId: string;
};
export declare function recordHookInstall(cfg: KovaConfig, update: HookInstallUpdate): KovaConfig;
