import type { SessionCompactionCheckpoint } from "../config/sessions.js";
import { danger, info } from "../globals.js";
import { formatErrorMessage } from "../infra/errors.js";
import { type RuntimeEnv, writeRuntimeJson } from "../runtime.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";

type CheckpointGatewayMethod =
  | "sessions.compaction.list"
  | "sessions.compaction.get"
  | "sessions.compaction.branch"
  | "sessions.compaction.restore";

export type SessionsCheckpointsGatewayCall = (
  method: CheckpointGatewayMethod,
  params: Record<string, unknown>,
) => Promise<unknown>;

export type SessionsCheckpointsCommandOptions = {
  key?: string;
  checkpointId?: string;
  branch?: boolean;
  restore?: boolean;
  confirm?: boolean;
  json?: boolean;
};

export type SessionsCheckpointsCommandDeps = {
  callGateway: SessionsCheckpointsGatewayCall;
};

type CheckpointListResult = {
  key: string;
  checkpoints: SessionCompactionCheckpoint[];
};

type CheckpointGetResult = {
  key: string;
  checkpoint: SessionCompactionCheckpoint;
};

type CheckpointBranchResult = {
  sourceKey: string;
  key: string;
  sessionId: string;
  checkpoint: SessionCompactionCheckpoint;
};

type CheckpointRestoreResult = {
  key: string;
  sessionId: string;
  checkpoint: SessionCompactionCheckpoint;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" && record[key].trim() ? record[key] : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  return typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] : undefined;
}

function isCheckpointRef(value: unknown): value is SessionCompactionCheckpoint["preCompaction"] {
  const record = asRecord(value);
  return Boolean(record && readString(record, "sessionId"));
}

function isSessionCompactionCheckpoint(value: unknown): value is SessionCompactionCheckpoint {
  const record = asRecord(value);
  return Boolean(
    record &&
    readString(record, "checkpointId") &&
    readString(record, "sessionKey") &&
    readString(record, "sessionId") &&
    readNumber(record, "createdAt") !== undefined &&
    readString(record, "reason") &&
    isCheckpointRef(record.preCompaction) &&
    isCheckpointRef(record.postCompaction),
  );
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = readString(record, key);
  if (!value) {
    throw new Error(`gateway returned invalid ${context}: missing ${key}`);
  }
  return value;
}

function requireCheckpoint(value: unknown, context: string): SessionCompactionCheckpoint {
  if (!isSessionCompactionCheckpoint(value)) {
    throw new Error(`gateway returned invalid ${context}: missing checkpoint`);
  }
  return value;
}

function parseListResult(value: unknown): CheckpointListResult {
  const record = asRecord(value);
  if (!record) {
    throw new Error("gateway returned invalid checkpoint list");
  }
  if (!Array.isArray(record.checkpoints)) {
    throw new Error("gateway returned invalid checkpoint list: missing checkpoints");
  }
  return {
    key: requireString(record, "key", "checkpoint list"),
    checkpoints: record.checkpoints.map((checkpoint, index) =>
      requireCheckpoint(checkpoint, `checkpoint list item ${index}`),
    ),
  };
}

function parseGetResult(value: unknown): CheckpointGetResult {
  const record = asRecord(value);
  if (!record) {
    throw new Error("gateway returned invalid checkpoint result");
  }
  return {
    key: requireString(record, "key", "checkpoint result"),
    checkpoint: requireCheckpoint(record.checkpoint, "checkpoint result"),
  };
}

function parseBranchResult(value: unknown): CheckpointBranchResult {
  const record = asRecord(value);
  if (!record) {
    throw new Error("gateway returned invalid checkpoint branch result");
  }
  return {
    sourceKey: requireString(record, "sourceKey", "checkpoint branch result"),
    key: requireString(record, "key", "checkpoint branch result"),
    sessionId: requireString(record, "sessionId", "checkpoint branch result"),
    checkpoint: requireCheckpoint(record.checkpoint, "checkpoint branch result"),
  };
}

function parseRestoreResult(value: unknown): CheckpointRestoreResult {
  const record = asRecord(value);
  if (!record) {
    throw new Error("gateway returned invalid checkpoint restore result");
  }
  return {
    key: requireString(record, "key", "checkpoint restore result"),
    sessionId: requireString(record, "sessionId", "checkpoint restore result"),
    checkpoint: requireCheckpoint(record.checkpoint, "checkpoint restore result"),
  };
}

function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "unknown";
  }
  return new Date(ms).toISOString();
}

function formatTokens(checkpoint: SessionCompactionCheckpoint): string {
  const before =
    typeof checkpoint.tokensBefore === "number" && Number.isFinite(checkpoint.tokensBefore)
      ? String(checkpoint.tokensBefore)
      : "?";
  const after =
    typeof checkpoint.tokensAfter === "number" && Number.isFinite(checkpoint.tokensAfter)
      ? String(checkpoint.tokensAfter)
      : "?";
  return `${before}->${after}`;
}

function formatCheckpointLine(checkpoint: SessionCompactionCheckpoint): string {
  const summary = checkpoint.summary?.trim() ? ` ${checkpoint.summary.trim()}` : "";
  return [
    formatTimestamp(checkpoint.createdAt).padEnd(24),
    checkpoint.checkpointId.padEnd(36),
    checkpoint.reason.padEnd(15),
    formatTokens(checkpoint).padEnd(13),
    summary.trimStart(),
  ]
    .filter((part) => part.length > 0)
    .join(" ")
    .trimEnd();
}

function renderCheckpointDetails(
  runtime: RuntimeEnv,
  checkpoint: SessionCompactionCheckpoint,
): void {
  runtime.log(`Checkpoint: ${checkpoint.checkpointId}`);
  runtime.log(`Created: ${formatTimestamp(checkpoint.createdAt)}`);
  runtime.log(`Reason: ${checkpoint.reason}`);
  runtime.log(`Tokens: ${formatTokens(checkpoint)}`);
  runtime.log(`Pre-compaction session: ${checkpoint.preCompaction.sessionId}`);
  if (checkpoint.preCompaction.sessionFile) {
    runtime.log(`Pre-compaction file: ${checkpoint.preCompaction.sessionFile}`);
  }
  if (checkpoint.preCompaction.leafId) {
    runtime.log(`Pre-compaction leaf: ${checkpoint.preCompaction.leafId}`);
  }
  runtime.log(`Post-compaction session: ${checkpoint.postCompaction.sessionId}`);
  if (checkpoint.postCompaction.sessionFile) {
    runtime.log(`Post-compaction file: ${checkpoint.postCompaction.sessionFile}`);
  }
  if (checkpoint.summary?.trim()) {
    runtime.log(`Summary: ${checkpoint.summary.trim()}`);
  }
}

function requireCheckpointId(
  opts: SessionsCheckpointsCommandOptions,
  runtime: RuntimeEnv,
): string | null {
  const checkpointId = normalizeOptionalString(opts.checkpointId);
  if (checkpointId) {
    return checkpointId;
  }
  runtime.error("--checkpoint-id is required for show, branch, or restore.");
  runtime.exit(1);
  return null;
}

async function callGatewayChecked(
  deps: SessionsCheckpointsCommandDeps,
  method: CheckpointGatewayMethod,
  params: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await deps.callGateway(method, params);
  } catch (error) {
    throw new Error(formatErrorMessage(error));
  }
}

export async function sessionsCheckpointsCommand(
  opts: SessionsCheckpointsCommandOptions,
  runtime: RuntimeEnv,
  deps: SessionsCheckpointsCommandDeps,
): Promise<void> {
  const key = normalizeOptionalString(opts.key);
  if (!key) {
    runtime.error("session key required");
    runtime.exit(1);
    return;
  }
  if (opts.branch && opts.restore) {
    runtime.error("Choose either --branch or --restore, not both.");
    runtime.exit(1);
    return;
  }

  try {
    if (opts.branch) {
      const checkpointId = requireCheckpointId(opts, runtime);
      if (!checkpointId) {
        return;
      }
      const result = parseBranchResult(
        await callGatewayChecked(deps, "sessions.compaction.branch", { key, checkpointId }),
      );
      if (opts.json) {
        writeRuntimeJson(runtime, { ok: true, action: "branch", ...result });
        return;
      }
      runtime.log(info("Created checkpoint branch."));
      runtime.log(`Source: ${result.sourceKey}`);
      runtime.log(`Branch: ${result.key}`);
      runtime.log(`Session: ${result.sessionId}`);
      return;
    }

    if (opts.restore) {
      const checkpointId = requireCheckpointId(opts, runtime);
      if (!checkpointId) {
        return;
      }
      if (!opts.confirm) {
        const result = parseGetResult(
          await callGatewayChecked(deps, "sessions.compaction.get", { key, checkpointId }),
        );
        if (opts.json) {
          writeRuntimeJson(runtime, {
            ok: true,
            action: "restore",
            dryRun: true,
            key: result.key,
            checkpoint: result.checkpoint,
            note: "No changes made. Re-run with --restore --confirm to apply.",
          });
          return;
        }
        runtime.log(info("Restore preview; no changes made."));
        runtime.log(`Session: ${result.key}`);
        renderCheckpointDetails(runtime, result.checkpoint);
        runtime.log("");
        runtime.log(
          "This will replace the current session with a branch of the pre-compaction snapshot.",
        );
        runtime.log(
          "Re-run with --restore --confirm to apply, or use --branch to keep both sessions.",
        );
        return;
      }
      const result = parseRestoreResult(
        await callGatewayChecked(deps, "sessions.compaction.restore", { key, checkpointId }),
      );
      if (opts.json) {
        writeRuntimeJson(runtime, { ok: true, action: "restore", ...result });
        return;
      }
      runtime.log(info("Restored session from checkpoint."));
      runtime.log(`Session: ${result.key}`);
      runtime.log(`New session id: ${result.sessionId}`);
      runtime.log(`Checkpoint: ${result.checkpoint.checkpointId}`);
      return;
    }

    if (opts.checkpointId) {
      const checkpointId = requireCheckpointId(opts, runtime);
      if (!checkpointId) {
        return;
      }
      const result = parseGetResult(
        await callGatewayChecked(deps, "sessions.compaction.get", { key, checkpointId }),
      );
      if (opts.json) {
        writeRuntimeJson(runtime, { ok: true, action: "show", ...result });
        return;
      }
      runtime.log(info(`Session: ${result.key}`));
      renderCheckpointDetails(runtime, result.checkpoint);
      return;
    }

    const result = parseListResult(
      await callGatewayChecked(deps, "sessions.compaction.list", { key }),
    );
    if (opts.json) {
      writeRuntimeJson(runtime, {
        ok: true,
        action: "list",
        key: result.key,
        count: result.checkpoints.length,
        checkpoints: result.checkpoints,
      });
      return;
    }
    runtime.log(info(`Session: ${result.key}`));
    runtime.log(info(`Checkpoints: ${result.checkpoints.length}`));
    if (result.checkpoints.length === 0) {
      runtime.log("No compaction checkpoints found.");
      return;
    }
    runtime.log(
      [
        "Created".padEnd(24),
        "Checkpoint".padEnd(36),
        "Reason".padEnd(15),
        "Tokens".padEnd(13),
        "Summary",
      ].join(" "),
    );
    for (const checkpoint of result.checkpoints) {
      runtime.log(formatCheckpointLine(checkpoint));
    }
  } catch (error) {
    runtime.error(danger(formatErrorMessage(error)));
    runtime.exit(1);
  }
}
