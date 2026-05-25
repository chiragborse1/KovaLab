import type { KovaConfig } from "../config/types.kova.js";
import { clearActiveMcpLoopbackRuntimeByOwnerToken, createMcpLoopbackServerConfig, getActiveMcpLoopbackRuntime, setActiveMcpLoopbackRuntime } from "./mcp-http.loopback-runtime.js";
import { type McpLoopbackTool, type McpToolSchemaEntry } from "./mcp-http.schema.js";
type CachedScopedTools = {
    agentId: string | undefined;
    tools: McpLoopbackTool[];
    toolSchema: McpToolSchemaEntry[];
    configRef: KovaConfig;
    time: number;
};
export declare function resolveMcpLoopbackScopedTools(params: {
    cfg: KovaConfig;
    sessionKey: string;
    messageProvider: string | undefined;
    accountId: string | undefined;
    senderIsOwner: boolean | undefined;
}): {
    agentId: string | undefined;
    tools: McpLoopbackTool[];
};
export declare class McpLoopbackToolCache {
    #private;
    resolve(params: {
        cfg: KovaConfig;
        sessionKey: string;
        messageProvider: string | undefined;
        accountId: string | undefined;
        senderIsOwner: boolean | undefined;
    }): CachedScopedTools;
}
export { clearActiveMcpLoopbackRuntimeByOwnerToken, createMcpLoopbackServerConfig, getActiveMcpLoopbackRuntime, setActiveMcpLoopbackRuntime, };
