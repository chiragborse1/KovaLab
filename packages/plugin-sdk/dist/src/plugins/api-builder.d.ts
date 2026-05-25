import type { KovaConfig } from "../config/types.kova.js";
import type { PluginRuntime } from "./runtime/types.js";
import type { KovaPluginApi, PluginLogger } from "./types.js";
export type BuildPluginApiParams = {
    id: string;
    name: string;
    version?: string;
    description?: string;
    source: string;
    rootDir?: string;
    registrationMode: KovaPluginApi["registrationMode"];
    config: KovaConfig;
    pluginConfig?: Record<string, unknown>;
    runtime: PluginRuntime;
    logger: PluginLogger;
    resolvePath: (input: string) => string;
    handlers?: Partial<Pick<KovaPluginApi, "registerTool" | "registerHook" | "registerHttpRoute" | "registerChannel" | "registerGatewayMethod" | "registerCli" | "registerReload" | "registerNodeHostCommand" | "registerSecurityAuditCollector" | "registerService" | "registerGatewayDiscoveryService" | "registerCliBackend" | "registerTextTransforms" | "registerConfigMigration" | "registerMigrationProvider" | "registerAutoEnableProbe" | "registerProvider" | "registerSpeechProvider" | "registerRealtimeTranscriptionProvider" | "registerRealtimeVoiceProvider" | "registerMediaUnderstandingProvider" | "registerImageGenerationProvider" | "registerVideoGenerationProvider" | "registerMusicGenerationProvider" | "registerWebFetchProvider" | "registerWebSearchProvider" | "registerInteractiveHandler" | "onConversationBindingResolved" | "registerCommand" | "registerContextEngine" | "registerCompactionProvider" | "registerAgentHarness" | "registerCodexAppServerExtensionFactory" | "registerAgentToolResultMiddleware" | "registerDetachedTaskRuntime" | "registerMemoryCapability" | "registerMemoryPromptSection" | "registerMemoryPromptSupplement" | "registerMemoryCorpusSupplement" | "registerMemoryFlushPlan" | "registerMemoryRuntime" | "registerMemoryEmbeddingProvider" | "on">>;
};
export declare function buildPluginApi(params: BuildPluginApiParams): KovaPluginApi;
