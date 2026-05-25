import { type ModelRef } from "../../agents/model-selection.js";
import type { KovaConfig } from "../../config/types.kova.js";
export type ModelPickerCatalogEntry = {
    provider: string;
    id: string;
    name?: string;
};
export type ModelPickerItem = ModelRef;
export declare function buildModelPickerItems(catalog: ModelPickerCatalogEntry[]): ModelPickerItem[];
export declare function resolveProviderEndpointLabel(provider: string, cfg: KovaConfig): {
    endpoint?: string;
    api?: string;
};
