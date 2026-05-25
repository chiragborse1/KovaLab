import type { KovaConfig } from "../../config/types.kova.js";
import { type ConversationRef, type SessionBindingRecord } from "../../infra/outbound/session-binding-service.js";
import type { ResolvedAgentRoute } from "../../routing/resolve-route.js";
import type { ConfiguredBindingResolution } from "./binding-types.js";
export type ConfiguredBindingRouteResult = {
    bindingResolution: ConfiguredBindingResolution | null;
    route: ResolvedAgentRoute;
    boundSessionKey?: string;
    boundAgentId?: string;
};
export type RuntimeConversationBindingRouteResult = {
    bindingRecord: SessionBindingRecord | null;
    route: ResolvedAgentRoute;
    boundSessionKey?: string;
    boundAgentId?: string;
};
type ConfiguredBindingRouteConversationInput = {
    conversation: ConversationRef;
} | {
    channel: string;
    accountId: string;
    conversationId: string;
    parentConversationId?: string;
};
export declare function resolveConfiguredBindingRoute(params: {
    cfg: KovaConfig;
    route: ResolvedAgentRoute;
} & ConfiguredBindingRouteConversationInput): ConfiguredBindingRouteResult;
export declare function resolveRuntimeConversationBindingRoute(params: {
    route: ResolvedAgentRoute;
} & ConfiguredBindingRouteConversationInput): RuntimeConversationBindingRouteResult;
export declare function ensureConfiguredBindingRouteReady(params: {
    cfg: KovaConfig;
    bindingResolution: ConfiguredBindingResolution | null;
}): Promise<{
    ok: true;
} | {
    ok: false;
    error: string;
}>;
export {};
