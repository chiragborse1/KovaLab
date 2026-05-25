import { resolveConversationBindingContext } from "../../channels/conversation-binding-context.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { MsgContext } from "../templating.js";
import type { HandleCommandsParams } from "./commands-types.js";
type BindingMsgContext = Pick<MsgContext, "OriginatingChannel" | "Surface" | "Provider" | "AccountId" | "ChatType" | "MessageThreadId" | "ThreadParentId" | "SenderId" | "SessionKey" | "ParentSessionKey" | "OriginatingTo" | "To" | "From" | "NativeChannelId">;
export declare function resolveConversationBindingContextFromMessage(params: {
    cfg: KovaConfig;
    ctx: BindingMsgContext;
    senderId?: string | null;
    sessionKey?: string | null;
    parentSessionKey?: string | null;
    commandTo?: string | null;
}): ReturnType<typeof resolveConversationBindingContext>;
export declare function resolveConversationBindingContextFromAcpCommand(params: HandleCommandsParams): ReturnType<typeof resolveConversationBindingContext>;
export declare function resolveConversationBindingChannelFromMessage(ctx: BindingMsgContext, commandChannel?: string | null): string;
export declare function resolveConversationBindingAccountIdFromMessage(params: {
    ctx: BindingMsgContext;
    cfg: KovaConfig;
    commandChannel?: string | null;
}): string;
export declare function resolveConversationBindingThreadIdFromMessage(ctx: Pick<BindingMsgContext, "MessageThreadId">): string | undefined;
export {};
