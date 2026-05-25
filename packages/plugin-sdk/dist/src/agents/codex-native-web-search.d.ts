import type { KovaConfig } from "../config/types.kova.js";
import type { CodexNativeSearchMode } from "./codex-native-web-search.shared.js";
export { type CodexNativeSearchContextSize, type CodexNativeSearchMode, type CodexNativeSearchUserLocation, describeCodexNativeWebSearch, type ResolvedCodexNativeWebSearchConfig, resolveCodexNativeWebSearchConfig, } from "./codex-native-web-search.shared.js";
export type CodexNativeSearchActivation = {
    globalWebSearchEnabled: boolean;
    codexNativeEnabled: boolean;
    codexMode: CodexNativeSearchMode;
    nativeEligible: boolean;
    hasRequiredAuth: boolean;
    state: "managed_only" | "native_active";
    inactiveReason?: "globally_disabled" | "codex_not_enabled" | "model_not_eligible" | "codex_auth_missing";
};
export type CodexNativeSearchPayloadPatchResult = {
    status: "payload_not_object" | "native_tool_already_present" | "injected";
};
export declare function isCodexNativeSearchEligibleModel(params: {
    modelProvider?: string;
    modelApi?: string;
}): boolean;
export declare function hasCodexNativeWebSearchTool(tools: unknown): boolean;
export declare function hasAvailableCodexAuth(params: {
    config?: KovaConfig;
    agentDir?: string;
}): boolean;
export declare function resolveCodexNativeSearchActivation(params: {
    config?: KovaConfig;
    modelProvider?: string;
    modelApi?: string;
    agentDir?: string;
}): CodexNativeSearchActivation;
export declare function buildCodexNativeWebSearchTool(config: KovaConfig | undefined): Record<string, unknown>;
export declare function patchCodexNativeWebSearchPayload(params: {
    payload: unknown;
    config?: KovaConfig;
}): CodexNativeSearchPayloadPatchResult;
export declare function shouldSuppressManagedWebSearchTool(params: {
    config?: KovaConfig;
    modelProvider?: string;
    modelApi?: string;
    agentDir?: string;
}): boolean;
export declare function isCodexNativeWebSearchRelevant(params: {
    config: KovaConfig;
    agentId?: string;
    agentDir?: string;
}): boolean;
