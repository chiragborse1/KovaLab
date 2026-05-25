import type { KovaConfig } from "../config/types.kova.js";
import type { RuntimeEnv } from "../runtime.js";
export declare function resolveAgentRuntimeConfig(runtime: RuntimeEnv, params?: {
    runtimeTargetsChannelSecrets?: boolean;
}): Promise<{
    loadedRaw: KovaConfig;
    sourceConfig: KovaConfig;
    cfg: KovaConfig;
}>;
