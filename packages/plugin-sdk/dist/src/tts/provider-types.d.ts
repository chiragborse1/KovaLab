import type { TalkProviderConfig } from "../config/types.gateway.js";
import type { KovaConfig } from "../config/types.js";
import type { ResolvedTtsPersona } from "../config/types.tts.js";
export type SpeechProviderId = string;
export type SpeechSynthesisTarget = "audio-file" | "voice-note" | "telephony";
export type SpeechProviderConfig = Record<string, unknown>;
export type SpeechProviderOverrides = Record<string, unknown>;
export type SpeechModelOverridePolicy = {
    enabled: boolean;
    allowText: boolean;
    allowProvider: boolean;
    allowVoice: boolean;
    allowModelId: boolean;
    allowVoiceSettings: boolean;
    allowNormalization: boolean;
    allowSeed: boolean;
};
export type TtsDirectiveOverrides = {
    ttsText?: string;
    provider?: SpeechProviderId;
    providerOverrides?: Record<string, SpeechProviderOverrides>;
};
export type TtsDirectiveParseResult = {
    cleanedText: string;
    ttsText?: string;
    hasDirective: boolean;
    overrides: TtsDirectiveOverrides;
    warnings: string[];
};
export type SpeechProviderConfiguredContext = {
    cfg?: KovaConfig;
    providerConfig: SpeechProviderConfig;
    timeoutMs: number;
};
export type SpeechSynthesisRequest = {
    text: string;
    cfg: KovaConfig;
    providerConfig: SpeechProviderConfig;
    target: SpeechSynthesisTarget;
    providerOverrides?: SpeechProviderOverrides;
    timeoutMs: number;
};
export type SpeechSynthesisResult = {
    audioBuffer: Buffer;
    outputFormat: string;
    fileExtension: string;
    voiceCompatible: boolean;
};
export type SpeechTelephonySynthesisRequest = {
    text: string;
    cfg: KovaConfig;
    providerConfig: SpeechProviderConfig;
    providerOverrides?: SpeechProviderOverrides;
    timeoutMs: number;
};
export type SpeechTelephonySynthesisResult = {
    audioBuffer: Buffer;
    outputFormat: string;
    sampleRate: number;
};
export type SpeechProviderPrepareSynthesisContext = {
    text: string;
    cfg: KovaConfig;
    providerConfig: SpeechProviderConfig;
    providerOverrides?: SpeechProviderOverrides;
    persona?: ResolvedTtsPersona;
    personaProviderConfig?: SpeechProviderConfig;
    target: SpeechSynthesisTarget;
    timeoutMs: number;
};
export type SpeechProviderPreparedSynthesis = {
    text?: string;
    providerConfig?: SpeechProviderConfig;
    providerOverrides?: SpeechProviderOverrides;
};
export type SpeechVoiceOption = {
    id: string;
    name?: string;
    category?: string;
    description?: string;
    locale?: string;
    gender?: string;
    personalities?: string[];
};
export type SpeechListVoicesRequest = {
    cfg?: KovaConfig;
    providerConfig?: SpeechProviderConfig;
    apiKey?: string;
    baseUrl?: string;
};
export type SpeechProviderResolveConfigContext = {
    cfg: KovaConfig;
    rawConfig: Record<string, unknown>;
    timeoutMs: number;
};
export type SpeechDirectiveTokenParseContext = {
    key: string;
    value: string;
    policy: SpeechModelOverridePolicy;
    selectedProvider?: SpeechProviderId;
    providerConfig?: SpeechProviderConfig;
    currentOverrides?: SpeechProviderOverrides;
};
export type SpeechDirectiveTokenParseResult = {
    handled: boolean;
    overrides?: SpeechProviderOverrides;
    warnings?: string[];
};
export type SpeechProviderResolveTalkConfigContext = {
    cfg: KovaConfig;
    baseTtsConfig: Record<string, unknown>;
    talkProviderConfig: TalkProviderConfig;
    timeoutMs: number;
};
export type SpeechProviderResolveTalkOverridesContext = {
    talkProviderConfig: TalkProviderConfig;
    params: Record<string, unknown>;
};
