import type { KovaConfig } from "../config/types.kova.js";
import type { CodexAppServerExtensionFactory } from "./codex-app-server-extension-types.js";
import type { MemoryEmbeddingProviderAdapter } from "./memory-embedding-providers.js";
import type { PluginAgentToolResultMiddlewareRegistration } from "./registry-types.js";
import type { AnyAgentTool, AgentHarness, CliBackendPlugin, KovaPluginApi, ImageGenerationProviderPlugin, MediaUnderstandingProviderPlugin, MigrationProviderPlugin, MusicGenerationProviderPlugin, KovaPluginCliCommandDescriptor, KovaPluginCliRegistrar, PluginTextTransformRegistration, ProviderPlugin, RealtimeTranscriptionProviderPlugin, RealtimeVoiceProviderPlugin, SpeechProviderPlugin, VideoGenerationProviderPlugin, WebFetchProviderPlugin, WebSearchProviderPlugin } from "./types.js";
type CapturedPluginCliRegistration = {
    register: KovaPluginCliRegistrar;
    commands: string[];
    descriptors: KovaPluginCliCommandDescriptor[];
};
export type CapturedPluginRegistration = {
    api: KovaPluginApi;
    providers: ProviderPlugin[];
    agentHarnesses: AgentHarness[];
    cliRegistrars: CapturedPluginCliRegistration[];
    cliBackends: CliBackendPlugin[];
    textTransforms: PluginTextTransformRegistration[];
    codexAppServerExtensionFactories: CodexAppServerExtensionFactory[];
    agentToolResultMiddlewares: PluginAgentToolResultMiddlewareRegistration[];
    speechProviders: SpeechProviderPlugin[];
    realtimeTranscriptionProviders: RealtimeTranscriptionProviderPlugin[];
    realtimeVoiceProviders: RealtimeVoiceProviderPlugin[];
    mediaUnderstandingProviders: MediaUnderstandingProviderPlugin[];
    imageGenerationProviders: ImageGenerationProviderPlugin[];
    videoGenerationProviders: VideoGenerationProviderPlugin[];
    musicGenerationProviders: MusicGenerationProviderPlugin[];
    webFetchProviders: WebFetchProviderPlugin[];
    webSearchProviders: WebSearchProviderPlugin[];
    migrationProviders: MigrationProviderPlugin[];
    memoryEmbeddingProviders: MemoryEmbeddingProviderAdapter[];
    tools: AnyAgentTool[];
};
export declare function createCapturedPluginRegistration(params?: {
    config?: KovaConfig;
    registrationMode?: KovaPluginApi["registrationMode"];
}): CapturedPluginRegistration;
export declare function capturePluginRegistration(params: {
    register(api: KovaPluginApi): void;
}): CapturedPluginRegistration;
export {};
