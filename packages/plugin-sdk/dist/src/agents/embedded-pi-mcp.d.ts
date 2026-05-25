import type { KovaConfig } from "../config/types.kova.js";
import type { BundleMcpDiagnostic, BundleMcpServerConfig } from "../plugins/bundle-mcp.js";
export type EmbeddedPiMcpConfig = {
    mcpServers: Record<string, BundleMcpServerConfig>;
    diagnostics: BundleMcpDiagnostic[];
};
export declare function loadEmbeddedPiMcpConfig(params: {
    workspaceDir: string;
    cfg?: KovaConfig;
}): EmbeddedPiMcpConfig;
