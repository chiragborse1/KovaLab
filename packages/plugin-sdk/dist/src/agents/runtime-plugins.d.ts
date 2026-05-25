import type { KovaConfig } from "../config/types.kova.js";
export declare function ensureRuntimePluginsLoaded(params: {
    config?: KovaConfig;
    workspaceDir?: string | null;
    allowGatewaySubagentBinding?: boolean;
}): void;
