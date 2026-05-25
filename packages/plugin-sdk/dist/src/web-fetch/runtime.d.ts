import type { KovaConfig } from "../config/types.js";
import type { PluginWebFetchProviderEntry, WebFetchProviderToolDefinition } from "../plugins/types.js";
import type { RuntimeWebFetchMetadata } from "../secrets/runtime-web-tools.types.js";
type WebFetchConfig = NonNullable<KovaConfig["tools"]>["web"] extends infer Web ? Web extends {
    fetch?: infer Fetch;
} ? Fetch : undefined : undefined;
export type ResolveWebFetchDefinitionParams = {
    config?: KovaConfig;
    sandboxed?: boolean;
    runtimeWebFetch?: RuntimeWebFetchMetadata;
    providerId?: string;
    preferRuntimeProviders?: boolean;
};
export declare function resolveWebFetchEnabled(params: {
    fetch?: WebFetchConfig;
    sandboxed?: boolean;
}): boolean;
export declare function isWebFetchProviderConfigured(params: {
    provider: Pick<PluginWebFetchProviderEntry, "envVars" | "getConfiguredCredentialValue" | "getCredentialValue" | "requiresCredential">;
    config?: KovaConfig;
}): boolean;
export declare function listWebFetchProviders(params?: {
    config?: KovaConfig;
}): PluginWebFetchProviderEntry[];
export declare function listConfiguredWebFetchProviders(params?: {
    config?: KovaConfig;
}): PluginWebFetchProviderEntry[];
export declare function resolveWebFetchProviderId(params: {
    fetch?: WebFetchConfig;
    config?: KovaConfig;
    providers?: PluginWebFetchProviderEntry[];
}): string;
export declare function resolveWebFetchDefinition(options?: ResolveWebFetchDefinitionParams): {
    provider: PluginWebFetchProviderEntry;
    definition: WebFetchProviderToolDefinition;
} | null;
export {};
