import type { KovaConfig } from "../config/types.kova.js";
import type { ModelCatalogEntry } from "./model-catalog.types.js";
import { type ModelRef } from "./model-selection-normalize.js";
export type ModelAliasIndex = {
    byAlias: Map<string, {
        alias: string;
        ref: ModelRef;
    }>;
    byKey: Map<string, string[]>;
};
export declare function inferUniqueProviderFromConfiguredModels(params: {
    cfg: KovaConfig;
    model: string;
}): string | undefined;
export declare function inferUniqueProviderFromCatalog(params: {
    catalog: readonly ModelCatalogEntry[];
    model: string;
}): string | undefined;
export declare function resolveBareModelDefaultProvider(params: {
    cfg: KovaConfig;
    catalog: readonly ModelCatalogEntry[];
    model: string;
    defaultProvider: string;
}): string;
export declare function resolveConfiguredOpenRouterCompatAlias(params: {
    cfg?: KovaConfig;
    raw: string;
    defaultProvider: string;
    allowPluginNormalization?: boolean;
}): ModelRef | null;
export declare function parseModelRefWithCompatAlias(params: {
    cfg?: KovaConfig;
    raw: string;
    defaultProvider: string;
    allowPluginNormalization?: boolean;
}): ModelRef | null;
export declare function resolveAllowlistModelKey(params: {
    cfg?: KovaConfig;
    raw: string;
    defaultProvider: string;
}): string | null;
export declare function buildConfiguredAllowlistKeys(params: {
    cfg: KovaConfig | undefined;
    defaultProvider: string;
}): Set<string> | null;
export declare function buildModelAliasIndex(params: {
    cfg: KovaConfig;
    defaultProvider: string;
    allowPluginNormalization?: boolean;
}): ModelAliasIndex;
export declare function resolveModelRefFromString(params: {
    cfg?: KovaConfig;
    raw: string;
    defaultProvider: string;
    aliasIndex?: ModelAliasIndex;
    allowPluginNormalization?: boolean;
}): {
    ref: ModelRef;
    alias?: string;
} | null;
export declare function resolveConfiguredModelRef(params: {
    cfg: KovaConfig;
    defaultProvider: string;
    defaultModel: string;
    allowPluginNormalization?: boolean;
}): ModelRef;
export declare function buildAllowedModelSetWithFallbacks(params: {
    cfg: KovaConfig;
    catalog: ModelCatalogEntry[];
    defaultProvider: string;
    defaultModel?: string;
    fallbackModels: readonly string[];
}): {
    allowAny: boolean;
    allowedCatalog: ModelCatalogEntry[];
    allowedKeys: Set<string>;
};
export type ModelRefStatus = {
    key: string;
    inCatalog: boolean;
    allowAny: boolean;
    allowed: boolean;
};
export type ResolveAllowedModelRefResult = {
    ref: ModelRef;
    key: string;
} | {
    error: string;
};
export declare function getModelRefStatusFromAllowedSet(params: {
    catalog: ModelCatalogEntry[];
    ref: ModelRef;
    allowed: {
        allowAny: boolean;
        allowedKeys: Set<string>;
    };
}): ModelRefStatus;
export declare function getModelRefStatusWithFallbackModels(params: {
    cfg: KovaConfig;
    catalog: ModelCatalogEntry[];
    ref: ModelRef;
    defaultProvider: string;
    defaultModel?: string;
    fallbackModels: readonly string[];
}): ModelRefStatus;
export declare function resolveAllowedModelRefFromAliasIndex(params: {
    cfg: KovaConfig;
    raw: string;
    defaultProvider: string;
    aliasIndex: ModelAliasIndex;
    getStatus: (ref: ModelRef) => ModelRefStatus;
}): ResolveAllowedModelRefResult;
export declare function buildConfiguredModelCatalog(params: {
    cfg: KovaConfig;
}): ModelCatalogEntry[];
export declare function resolveHooksGmailModel(params: {
    cfg: KovaConfig;
    defaultProvider: string;
}): ModelRef | null;
export declare function normalizeModelSelection(value: unknown): string | undefined;
