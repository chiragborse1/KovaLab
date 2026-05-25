import type { KovaConfig } from "../config/types.kova.js";
export declare function getActiveMemorySearchManager(params: {
    cfg: KovaConfig;
    agentId: string;
    purpose?: "default" | "status";
}): Promise<{
    manager: import("./memory-state.js").RegisteredMemorySearchManager | null;
    error?: string;
}>;
export declare function resolveActiveMemoryBackendConfig(params: {
    cfg: KovaConfig;
    agentId: string;
}): import("./memory-state.js").MemoryRuntimeBackendConfig | null;
export declare function closeActiveMemorySearchManagers(cfg?: KovaConfig): Promise<void>;
export declare function closeActiveMemorySearchManager(params: {
    cfg: KovaConfig;
    agentId: string;
}): Promise<void>;
