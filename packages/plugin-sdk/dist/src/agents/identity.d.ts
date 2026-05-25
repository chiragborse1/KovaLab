import type { HumanDelayConfig, IdentityConfig } from "../config/types.base.js";
import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveAgentIdentity(cfg: KovaConfig, agentId: string): IdentityConfig | undefined;
export declare function resolveAckReaction(cfg: KovaConfig, agentId: string, opts?: {
    channel?: string;
    accountId?: string;
}): string;
export declare function resolveIdentityNamePrefix(cfg: KovaConfig, agentId: string): string | undefined;
export declare function resolveMessagePrefix(cfg: KovaConfig, agentId: string, opts?: {
    configured?: string;
    hasAllowFrom?: boolean;
    fallback?: string;
}): string;
export declare function resolveResponsePrefix(cfg: KovaConfig, agentId: string, opts?: {
    channel?: string;
    accountId?: string;
}): string | undefined;
export declare function resolveEffectiveMessagesConfig(cfg: KovaConfig, agentId: string, opts?: {
    hasAllowFrom?: boolean;
    fallbackMessagePrefix?: string;
    channel?: string;
    accountId?: string;
}): {
    messagePrefix: string;
    responsePrefix?: string;
};
export declare function resolveHumanDelayConfig(cfg: KovaConfig, agentId: string): HumanDelayConfig | undefined;
