import { resolveConfiguredBindingRecord } from "../../channels/plugins/binding-registry.js";
import { listAcpBindings } from "../../config/bindings.js";
import type { KovaConfig } from "../../config/types.kova.js";
import { getSessionBindingService } from "../../infra/outbound/session-binding-service.js";
export declare const __testing: {
    setDepsForTest(overrides?: Partial<{
        getSessionBindingService: typeof getSessionBindingService;
        listAcpBindings: typeof listAcpBindings;
        resolveConfiguredBindingRecord: typeof resolveConfiguredBindingRecord;
    }>): void;
};
export declare function resolveEffectiveResetTargetSessionKey(params: {
    cfg: KovaConfig;
    channel?: string | null;
    accountId?: string | null;
    conversationId?: string | null;
    parentConversationId?: string | null;
    activeSessionKey?: string | null;
    allowNonAcpBindingSessionKey?: boolean;
    skipConfiguredFallbackWhenActiveSessionNonAcp?: boolean;
    fallbackToActiveAcpWhenUnbound?: boolean;
}): string | undefined;
