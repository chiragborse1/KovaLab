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
  handlers?: Partial<
    Pick<
      KovaPluginApi,
      | "registerTool"
      | "registerHook"
      | "registerHttpRoute"
      | "registerChannel"
      | "registerGatewayMethod"
      | "registerCli"
      | "registerReload"
      | "registerNodeHostCommand"
      | "registerSecurityAuditCollector"
      | "registerService"
      | "registerGatewayDiscoveryService"
      | "registerCliBackend"
      | "registerTextTransforms"
      | "registerConfigMigration"
      | "registerMigrationProvider"
      | "registerAutoEnableProbe"
      | "registerProvider"
      | "registerSpeechProvider"
      | "registerRealtimeTranscriptionProvider"
      | "registerRealtimeVoiceProvider"
      | "registerMediaUnderstandingProvider"
      | "registerImageGenerationProvider"
      | "registerVideoGenerationProvider"
      | "registerMusicGenerationProvider"
      | "registerWebFetchProvider"
      | "registerWebSearchProvider"
      | "registerInteractiveHandler"
      | "onConversationBindingResolved"
      | "registerCommand"
      | "registerContextEngine"
      | "registerCompactionProvider"
      | "registerAgentHarness"
      | "registerCodexAppServerExtensionFactory"
      | "registerAgentToolResultMiddleware"
      | "registerDetachedTaskRuntime"
      | "registerMemoryCapability"
      | "registerMemoryPromptSection"
      | "registerMemoryPromptSupplement"
      | "registerMemoryCorpusSupplement"
      | "registerMemoryFlushPlan"
      | "registerMemoryRuntime"
      | "registerMemoryEmbeddingProvider"
      | "on"
    >
  >;
};

const noopRegisterTool: KovaPluginApi["registerTool"] = () => {};
const noopRegisterHook: KovaPluginApi["registerHook"] = () => {};
const noopRegisterHttpRoute: KovaPluginApi["registerHttpRoute"] = () => {};
const noopRegisterChannel: KovaPluginApi["registerChannel"] = () => {};
const noopRegisterGatewayMethod: KovaPluginApi["registerGatewayMethod"] = () => {};
const noopRegisterCli: KovaPluginApi["registerCli"] = () => {};
const noopRegisterReload: KovaPluginApi["registerReload"] = () => {};
const noopRegisterNodeHostCommand: KovaPluginApi["registerNodeHostCommand"] = () => {};
const noopRegisterSecurityAuditCollector: KovaPluginApi["registerSecurityAuditCollector"] =
  () => {};
const noopRegisterService: KovaPluginApi["registerService"] = () => {};
const noopRegisterGatewayDiscoveryService: KovaPluginApi["registerGatewayDiscoveryService"] =
  () => {};
const noopRegisterCliBackend: KovaPluginApi["registerCliBackend"] = () => {};
const noopRegisterTextTransforms: KovaPluginApi["registerTextTransforms"] = () => {};
const noopRegisterConfigMigration: KovaPluginApi["registerConfigMigration"] = () => {};
const noopRegisterMigrationProvider: KovaPluginApi["registerMigrationProvider"] = () => {};
const noopRegisterAutoEnableProbe: KovaPluginApi["registerAutoEnableProbe"] = () => {};
const noopRegisterProvider: KovaPluginApi["registerProvider"] = () => {};
const noopRegisterSpeechProvider: KovaPluginApi["registerSpeechProvider"] = () => {};
const noopRegisterRealtimeTranscriptionProvider: KovaPluginApi["registerRealtimeTranscriptionProvider"] =
  () => {};
const noopRegisterRealtimeVoiceProvider: KovaPluginApi["registerRealtimeVoiceProvider"] = () => {};
const noopRegisterMediaUnderstandingProvider: KovaPluginApi["registerMediaUnderstandingProvider"] =
  () => {};
const noopRegisterImageGenerationProvider: KovaPluginApi["registerImageGenerationProvider"] =
  () => {};
const noopRegisterVideoGenerationProvider: KovaPluginApi["registerVideoGenerationProvider"] =
  () => {};
const noopRegisterMusicGenerationProvider: KovaPluginApi["registerMusicGenerationProvider"] =
  () => {};
const noopRegisterWebFetchProvider: KovaPluginApi["registerWebFetchProvider"] = () => {};
const noopRegisterWebSearchProvider: KovaPluginApi["registerWebSearchProvider"] = () => {};
const noopRegisterInteractiveHandler: KovaPluginApi["registerInteractiveHandler"] = () => {};
const noopOnConversationBindingResolved: KovaPluginApi["onConversationBindingResolved"] = () => {};
const noopRegisterCommand: KovaPluginApi["registerCommand"] = () => {};
const noopRegisterContextEngine: KovaPluginApi["registerContextEngine"] = () => {};
const noopRegisterCompactionProvider: KovaPluginApi["registerCompactionProvider"] = () => {};
const noopRegisterAgentHarness: KovaPluginApi["registerAgentHarness"] = () => {};
const noopRegisterCodexAppServerExtensionFactory: KovaPluginApi["registerCodexAppServerExtensionFactory"] =
  () => {};
const noopRegisterAgentToolResultMiddleware: KovaPluginApi["registerAgentToolResultMiddleware"] =
  () => {};
const noopRegisterDetachedTaskRuntime: KovaPluginApi["registerDetachedTaskRuntime"] = () => {};
const noopRegisterMemoryCapability: KovaPluginApi["registerMemoryCapability"] = () => {};
const noopRegisterMemoryPromptSection: KovaPluginApi["registerMemoryPromptSection"] = () => {};
const noopRegisterMemoryPromptSupplement: KovaPluginApi["registerMemoryPromptSupplement"] =
  () => {};
const noopRegisterMemoryCorpusSupplement: KovaPluginApi["registerMemoryCorpusSupplement"] =
  () => {};
const noopRegisterMemoryFlushPlan: KovaPluginApi["registerMemoryFlushPlan"] = () => {};
const noopRegisterMemoryRuntime: KovaPluginApi["registerMemoryRuntime"] = () => {};
const noopRegisterMemoryEmbeddingProvider: KovaPluginApi["registerMemoryEmbeddingProvider"] =
  () => {};
const noopOn: KovaPluginApi["on"] = () => {};

export function buildPluginApi(params: BuildPluginApiParams): KovaPluginApi {
  const handlers = params.handlers ?? {};
  return {
    id: params.id,
    name: params.name,
    version: params.version,
    description: params.description,
    source: params.source,
    rootDir: params.rootDir,
    registrationMode: params.registrationMode,
    config: params.config,
    pluginConfig: params.pluginConfig,
    runtime: params.runtime,
    logger: params.logger,
    registerTool: handlers.registerTool ?? noopRegisterTool,
    registerHook: handlers.registerHook ?? noopRegisterHook,
    registerHttpRoute: handlers.registerHttpRoute ?? noopRegisterHttpRoute,
    registerChannel: handlers.registerChannel ?? noopRegisterChannel,
    registerGatewayMethod: handlers.registerGatewayMethod ?? noopRegisterGatewayMethod,
    registerCli: handlers.registerCli ?? noopRegisterCli,
    registerReload: handlers.registerReload ?? noopRegisterReload,
    registerNodeHostCommand: handlers.registerNodeHostCommand ?? noopRegisterNodeHostCommand,
    registerSecurityAuditCollector:
      handlers.registerSecurityAuditCollector ?? noopRegisterSecurityAuditCollector,
    registerService: handlers.registerService ?? noopRegisterService,
    registerGatewayDiscoveryService:
      handlers.registerGatewayDiscoveryService ?? noopRegisterGatewayDiscoveryService,
    registerCliBackend: handlers.registerCliBackend ?? noopRegisterCliBackend,
    registerTextTransforms: handlers.registerTextTransforms ?? noopRegisterTextTransforms,
    registerConfigMigration: handlers.registerConfigMigration ?? noopRegisterConfigMigration,
    registerMigrationProvider: handlers.registerMigrationProvider ?? noopRegisterMigrationProvider,
    registerAutoEnableProbe: handlers.registerAutoEnableProbe ?? noopRegisterAutoEnableProbe,
    registerProvider: handlers.registerProvider ?? noopRegisterProvider,
    registerSpeechProvider: handlers.registerSpeechProvider ?? noopRegisterSpeechProvider,
    registerRealtimeTranscriptionProvider:
      handlers.registerRealtimeTranscriptionProvider ?? noopRegisterRealtimeTranscriptionProvider,
    registerRealtimeVoiceProvider:
      handlers.registerRealtimeVoiceProvider ?? noopRegisterRealtimeVoiceProvider,
    registerMediaUnderstandingProvider:
      handlers.registerMediaUnderstandingProvider ?? noopRegisterMediaUnderstandingProvider,
    registerImageGenerationProvider:
      handlers.registerImageGenerationProvider ?? noopRegisterImageGenerationProvider,
    registerVideoGenerationProvider:
      handlers.registerVideoGenerationProvider ?? noopRegisterVideoGenerationProvider,
    registerMusicGenerationProvider:
      handlers.registerMusicGenerationProvider ?? noopRegisterMusicGenerationProvider,
    registerWebFetchProvider: handlers.registerWebFetchProvider ?? noopRegisterWebFetchProvider,
    registerWebSearchProvider: handlers.registerWebSearchProvider ?? noopRegisterWebSearchProvider,
    registerInteractiveHandler:
      handlers.registerInteractiveHandler ?? noopRegisterInteractiveHandler,
    onConversationBindingResolved:
      handlers.onConversationBindingResolved ?? noopOnConversationBindingResolved,
    registerCommand: handlers.registerCommand ?? noopRegisterCommand,
    registerContextEngine: handlers.registerContextEngine ?? noopRegisterContextEngine,
    registerCompactionProvider:
      handlers.registerCompactionProvider ?? noopRegisterCompactionProvider,
    registerAgentHarness: handlers.registerAgentHarness ?? noopRegisterAgentHarness,
    registerCodexAppServerExtensionFactory:
      handlers.registerCodexAppServerExtensionFactory ?? noopRegisterCodexAppServerExtensionFactory,
    registerAgentToolResultMiddleware:
      handlers.registerAgentToolResultMiddleware ?? noopRegisterAgentToolResultMiddleware,
    registerDetachedTaskRuntime:
      handlers.registerDetachedTaskRuntime ?? noopRegisterDetachedTaskRuntime,
    registerMemoryCapability: handlers.registerMemoryCapability ?? noopRegisterMemoryCapability,
    registerMemoryPromptSection:
      handlers.registerMemoryPromptSection ?? noopRegisterMemoryPromptSection,
    registerMemoryPromptSupplement:
      handlers.registerMemoryPromptSupplement ?? noopRegisterMemoryPromptSupplement,
    registerMemoryCorpusSupplement:
      handlers.registerMemoryCorpusSupplement ?? noopRegisterMemoryCorpusSupplement,
    registerMemoryFlushPlan: handlers.registerMemoryFlushPlan ?? noopRegisterMemoryFlushPlan,
    registerMemoryRuntime: handlers.registerMemoryRuntime ?? noopRegisterMemoryRuntime,
    registerMemoryEmbeddingProvider:
      handlers.registerMemoryEmbeddingProvider ?? noopRegisterMemoryEmbeddingProvider,
    resolvePath: params.resolvePath,
    on: handlers.on ?? noopOn,
  };
}
