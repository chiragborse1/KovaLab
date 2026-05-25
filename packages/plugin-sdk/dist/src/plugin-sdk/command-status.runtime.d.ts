import type { ReplyPayload } from "../auto-reply/types.js";
import type { KovaConfig } from "../config/types.kova.js";
export type ResolveDirectStatusReplyForSessionParams = {
    cfg: KovaConfig;
    sessionKey: string;
    channel: string;
    senderId?: string;
    senderIsOwner: boolean;
    isAuthorizedSender: boolean;
    isGroup: boolean;
    defaultGroupActivation: () => "always" | "mention";
};
export declare function resolveDirectStatusReplyForSession(params: ResolveDirectStatusReplyForSessionParams): Promise<ReplyPayload | undefined>;
