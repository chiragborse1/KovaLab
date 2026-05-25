import type { KovaConfig } from "../config/types.kova.js";
import { type ResolveCommandConversationResolutionInput } from "./conversation-resolution.js";
export type ConversationBindingContext = {
    channel: string;
    accountId: string;
    conversationId: string;
    parentConversationId?: string;
    threadId?: string;
};
export type ResolveConversationBindingContextInput = Omit<ResolveCommandConversationResolutionInput, "includePlacementHint"> & {
    cfg: KovaConfig;
};
export declare function resolveConversationBindingContext(params: ResolveConversationBindingContextInput): ConversationBindingContext | null;
