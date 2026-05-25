import type { AgentDefaultsConfig } from "../config/types.agent-defaults.js";
import type { KovaConfig } from "../config/types.js";
import { resolveAgentIdFromSessionKey } from "../routing/session-key.js";
export { listAgentEntries, listAgentIds, resolveAgentConfig, resolveAgentContextLimits, resolveAgentDir, resolveAgentWorkspaceDir, resolveDefaultAgentId, type ResolvedAgentConfig, } from "./agent-scope-config.js";
export { resolveAgentIdFromSessionKey };
export declare function resolveSessionAgentIds(params: {
    sessionKey?: string;
    config?: KovaConfig;
    agentId?: string;
}): {
    defaultAgentId: string;
    sessionAgentId: string;
};
export declare function resolveSessionAgentId(params: {
    sessionKey?: string;
    config?: KovaConfig;
}): string;
export declare function resolveAgentExecutionContract(cfg: KovaConfig | undefined, agentId?: string | null): NonNullable<NonNullable<AgentDefaultsConfig["embeddedPi"]>["executionContract"]> | undefined;
export declare function resolveAgentSkillsFilter(cfg: KovaConfig, agentId: string): string[] | undefined;
export declare function resolveAgentExplicitModelPrimary(cfg: KovaConfig, agentId: string): string | undefined;
export declare function resolveAgentEffectiveModelPrimary(cfg: KovaConfig, agentId: string): string | undefined;
export type AgentModelPrimaryWriteTarget = "agent" | "defaults";
export declare function setAgentEffectiveModelPrimary(cfg: KovaConfig, agentId: string, primary: string): AgentModelPrimaryWriteTarget;
export declare function resolveAgentModelPrimary(cfg: KovaConfig, agentId: string): string | undefined;
export declare function resolveAgentModelFallbacksOverride(cfg: KovaConfig, agentId: string): string[] | undefined;
export declare function resolveFallbackAgentId(params: {
    agentId?: string | null;
    sessionKey?: string | null;
}): string;
export declare function resolveRunModelFallbacksOverride(params: {
    cfg: KovaConfig | undefined;
    agentId?: string | null;
    sessionKey?: string | null;
}): string[] | undefined;
export declare function hasConfiguredModelFallbacks(params: {
    cfg: KovaConfig | undefined;
    agentId?: string | null;
    sessionKey?: string | null;
}): boolean;
export declare function resolveEffectiveModelFallbacks(params: {
    cfg: KovaConfig;
    agentId: string;
    hasSessionModelOverride: boolean;
}): string[] | undefined;
export declare function resolveAgentIdsByWorkspacePath(cfg: KovaConfig, workspacePath: string): string[];
export declare function resolveAgentIdByWorkspacePath(cfg: KovaConfig, workspacePath: string): string | undefined;
