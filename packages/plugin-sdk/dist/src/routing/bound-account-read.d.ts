import { type ChatType } from "../channels/chat-type.js";
import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveFirstBoundAccountId(params: {
    cfg: KovaConfig;
    channelId: string;
    agentId: string;
    peerId?: string;
    exactPeerIdAliases?: string[];
    peerKind?: ChatType;
    groupSpace?: string | null;
    memberRoleIds?: string[];
}): string | undefined;
