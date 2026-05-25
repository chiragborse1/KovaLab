import type { KovaConfig } from "../config/types.kova.js";
import { getCurrentPluginMetadataSnapshotState } from "./current-plugin-metadata-state.js";
import { type ResolvePluginControlPlaneContextParams } from "./plugin-control-plane-context.js";
import type { PluginMetadataSnapshot } from "./plugin-metadata-snapshot.types.js";
type CurrentPluginMetadataSnapshotState = ReturnType<typeof getCurrentPluginMetadataSnapshotState>;
export declare function resolvePluginMetadataControlPlaneFingerprint(config?: KovaConfig, options?: Omit<ResolvePluginControlPlaneContextParams, "config">): string;
export declare function setCurrentPluginMetadataSnapshot(snapshot: PluginMetadataSnapshot | undefined, options?: {
    config?: KovaConfig;
    compatibleConfigs?: readonly KovaConfig[];
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
}): void;
export declare function clearCurrentPluginMetadataSnapshot(): void;
export declare function captureCurrentPluginMetadataSnapshotState(): CurrentPluginMetadataSnapshotState;
export declare function restoreCurrentPluginMetadataSnapshotState(state: CurrentPluginMetadataSnapshotState): void;
export declare function getCurrentPluginMetadataSnapshot(params?: {
    config?: KovaConfig;
    env?: NodeJS.ProcessEnv;
    workspaceDir?: string;
    allowWorkspaceScopedSnapshot?: boolean;
    requireDefaultDiscoveryContext?: boolean;
}): PluginMetadataSnapshot | undefined;
export {};
