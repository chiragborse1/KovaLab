import type { KovaConfig } from "../config/types.kova.js";
import type { ProviderConfig } from "./models-config.providers.secrets.js";
type ImplicitProviderParams = {
    agentDir: string;
    config?: KovaConfig;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
    explicitProviders?: Record<string, ProviderConfig> | null;
    providerDiscoveryProviderIds?: readonly string[];
    providerDiscoveryTimeoutMs?: number;
    providerDiscoveryEntriesOnly?: boolean;
};
export declare function resolveProviderDiscoveryFilterForTest(params: {
    config?: KovaConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
    resolveOwners?: (provider: string) => readonly string[] | undefined;
    providerIds?: readonly string[];
}): string[] | undefined;
export declare function resolveImplicitProviders(params: ImplicitProviderParams): Promise<NonNullable<KovaConfig["models"]>["providers"]>;
export {};
