import type { SessionCompactionCheckpoint, SessionEntry } from "../config/sessions.js";
import { ErrorCodes, type ErrorShape } from "./protocol/index.js";
type CheckpointActionErrorCode = typeof ErrorCodes.INVALID_REQUEST | typeof ErrorCodes.UNAVAILABLE;
export type SessionCheckpointBranchResult = {
    sourceKey: string;
    key: string;
    sessionId: string;
    checkpoint: SessionCompactionCheckpoint;
    entry: SessionEntry;
};
export type SessionCheckpointRestoreResult = {
    key: string;
    sessionId: string;
    checkpoint: SessionCompactionCheckpoint;
    entry: SessionEntry;
};
export declare class SessionCheckpointActionError extends Error {
    readonly code: CheckpointActionErrorCode;
    constructor(code: CheckpointActionErrorCode, message: string);
}
export declare function toSessionCheckpointActionErrorShape(error: unknown): ErrorShape;
export declare function buildCheckpointBranchSessionKey(agentId: string): string;
export declare function cloneCheckpointSessionEntry(params: {
    currentEntry: SessionEntry;
    nextSessionId: string;
    nextSessionFile: string;
    label?: string;
    parentSessionKey?: string;
    totalTokens?: number;
    preserveCompactionCheckpoints?: boolean;
}): SessionEntry;
export declare function branchSessionCompactionCheckpoint(params: {
    key: string;
    checkpointId: string;
}): Promise<SessionCheckpointBranchResult>;
export declare function restoreSessionCompactionCheckpoint(params: {
    key: string;
    checkpointId: string;
}): Promise<SessionCheckpointRestoreResult>;
export {};
