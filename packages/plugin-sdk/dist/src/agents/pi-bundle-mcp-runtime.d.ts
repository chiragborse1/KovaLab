import type { jsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/types.js";
import type { KovaConfig } from "../config/types.kova.js";
import type { SessionMcpRuntime, SessionMcpRuntimeManager } from "./pi-bundle-mcp-types.js";
type CreateSessionMcpRuntime = (params: Parameters<typeof createSessionMcpRuntime>[0] & {
    configFingerprint?: string;
}) => SessionMcpRuntime;
export declare function createBundleMcpJsonSchemaValidator(): jsonSchemaValidator;
declare function resolveSessionMcpRuntimeIdleTtlMs(cfg?: KovaConfig): number;
export declare function createSessionMcpRuntime(params: {
    sessionId: string;
    sessionKey?: string;
    workspaceDir: string;
    cfg?: KovaConfig;
}): SessionMcpRuntime;
declare function createSessionMcpRuntimeManager(opts?: {
    createRuntime?: CreateSessionMcpRuntime;
    now?: () => number;
    enableIdleSweepTimer?: boolean;
    idleSweepIntervalMs?: number;
}): SessionMcpRuntimeManager;
export declare function getSessionMcpRuntimeManager(): SessionMcpRuntimeManager;
export declare function getOrCreateSessionMcpRuntime(params: {
    sessionId: string;
    sessionKey?: string;
    workspaceDir: string;
    cfg?: KovaConfig;
}): Promise<SessionMcpRuntime>;
export declare function disposeSessionMcpRuntime(sessionId: string): Promise<void>;
export declare function retireSessionMcpRuntime(params: {
    sessionId?: string | null;
    reason: string;
    onError?: (error: unknown, sessionId: string, reason: string) => void;
}): Promise<boolean>;
export declare function retireSessionMcpRuntimeForSessionKey(params: {
    sessionKey?: string | null;
    reason: string;
    onError?: (error: unknown, sessionId: string, reason: string) => void;
}): Promise<boolean>;
export declare function disposeAllSessionMcpRuntimes(): Promise<void>;
export declare const __testing: {
    createSessionMcpRuntimeManager: typeof createSessionMcpRuntimeManager;
    resetSessionMcpRuntimeManager(): Promise<void>;
    getCachedSessionIds(): string[];
    resolveSessionMcpRuntimeIdleTtlMs: typeof resolveSessionMcpRuntimeIdleTtlMs;
};
export {};
