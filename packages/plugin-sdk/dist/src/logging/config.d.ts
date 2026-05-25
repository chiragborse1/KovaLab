import type { KovaConfig } from "../config/types.kova.js";
type LoggingConfig = KovaConfig["logging"];
export declare function shouldSkipMutatingLoggingConfigRead(argv?: string[]): boolean;
export declare function readLoggingConfig(): LoggingConfig | undefined;
export {};
