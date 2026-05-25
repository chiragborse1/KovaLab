import type { KovaConfig } from "../config/types.js";
export type ProviderModelRef = {
    provider: string;
    model: string;
};
export declare function resolveConfiguredProviderFallback(params: {
    cfg: Pick<KovaConfig, "models">;
    defaultProvider: string;
    defaultModel?: string;
}): ProviderModelRef | null;
