import type { AgentRouteBinding } from "../config/types.agents.js";
import type { KovaConfig } from "../config/types.kova.js";
export declare function listBindings(cfg: KovaConfig): AgentRouteBinding[];
export declare function listBoundAccountIds(cfg: KovaConfig, channelId: string): string[];
export declare function resolveDefaultAgentBoundAccountId(cfg: KovaConfig, channelId: string): string | null;
export declare function buildChannelAccountBindings(cfg: KovaConfig): Map<string, Map<string, string[]>>;
export declare function resolvePreferredAccountId(params: {
    accountIds: string[];
    defaultAccountId: string;
    boundAccounts: string[];
}): string;
