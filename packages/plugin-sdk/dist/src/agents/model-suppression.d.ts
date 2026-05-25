import type { KovaConfig } from "../config/types.kova.js";
export declare function shouldSuppressBuiltInModel(params: {
    provider?: string | null;
    id?: string | null;
    baseUrl?: string | null;
    config?: KovaConfig;
}): boolean;
export declare function buildSuppressedBuiltInModelError(params: {
    provider?: string | null;
    id?: string | null;
    baseUrl?: string | null;
    config?: KovaConfig;
}): string | undefined;
