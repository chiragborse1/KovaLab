import type { KovaConfig } from "../../config/types.kova.js";
import type { PluginInstallRecord } from "../../config/types.plugins.js";
import type { GatewayRequestHandlers } from "./types.js";
export type PluginStatusSummary = {
    id: string;
    name: string;
    enabled: boolean;
    status: "loaded" | "disabled" | "error";
    origin: string;
    format?: string;
    bundleFormat?: string;
    kind?: string | string[];
    version?: string;
    description?: string;
    channelIds: string[];
    providerIds: string[];
    toolNames: string[];
    gatewayMethods: string[];
    services: string[];
    commands: string[];
    configSchema: boolean;
    installed: boolean;
    configured: boolean;
    removable: boolean;
    error?: string;
};
export type PluginStatusDiagnostic = {
    level: "info" | "warn" | "error";
    message: string;
    code?: string;
    pluginId?: string;
    source?: string;
};
export type PluginsStatusResult = {
    registrySource: "provided" | "persisted" | "derived";
    plugins: PluginStatusSummary[];
    diagnostics: PluginStatusDiagnostic[];
    totals: {
        total: number;
        enabled: number;
        disabled: number;
        errors: number;
        channels: number;
        providers: number;
    };
};
export type PluginsMutationResult = {
    ok: true;
    pluginId: string;
    message: string;
    restartRequired: true;
    warnings: string[];
    status: PluginsStatusResult;
};
export type PluginsInstallResult = {
    ok: true;
    pluginId: string;
    message: string;
    restartRequired: true;
    logs: string[];
    status: PluginsStatusResult;
};
export declare function createPluginsStatusResult(config: KovaConfig, options?: {
    installRecords?: Record<string, PluginInstallRecord>;
}): PluginsStatusResult;
export declare const pluginsHandlers: GatewayRequestHandlers;
