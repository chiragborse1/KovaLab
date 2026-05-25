import type { KovaConfig } from "./types.js";
export declare function collectConfigRuntimeEnvVars(cfg?: KovaConfig): Record<string, string>;
export declare function collectConfigServiceEnvVars(cfg?: KovaConfig): Record<string, string>;
/** @deprecated Use `collectConfigRuntimeEnvVars` or `collectConfigServiceEnvVars`. */
export declare function collectConfigEnvVars(cfg?: KovaConfig): Record<string, string>;
export declare function createConfigRuntimeEnv(cfg: KovaConfig, baseEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export declare function applyConfigEnvVars(cfg: KovaConfig, env?: NodeJS.ProcessEnv): void;
