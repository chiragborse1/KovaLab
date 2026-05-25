import type { KovaConfig } from "../../config/types.kova.js";
import { type RoutePeer } from "../../routing/resolve-route.js";
export declare function buildOutboundBaseSessionKey(params: {
    cfg: KovaConfig;
    agentId: string;
    channel: string;
    accountId?: string | null;
    peer: RoutePeer;
}): string;
