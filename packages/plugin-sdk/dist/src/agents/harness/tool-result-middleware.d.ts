import type { AgentToolResultMiddleware, AgentToolResultMiddlewareContext, AgentToolResultMiddlewareEvent, KovaAgentToolResult } from "../../plugins/agent-tool-result-middleware-types.js";
export declare function createAgentToolResultMiddlewareRunner(ctx: AgentToolResultMiddlewareContext, handlers?: AgentToolResultMiddleware[]): {
    applyToolResultMiddleware(event: AgentToolResultMiddlewareEvent): Promise<KovaAgentToolResult>;
};
