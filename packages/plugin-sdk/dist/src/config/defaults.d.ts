import type { KovaConfig } from "./types.kova.js";
type WarnState = {
    warned: boolean;
};
export declare function resolveNormalizedProviderModelMaxTokens(params: {
    providerId: string;
    modelId: string;
    contextWindow: number;
    rawMaxTokens: number;
}): number;
export type SessionDefaultsOptions = {
    warn?: (message: string) => void;
    warnState?: WarnState;
};
export declare function applyMessageDefaults(cfg: KovaConfig): KovaConfig;
export declare function applySessionDefaults(cfg: KovaConfig, options?: SessionDefaultsOptions): KovaConfig;
export declare function applyTalkConfigNormalization(config: KovaConfig): KovaConfig;
export declare function applyModelDefaults(cfg: KovaConfig): KovaConfig;
export declare function applyAgentDefaults(cfg: KovaConfig): KovaConfig;
export declare function applyLoggingDefaults(cfg: KovaConfig): KovaConfig;
export declare function applyContextPruningDefaults(cfg: KovaConfig): KovaConfig;
export declare function applyCompactionDefaults(cfg: KovaConfig): KovaConfig;
export declare function resetSessionDefaultsWarningForTests(): void;
export {};
