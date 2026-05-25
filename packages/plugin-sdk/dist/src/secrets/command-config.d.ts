import type { KovaConfig } from "../config/types.kova.js";
export type CommandSecretAssignment = {
    path: string;
    pathSegments: string[];
    value: unknown;
};
export type ResolveAssignmentsFromSnapshotResult = {
    assignments: CommandSecretAssignment[];
    diagnostics: string[];
};
export type UnresolvedCommandSecretAssignment = {
    path: string;
    pathSegments: string[];
};
export type AnalyzeAssignmentsFromSnapshotResult = {
    assignments: CommandSecretAssignment[];
    diagnostics: string[];
    unresolved: UnresolvedCommandSecretAssignment[];
    inactive: UnresolvedCommandSecretAssignment[];
};
export declare function analyzeCommandSecretAssignmentsFromSnapshot(params: {
    sourceConfig: KovaConfig;
    resolvedConfig: KovaConfig;
    targetIds: ReadonlySet<string>;
    inactiveRefPaths?: ReadonlySet<string>;
    allowedPaths?: ReadonlySet<string>;
}): AnalyzeAssignmentsFromSnapshotResult;
export declare function collectCommandSecretAssignmentsFromSnapshot(params: {
    sourceConfig: KovaConfig;
    resolvedConfig: KovaConfig;
    commandName: string;
    targetIds: ReadonlySet<string>;
    inactiveRefPaths?: ReadonlySet<string>;
    allowedPaths?: ReadonlySet<string>;
}): ResolveAssignmentsFromSnapshotResult;
