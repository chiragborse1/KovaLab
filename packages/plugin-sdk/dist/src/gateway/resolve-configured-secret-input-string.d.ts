import type { KovaConfig } from "../config/types.kova.js";
export type SecretInputUnresolvedReasonStyle = "generic" | "detailed";
export type ConfiguredSecretInputSource = "config" | "secretRef" | "fallback";
export declare function resolveConfiguredSecretInputString(params: {
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
    value: unknown;
    path: string;
    unresolvedReasonStyle?: SecretInputUnresolvedReasonStyle;
}): Promise<{
    value?: string;
    unresolvedRefReason?: string;
}>;
export declare function resolveConfiguredSecretInputWithFallback(params: {
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
    value: unknown;
    path: string;
    unresolvedReasonStyle?: SecretInputUnresolvedReasonStyle;
    readFallback?: () => string | undefined;
}): Promise<{
    value?: string;
    source?: ConfiguredSecretInputSource;
    unresolvedRefReason?: string;
    secretRefConfigured: boolean;
}>;
export declare function resolveRequiredConfiguredSecretRefInputString(params: {
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
    value: unknown;
    path: string;
    unresolvedReasonStyle?: SecretInputUnresolvedReasonStyle;
}): Promise<string | undefined>;
