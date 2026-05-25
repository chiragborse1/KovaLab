import type { TSchema } from "typebox";
import type { KovaConfig } from "../../config/types.kova.js";
import type { ChannelMessageCapability } from "./message-capabilities.js";
import { type ChannelMessageToolDiscoveryAdapter } from "./message-tool-api.js";
import type { ChannelMessageActionDiscoveryContext, ChannelMessageActionName, ChannelMessageToolSchemaContribution } from "./types.public.js";
export type ChannelMessageActionDiscoveryInput = {
    cfg?: KovaConfig;
    channel?: string | null;
    currentChannelProvider?: string | null;
    currentChannelId?: string | null;
    currentThreadTs?: string | null;
    currentMessageId?: string | number | null;
    accountId?: string | null;
    sessionKey?: string | null;
    sessionId?: string | null;
    agentId?: string | null;
    requesterSenderId?: string | null;
    senderIsOwner?: boolean;
};
type ChannelMessageActionDiscoveryParams = ChannelMessageActionDiscoveryInput & {
    cfg: KovaConfig;
};
type ChannelMessageToolMediaSourceParamKeyInput = ChannelMessageActionDiscoveryParams & {
    action?: ChannelMessageActionName;
};
export declare function resolveMessageActionDiscoveryChannelId(raw?: string | null): string | undefined;
export declare function createMessageActionDiscoveryContext(params: ChannelMessageActionDiscoveryInput): ChannelMessageActionDiscoveryContext;
type ResolvedChannelMessageActionDiscovery = {
    actions: ChannelMessageActionName[];
    capabilities: readonly ChannelMessageCapability[];
    schemaContributions: ChannelMessageToolSchemaContribution[];
    mediaSourceParams: readonly string[];
};
export declare function resolveCurrentChannelMessageToolDiscoveryAdapter(channel?: string | null): {
    pluginId: string;
    actions: ChannelMessageToolDiscoveryAdapter;
} | null;
export declare function resolveMessageActionDiscoveryForPlugin(params: {
    pluginId: string;
    actions?: ChannelMessageToolDiscoveryAdapter;
    context: ChannelMessageActionDiscoveryContext;
    action?: ChannelMessageActionName;
    includeActions?: boolean;
    includeCapabilities?: boolean;
    includeSchema?: boolean;
}): ResolvedChannelMessageActionDiscovery;
export declare function listChannelMessageActions(cfg: KovaConfig): ChannelMessageActionName[];
export declare function listCrossChannelSchemaSupportedMessageActions(params: ChannelMessageActionDiscoveryParams & {
    channel?: string;
}): ChannelMessageActionName[];
export declare function listChannelMessageCapabilities(cfg: KovaConfig): ChannelMessageCapability[];
export declare function listChannelMessageCapabilitiesForChannel(params: ChannelMessageActionDiscoveryParams): ChannelMessageCapability[];
export declare function resolveChannelMessageToolSchemaProperties(params: ChannelMessageActionDiscoveryParams): Record<string, TSchema>;
export declare function resolveChannelMessageToolMediaSourceParamKeys(params: ChannelMessageToolMediaSourceParamKeyInput): string[];
export declare function channelSupportsMessageCapability(cfg: KovaConfig, capability: ChannelMessageCapability): boolean;
export declare function channelSupportsMessageCapabilityForChannel(params: ChannelMessageActionDiscoveryParams, capability: ChannelMessageCapability): boolean;
export declare const __testing: {
    resetLoggedMessageActionErrors(): void;
};
export {};
