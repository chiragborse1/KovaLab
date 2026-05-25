import type { KovaConfig } from "../config/types.js";
import type { TtsConfig, TtsMode } from "../config/types.tts.js";
export { normalizeTtsAutoMode } from "./tts-auto-mode.js";
export type TtsConfigResolutionContext = {
    agentId?: string;
    channelId?: string;
    accountId?: string;
};
export declare function resolveEffectiveTtsConfig(cfg: KovaConfig, contextOrAgentId?: string | TtsConfigResolutionContext): TtsConfig;
export declare function resolveConfiguredTtsMode(cfg: KovaConfig, contextOrAgentId?: string | TtsConfigResolutionContext): TtsMode;
export declare function shouldAttemptTtsPayload(params: {
    cfg: KovaConfig;
    ttsAuto?: string;
    agentId?: string;
    channelId?: string;
    accountId?: string;
}): boolean;
export declare function shouldCleanTtsDirectiveText(params: {
    cfg: KovaConfig;
    ttsAuto?: string;
    agentId?: string;
    channelId?: string;
    accountId?: string;
}): boolean;
