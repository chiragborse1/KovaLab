import type { KovaConfig } from "../config/types.kova.js";
import { type ProviderConfig } from "./models-config.providers.js";
export type ResolveImplicitProvidersForModelsJson = (params: {
    agentDir: string;
    config: KovaConfig;
    env: NodeJS.ProcessEnv;
    workspaceDir?: string;
    explicitProviders: Record<string, ProviderConfig>;
    providerDiscoveryProviderIds?: readonly string[];
    providerDiscoveryTimeoutMs?: number;
    providerDiscoveryEntriesOnly?: boolean;
}) => Promise<Record<string, ProviderConfig>>;
export type ModelsJsonPlan = {
    action: "skip";
} | {
    action: "noop";
} | {
    action: "write";
    contents: string;
};
export declare function resolveProvidersForModelsJsonWithDeps(params: {
    cfg: KovaConfig;
    agentDir: string;
    env: NodeJS.ProcessEnv;
    workspaceDir?: string;
    providerDiscoveryProviderIds?: readonly string[];
    providerDiscoveryTimeoutMs?: number;
    providerDiscoveryEntriesOnly?: boolean;
}, deps?: {
    resolveImplicitProviders?: ResolveImplicitProvidersForModelsJson;
}): Promise<Record<string, ProviderConfig>>;
export declare function planKovaModelsJsonWithDeps(params: {
    cfg: KovaConfig;
    sourceConfigForSecrets?: KovaConfig;
    agentDir: string;
    env: NodeJS.ProcessEnv;
    workspaceDir?: string;
    existingRaw: string;
    existingParsed: unknown;
    providerDiscoveryProviderIds?: readonly string[];
    providerDiscoveryTimeoutMs?: number;
    providerDiscoveryEntriesOnly?: boolean;
}, deps?: {
    resolveImplicitProviders?: ResolveImplicitProvidersForModelsJson;
}): Promise<ModelsJsonPlan>;
export declare function planKovaModelsJson(params: Parameters<typeof planKovaModelsJsonWithDeps>[0]): Promise<ModelsJsonPlan>;
