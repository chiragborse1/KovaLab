import { type ConfigFileSnapshot, type KovaConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
export declare function requireValidConfigFileSnapshot(runtime: RuntimeEnv, opts?: {
    includeCompatibilityAdvisory?: boolean;
}): Promise<ConfigFileSnapshot | null>;
export declare function requireValidConfigSnapshot(runtime: RuntimeEnv, opts?: {
    includeCompatibilityAdvisory?: boolean;
}): Promise<KovaConfig | null>;
