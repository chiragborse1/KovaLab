import type { KovaConfig } from "../config/types.kova.js";
import type { RuntimeEnv } from "../runtime.js";
export declare function createQuietRuntime(runtime: RuntimeEnv): RuntimeEnv;
export declare function requireValidConfigFileSnapshot(runtime: RuntimeEnv): Promise<import("../config/types.kova.js").ConfigFileSnapshot | null>;
export declare function requireValidConfig(runtime: RuntimeEnv): Promise<KovaConfig | null>;
/** Purge session store entries for a deleted agent (#65524). Best-effort. */
export declare function purgeAgentSessionStoreEntries(cfg: KovaConfig, agentId: string): Promise<void>;
