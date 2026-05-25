import type { KovaConfig } from "../config/types.kova.js";
import type { BundleMcpToolRuntime, SessionMcpRuntime } from "./pi-bundle-mcp-types.js";
export declare function materializeBundleMcpToolsForRun(params: {
    runtime: SessionMcpRuntime;
    reservedToolNames?: Iterable<string>;
    disposeRuntime?: () => Promise<void>;
}): Promise<BundleMcpToolRuntime>;
export declare function createBundleMcpToolRuntime(params: {
    workspaceDir: string;
    cfg?: KovaConfig;
    reservedToolNames?: Iterable<string>;
    createRuntime?: (params: {
        sessionId: string;
        workspaceDir: string;
        cfg?: KovaConfig;
    }) => SessionMcpRuntime;
}): Promise<BundleMcpToolRuntime>;
