import type { KovaConfig } from "../../config/types.kova.js";
import type { MsgContext } from "../templating.js";
import type { CommandContext } from "./commands-types.js";
import type { SessionInitResult } from "./session.js";
export declare function markCompleteReplyConfig<T extends KovaConfig>(config: T, options?: {
    runtimeMode?: "fast" | "full";
}): T;
export declare function withFastReplyConfig<T extends KovaConfig>(config: T): T;
export declare function withFullRuntimeReplyConfig<T extends KovaConfig>(config: T): T;
export declare function isCompleteReplyConfig(config: unknown): config is KovaConfig;
export declare function usesFullReplyRuntime(config: unknown): boolean;
export declare function resolveGetReplyConfig(params: {
    getRuntimeConfig: () => KovaConfig;
    isFastTestEnv: boolean;
    configOverride?: KovaConfig;
}): KovaConfig;
export declare function shouldUseReplyFastTestBootstrap(params: {
    isFastTestEnv: boolean;
    configOverride?: KovaConfig;
}): boolean;
export declare function shouldUseReplyFastTestRuntime(params: {
    cfg: KovaConfig;
    isFastTestEnv: boolean;
}): boolean;
export declare function shouldUseReplyFastDirectiveExecution(params: {
    isFastTestBootstrap: boolean;
    isGroup: boolean;
    isHeartbeat: boolean;
    resetTriggered: boolean;
    triggerBodyNormalized: string;
}): boolean;
export declare function buildFastReplyCommandContext(params: {
    ctx: MsgContext;
    cfg: KovaConfig;
    agentId?: string;
    sessionKey?: string;
    isGroup: boolean;
    triggerBodyNormalized: string;
    commandAuthorized: boolean;
}): CommandContext;
export declare function shouldHandleFastReplyTextCommands(params: {
    cfg: KovaConfig;
    commandSource?: string;
}): boolean;
export declare function initFastReplySessionState(params: {
    ctx: MsgContext;
    cfg: KovaConfig;
    agentId: string;
    commandAuthorized: boolean;
    workspaceDir: string;
}): SessionInitResult;
