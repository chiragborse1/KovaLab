import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveDiagnosticFlags(cfg?: KovaConfig, env?: NodeJS.ProcessEnv): string[];
export declare function matchesDiagnosticFlag(flag: string, enabledFlags: string[]): boolean;
export declare function isDiagnosticFlagEnabled(flag: string, cfg?: KovaConfig, env?: NodeJS.ProcessEnv): boolean;
