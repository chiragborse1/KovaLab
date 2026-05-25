import type { KovaConfig } from "./types.js";
export type RuntimeConfigSnapshotRefreshParams = {
    sourceConfig: KovaConfig;
};
export type ConfigWriteAfterWrite = {
    mode: "auto";
} | {
    mode: "restart";
    reason: string;
} | {
    mode: "none";
    reason: string;
};
export type ConfigWriteFollowUp = {
    mode: "auto";
    requiresRestart: false;
} | {
    mode: "none";
    reason: string;
    requiresRestart: false;
} | {
    mode: "restart";
    reason: string;
    requiresRestart: true;
};
export declare function resolveConfigWriteAfterWrite(afterWrite?: ConfigWriteAfterWrite): ConfigWriteAfterWrite;
export declare function resolveConfigWriteFollowUp(afterWrite?: ConfigWriteAfterWrite): ConfigWriteFollowUp;
export type RuntimeConfigSnapshotRefreshHandler = {
    refresh: (params: RuntimeConfigSnapshotRefreshParams) => boolean | Promise<boolean>;
    clearOnRefreshFailure?: () => void;
};
export type RuntimeConfigWriteNotification = {
    configPath: string;
    sourceConfig: KovaConfig;
    runtimeConfig: KovaConfig;
    persistedHash: string;
    revision: number;
    fingerprint: string;
    sourceFingerprint: string | null;
    writtenAtMs: number;
    afterWrite?: ConfigWriteAfterWrite;
};
export type RuntimeConfigSnapshotMetadata = {
    revision: number;
    fingerprint: string;
    sourceFingerprint: string | null;
    updatedAtMs: number;
};
export declare function hashRuntimeConfigValue(value: KovaConfig): string;
export declare function setRuntimeConfigSnapshot(config: KovaConfig, sourceConfig?: KovaConfig): void;
export declare function resetConfigRuntimeState(): void;
export declare function clearRuntimeConfigSnapshot(): void;
export declare function getRuntimeConfigSnapshot(): KovaConfig | null;
export declare function getRuntimeConfigSourceSnapshot(): KovaConfig | null;
export declare function getRuntimeConfigSnapshotMetadata(): RuntimeConfigSnapshotMetadata | null;
export declare function resolveRuntimeConfigCacheKey(config: KovaConfig): string;
export declare function createRuntimeConfigWriteNotification(params: {
    configPath: string;
    sourceConfig: KovaConfig;
    runtimeConfig: KovaConfig;
    persistedHash: string;
    writtenAtMs?: number;
    afterWrite?: ConfigWriteAfterWrite;
}): RuntimeConfigWriteNotification;
export declare function selectApplicableRuntimeConfig(params: {
    inputConfig?: KovaConfig;
    runtimeConfig?: KovaConfig | null;
    runtimeSourceConfig?: KovaConfig | null;
}): KovaConfig | undefined;
export declare function setRuntimeConfigSnapshotRefreshHandler(refreshHandler: RuntimeConfigSnapshotRefreshHandler | null): void;
export declare function getRuntimeConfigSnapshotRefreshHandler(): RuntimeConfigSnapshotRefreshHandler | null;
export declare function registerRuntimeConfigWriteListener(listener: (event: RuntimeConfigWriteNotification) => void): () => void;
export declare function notifyRuntimeConfigWriteListeners(event: RuntimeConfigWriteNotification): void;
export declare function loadPinnedRuntimeConfig(loadFresh: () => KovaConfig): KovaConfig;
export declare function finalizeRuntimeSnapshotWrite(params: {
    nextSourceConfig: KovaConfig;
    hadRuntimeSnapshot: boolean;
    hadBothSnapshots: boolean;
    loadFreshConfig: () => KovaConfig;
    notifyCommittedWrite: () => void;
    createRefreshError: (detail: string, cause: unknown) => Error;
    formatRefreshError: (error: unknown) => string;
}): Promise<void>;
