import type { KovaConfig } from "../../config/types.kova.js";
import type { ConversationRef } from "../../infra/outbound/session-binding-service.js";
import type { ConfiguredBindingRecordResolution, ConfiguredBindingResolution } from "./binding-types.js";
export declare function primeConfiguredBindingRegistry(params: {
    cfg: KovaConfig;
}): {
    bindingCount: number;
    channelCount: number;
};
export declare function resolveConfiguredBindingRecord(params: {
    cfg: KovaConfig;
    channel: string;
    accountId: string;
    conversationId: string;
    parentConversationId?: string;
}): ConfiguredBindingRecordResolution | null;
export declare function resolveConfiguredBindingRecordForConversation(params: {
    cfg: KovaConfig;
    conversation: ConversationRef;
}): ConfiguredBindingRecordResolution | null;
export declare function resolveConfiguredBinding(params: {
    cfg: KovaConfig;
    conversation: ConversationRef;
}): ConfiguredBindingResolution | null;
export declare function resolveConfiguredBindingRecordBySessionKey(params: {
    cfg: KovaConfig;
    sessionKey: string;
}): ConfiguredBindingRecordResolution | null;
