import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import type { SessionCompactionCheckpoint, SessionEntry } from "../config/sessions.js";
import { updateSessionStore } from "../config/sessions.js";
import { formatErrorMessage } from "../infra/errors.js";
import { ErrorCodes, errorShape, type ErrorShape } from "./protocol/index.js";
import { getSessionCompactionCheckpoint } from "./session-compaction-checkpoints.js";
import { loadSessionEntry, resolveGatewaySessionStoreTarget } from "./session-utils.js";

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

export class SessionCheckpointActionError extends Error {
  readonly code: CheckpointActionErrorCode;

  constructor(code: CheckpointActionErrorCode, message: string) {
    super(message);
    this.name = "SessionCheckpointActionError";
    this.code = code;
  }
}

export function toSessionCheckpointActionErrorShape(error: unknown): ErrorShape {
  if (error instanceof SessionCheckpointActionError) {
    return errorShape(error.code, error.message);
  }
  return errorShape(ErrorCodes.UNAVAILABLE, formatErrorMessage(error));
}

export function buildCheckpointBranchSessionKey(agentId: string): string {
  return `agent:${agentId}:checkpoint:${randomUUID()}`;
}

export function cloneCheckpointSessionEntry(params: {
  currentEntry: SessionEntry;
  nextSessionId: string;
  nextSessionFile: string;
  label?: string;
  parentSessionKey?: string;
  totalTokens?: number;
  preserveCompactionCheckpoints?: boolean;
}): SessionEntry {
  return {
    ...params.currentEntry,
    sessionId: params.nextSessionId,
    sessionFile: params.nextSessionFile,
    updatedAt: Date.now(),
    systemSent: false,
    abortedLastRun: false,
    startedAt: undefined,
    endedAt: undefined,
    runtimeMs: undefined,
    status: undefined,
    inputTokens: undefined,
    outputTokens: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
    estimatedCostUsd: undefined,
    totalTokens:
      typeof params.totalTokens === "number" && Number.isFinite(params.totalTokens)
        ? params.totalTokens
        : undefined,
    totalTokensFresh:
      typeof params.totalTokens === "number" && Number.isFinite(params.totalTokens)
        ? true
        : undefined,
    label: params.label ?? params.currentEntry.label,
    parentSessionKey: params.parentSessionKey ?? params.currentEntry.parentSessionKey,
    compactionCheckpoints: params.preserveCompactionCheckpoints
      ? params.currentEntry.compactionCheckpoints
      : undefined,
  };
}

function requireCheckpointId(checkpointId: string): string {
  const normalized = checkpointId.trim();
  if (!normalized) {
    throw new SessionCheckpointActionError(ErrorCodes.INVALID_REQUEST, "checkpointId required");
  }
  return normalized;
}

function requireCheckpoint(params: {
  entry: SessionEntry | undefined;
  checkpointId: string;
}): SessionCompactionCheckpoint {
  const checkpoint = getSessionCompactionCheckpoint({
    entry: params.entry,
    checkpointId: params.checkpointId,
  });
  if (!checkpoint?.preCompaction.sessionFile) {
    throw new SessionCheckpointActionError(
      ErrorCodes.INVALID_REQUEST,
      `checkpoint not found: ${params.checkpointId}`,
    );
  }
  if (!fs.existsSync(checkpoint.preCompaction.sessionFile)) {
    throw new SessionCheckpointActionError(
      ErrorCodes.UNAVAILABLE,
      "checkpoint snapshot transcript is missing",
    );
  }
  return checkpoint;
}

function forkCheckpointSnapshot(
  checkpoint: SessionCompactionCheckpoint,
  failureMessage: string,
): {
  sessionId: string;
  sessionFile: string;
} {
  const sessionFile = checkpoint.preCompaction.sessionFile;
  if (!sessionFile) {
    throw new SessionCheckpointActionError(
      ErrorCodes.INVALID_REQUEST,
      `checkpoint not found: ${checkpoint.checkpointId}`,
    );
  }
  const snapshotSession = SessionManager.open(sessionFile, path.dirname(sessionFile));
  const forkedSession = SessionManager.forkFrom(
    sessionFile,
    snapshotSession.getCwd(),
    path.dirname(sessionFile),
  );
  const forkedSessionFile = forkedSession.getSessionFile();
  if (!forkedSessionFile) {
    throw new SessionCheckpointActionError(ErrorCodes.UNAVAILABLE, failureMessage);
  }
  return {
    sessionId: forkedSession.getSessionId(),
    sessionFile: forkedSessionFile,
  };
}

export async function branchSessionCompactionCheckpoint(params: {
  key: string;
  checkpointId: string;
}): Promise<SessionCheckpointBranchResult> {
  const checkpointId = requireCheckpointId(params.checkpointId);
  const loaded = loadSessionEntry(params.key);
  const { cfg, entry, canonicalKey } = loaded;
  const target = resolveGatewaySessionStoreTarget({ cfg, key: canonicalKey });
  if (!entry?.sessionId) {
    throw new SessionCheckpointActionError(
      ErrorCodes.INVALID_REQUEST,
      `session not found: ${params.key}`,
    );
  }
  const checkpoint = requireCheckpoint({ entry, checkpointId });
  const forked = forkCheckpointSnapshot(
    checkpoint,
    "failed to create checkpoint branch transcript",
  );
  const nextKey = buildCheckpointBranchSessionKey(target.agentId);
  const label = entry.label?.trim() ? `${entry.label.trim()} (checkpoint)` : "Checkpoint branch";
  const nextEntry = cloneCheckpointSessionEntry({
    currentEntry: entry,
    nextSessionId: forked.sessionId,
    nextSessionFile: forked.sessionFile,
    label,
    parentSessionKey: canonicalKey,
    totalTokens: checkpoint.tokensBefore,
  });

  await updateSessionStore(target.storePath, (store) => {
    store[nextKey] = nextEntry;
  });

  return {
    sourceKey: canonicalKey,
    key: nextKey,
    sessionId: nextEntry.sessionId,
    checkpoint,
    entry: nextEntry,
  };
}

export async function restoreSessionCompactionCheckpoint(params: {
  key: string;
  checkpointId: string;
}): Promise<SessionCheckpointRestoreResult> {
  const checkpointId = requireCheckpointId(params.checkpointId);
  const loaded = loadSessionEntry(params.key);
  const { entry, canonicalKey, storePath } = loaded;
  if (!entry?.sessionId) {
    throw new SessionCheckpointActionError(
      ErrorCodes.INVALID_REQUEST,
      `session not found: ${params.key}`,
    );
  }
  const checkpoint = requireCheckpoint({ entry, checkpointId });
  const forked = forkCheckpointSnapshot(checkpoint, "failed to restore checkpoint transcript");
  const nextEntry = cloneCheckpointSessionEntry({
    currentEntry: entry,
    nextSessionId: forked.sessionId,
    nextSessionFile: forked.sessionFile,
    totalTokens: checkpoint.tokensBefore,
    preserveCompactionCheckpoints: true,
  });

  await updateSessionStore(storePath, (store) => {
    store[canonicalKey] = nextEntry;
  });

  return {
    key: canonicalKey,
    sessionId: nextEntry.sessionId,
    checkpoint,
    entry: nextEntry,
  };
}
