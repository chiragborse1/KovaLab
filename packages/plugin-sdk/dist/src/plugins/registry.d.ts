import type { AgentHarness } from "../agents/harness/types.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
import type { OperatorScope } from "../gateway/operator-scopes.js";
import type { GatewayRequestHandler } from "../gateway/server-methods/types.js";
import { registerInternalHook } from "../hooks/internal-hooks.js";
import type { PluginDiagnostic } from "./manifest-types.js";
import type { PluginHttpRouteRegistration as RegistryTypesPluginHttpRouteRegistration, PluginRecord, PluginRegistry, PluginRegistryParams, PluginTextTransformsRegistration } from "./registry-types.js";
import type { CliBackendPlugin, ImageGenerationProviderPlugin, MusicGenerationProviderPlugin, KovaPluginApi, KovaPluginChannelRegistration, KovaPluginCliCommandDescriptor, KovaPluginCliRegistrar, KovaPluginCommandDefinition, KovaPluginGatewayRuntimeScopeSurface, KovaPluginHookOptions, KovaPluginNodeHostCommand, KovaPluginReloadRegistration, KovaPluginSecurityAuditCollector, MediaUnderstandingProviderPlugin, MigrationProviderPlugin, KovaPluginService, KovaPluginToolFactory, PluginHookHandlerMap, PluginHookName, PluginRegistrationMode, ProviderPlugin, RealtimeTranscriptionProviderPlugin, RealtimeVoiceProviderPlugin, SpeechProviderPlugin, VideoGenerationProviderPlugin, WebSearchProviderPlugin } from "./types.js";
export type PluginHttpRouteRegistration = RegistryTypesPluginHttpRouteRegistration & {
    gatewayRuntimeScopeSurface?: KovaPluginGatewayRuntimeScopeSurface;
};
export type { PluginChannelRegistration, PluginChannelSetupRegistration, PluginCliBackendRegistration, PluginCliRegistration, PluginCommandRegistration, PluginConversationBindingResolvedHandlerRegistration, PluginHookRegistration, PluginAgentHarnessRegistration, PluginMemoryEmbeddingProviderRegistration, PluginNodeHostCommandRegistration, PluginProviderRegistration, PluginRecord, PluginRegistry, PluginRegistryParams, PluginReloadRegistration, PluginSecurityAuditCollectorRegistration, PluginServiceRegistration, PluginTextTransformsRegistration, PluginToolRegistration, PluginSpeechProviderRegistration, PluginRealtimeTranscriptionProviderRegistration, PluginRealtimeVoiceProviderRegistration, PluginMediaUnderstandingProviderRegistration, PluginImageGenerationProviderRegistration, PluginVideoGenerationProviderRegistration, PluginMusicGenerationProviderRegistration, PluginWebFetchProviderRegistration, PluginWebSearchProviderRegistration, } from "./registry-types.js";
type PluginTypedHookPolicy = {
    allowPromptInjection?: boolean;
    allowConversationAccess?: boolean;
    timeoutMs?: number;
    timeouts?: Record<string, number>;
};
export { createEmptyPluginRegistry } from "./registry-empty.js";
export declare function createPluginRegistry(registryParams: PluginRegistryParams): {
    registry: PluginRegistry;
    createApi: (record: PluginRecord, params: {
        config: KovaPluginApi["config"];
        pluginConfig?: Record<string, unknown>;
        hookPolicy?: PluginTypedHookPolicy;
        registrationMode?: PluginRegistrationMode;
    }) => KovaPluginApi;
    rollbackPluginGlobalSideEffects: (pluginId: string) => void;
    pushDiagnostic: (diag: PluginDiagnostic) => void;
    registerTool: (record: PluginRecord, tool: AnyAgentTool | KovaPluginToolFactory, opts?: {
        name?: string;
        names?: string[];
        optional?: boolean;
    }) => void;
    registerChannel: (record: PluginRecord, registration: KovaPluginChannelRegistration | ChannelPlugin, mode?: PluginRegistrationMode) => void;
    registerProvider: (record: PluginRecord, provider: ProviderPlugin) => void;
    registerAgentHarness: (record: PluginRecord, harness: AgentHarness) => void;
    registerCliBackend: (record: PluginRecord, backend: CliBackendPlugin) => void;
    registerTextTransforms: (record: PluginRecord, transforms: PluginTextTransformsRegistration["transforms"]) => void;
    registerSpeechProvider: (record: PluginRecord, provider: SpeechProviderPlugin) => void;
    registerRealtimeTranscriptionProvider: (record: PluginRecord, provider: RealtimeTranscriptionProviderPlugin) => void;
    registerRealtimeVoiceProvider: (record: PluginRecord, provider: RealtimeVoiceProviderPlugin) => void;
    registerMediaUnderstandingProvider: (record: PluginRecord, provider: MediaUnderstandingProviderPlugin) => void;
    registerImageGenerationProvider: (record: PluginRecord, provider: ImageGenerationProviderPlugin) => void;
    registerVideoGenerationProvider: (record: PluginRecord, provider: VideoGenerationProviderPlugin) => void;
    registerMusicGenerationProvider: (record: PluginRecord, provider: MusicGenerationProviderPlugin) => void;
    registerWebSearchProvider: (record: PluginRecord, provider: WebSearchProviderPlugin) => void;
    registerMigrationProvider: (record: PluginRecord, provider: MigrationProviderPlugin) => void;
    registerGatewayMethod: (record: PluginRecord, method: string, handler: GatewayRequestHandler, opts?: {
        scope?: OperatorScope;
    }) => void;
    registerCli: (record: PluginRecord, registrar: KovaPluginCliRegistrar, opts?: {
        commands?: string[];
        descriptors?: KovaPluginCliCommandDescriptor[];
    }) => void;
    registerReload: (record: PluginRecord, registration: KovaPluginReloadRegistration) => void;
    registerNodeHostCommand: (record: PluginRecord, nodeCommand: KovaPluginNodeHostCommand) => void;
    registerSecurityAuditCollector: (record: PluginRecord, collector: KovaPluginSecurityAuditCollector) => void;
    registerService: (record: PluginRecord, service: KovaPluginService) => void;
    registerCommand: (record: PluginRecord, command: KovaPluginCommandDefinition) => void;
    registerHook: (record: PluginRecord, events: string | string[], handler: Parameters<typeof registerInternalHook>[1], opts: KovaPluginHookOptions | undefined, config: KovaPluginApi["config"]) => void;
    registerTypedHook: <K extends PluginHookName>(record: PluginRecord, hookName: K, handler: PluginHookHandlerMap[K], opts?: {
        priority?: number;
        timeoutMs?: number;
    }, policy?: PluginTypedHookPolicy) => void;
};
