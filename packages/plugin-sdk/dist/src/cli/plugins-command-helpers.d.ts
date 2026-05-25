import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveFileNpmSpecToLocalPath(raw: string): {
    ok: true;
    path: string;
} | {
    ok: false;
    error: string;
} | null;
export declare function applySlotSelectionForPlugin(config: KovaConfig, pluginId: string): {
    config: KovaConfig;
    warnings: string[];
};
export declare function createPluginInstallLogger(): {
    info: (msg: string) => void;
    warn: (msg: string) => void;
};
export declare function createHookPackInstallLogger(): {
    info: (msg: string) => void;
    warn: (msg: string) => void;
};
export declare function enableInternalHookEntries(config: KovaConfig, hookNames: string[]): KovaConfig;
export declare function formatPluginInstallWithHookFallbackError(pluginError: string, hookError: string): string;
export declare function logHookPackRestartHint(): void;
export declare function logSlotWarnings(warnings: string[]): void;
export declare function parseNpmPrefixSpec(raw: string): string | null;
