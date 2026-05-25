import type { KovaConfig } from "../config/types.kova.js";
export type OwnerDisplaySetting = {
    ownerDisplay?: "raw" | "hash";
    ownerDisplaySecret?: string;
};
export type OwnerDisplaySecretResolution = {
    config: KovaConfig;
    generatedSecret?: string;
};
/**
 * Resolve owner display settings for prompt rendering.
 * Keep auth secrets decoupled from owner hash secrets.
 */
export declare function resolveOwnerDisplaySetting(config?: KovaConfig): OwnerDisplaySetting;
/**
 * Ensure hash mode has a dedicated secret.
 * Returns updated config and generated secret when autofill was needed.
 */
export declare function ensureOwnerDisplaySecret(config: KovaConfig, generateSecret?: () => string): OwnerDisplaySecretResolution;
