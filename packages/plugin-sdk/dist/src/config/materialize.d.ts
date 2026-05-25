import type { KovaConfig, ResolvedSourceConfig, RuntimeConfig } from "./types.js";
export type ConfigMaterializationMode = "load" | "missing" | "snapshot";
export declare function asResolvedSourceConfig(config: KovaConfig): ResolvedSourceConfig;
export declare function asRuntimeConfig(config: KovaConfig): RuntimeConfig;
export declare function materializeRuntimeConfig(config: KovaConfig, mode: ConfigMaterializationMode): RuntimeConfig;
