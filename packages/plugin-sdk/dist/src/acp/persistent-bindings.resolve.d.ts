import type { KovaConfig } from "../config/types.kova.js";
import type { ConversationRef } from "../infra/outbound/session-binding-service.js";
import { type ConfiguredAcpBindingSpec, type ResolvedConfiguredAcpBinding } from "./persistent-bindings.types.js";
export declare function resolveConfiguredAcpBindingRecord(params: {
    cfg: KovaConfig;
    channel: string;
    accountId: string;
    conversationId: string;
    parentConversationId?: string;
}): ResolvedConfiguredAcpBinding | null;
export declare function resolveConfiguredAcpBindingRecordForConversation(params: {
    cfg: KovaConfig;
    conversation: ConversationRef;
}): ResolvedConfiguredAcpBinding | null;
export declare function resolveConfiguredAcpBindingSpecBySessionKey(params: {
    cfg: KovaConfig;
    sessionKey: string;
}): ConfiguredAcpBindingSpec | null;
