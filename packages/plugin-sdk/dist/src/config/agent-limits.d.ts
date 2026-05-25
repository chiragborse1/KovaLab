import type { KovaConfig } from "./types.js";
export declare const DEFAULT_AGENT_MAX_CONCURRENT = 4;
export declare const DEFAULT_SUBAGENT_MAX_CONCURRENT = 8;
export declare const DEFAULT_SUBAGENT_MAX_CHILDREN_PER_AGENT = 5;
export declare const DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1;
export declare function resolveAgentMaxConcurrent(cfg?: KovaConfig): number;
export declare function resolveSubagentMaxConcurrent(cfg?: KovaConfig): number;
