import { getRuntimeConfig } from "../config/config.js";
import {
  resolveAgentMainSessionKey,
  resolveMainSessionKey,
} from "../config/sessions/main-session.js";
import { info } from "../globals.js";
import type { RuntimeEnv } from "../runtime.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { listTasksForFlowId } from "../tasks/runtime-internal.js";
import { cancelFlowById, getFlowTaskSummary } from "../tasks/task-executor.js";
import type { TaskFlowRecord, TaskFlowStatus } from "../tasks/task-flow-registry.types.js";
import {
  createManagedTaskFlow,
  failFlow,
  finishFlow,
  getTaskFlowById,
  listTaskFlowRecords,
  resolveTaskFlowForLookupToken,
  updateFlowRecordByIdExpectedRevision,
} from "../tasks/task-flow-runtime-internal.js";
import { sanitizeTerminalText } from "../terminal/safe-text.js";
import { isRich, theme } from "../terminal/theme.js";

const GOALS_CONTROLLER_ID = "cli/goals";
const ID_PAD = 10;
const STATUS_PAD = 10;
const OWNER_PAD = 22;

const ACTIVE_GOAL_STATUSES = new Set<TaskFlowStatus>(["queued", "running", "waiting", "blocked"]);

const GOAL_STATUSES = new Set<TaskFlowStatus>([
  "queued",
  "running",
  "waiting",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
  "lost",
]);

const SETTABLE_GOAL_STATUSES = new Set<TaskFlowStatus>(["queued", "running", "waiting", "blocked"]);

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= 1) {
    return value.slice(0, maxChars);
  }
  return `${value.slice(0, maxChars - 1)}...`;
}

function safeGoalText(value: string | undefined, maxChars?: number): string {
  const sanitized = sanitizeTerminalText(value ?? "").trim();
  if (!sanitized) {
    return "n/a";
  }
  return typeof maxChars === "number" ? truncate(sanitized, maxChars) : sanitized;
}

function shortToken(value: string | undefined, maxChars = ID_PAD): string {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return "n/a";
  }
  return truncate(trimmed, maxChars);
}

function isGoalFlow(flow: TaskFlowRecord): boolean {
  return flow.syncMode === "managed" && flow.controllerId === GOALS_CONTROLLER_ID;
}

function parseGoalStatus(value: string | undefined): TaskFlowStatus | undefined {
  const status = normalizeOptionalString(value);
  if (!status) {
    return undefined;
  }
  return GOAL_STATUSES.has(status as TaskFlowStatus) ? (status as TaskFlowStatus) : undefined;
}

function parseSettableGoalStatus(value: string | undefined): TaskFlowStatus | undefined {
  const status = parseGoalStatus(value);
  if (!status || !SETTABLE_GOAL_STATUSES.has(status)) {
    return undefined;
  }
  return status;
}

function formatGoalStatusCell(status: TaskFlowStatus, rich: boolean) {
  const padded = status.padEnd(STATUS_PAD);
  if (!rich) {
    return padded;
  }
  if (status === "succeeded") {
    return theme.success(padded);
  }
  if (status === "failed" || status === "lost") {
    return theme.error(padded);
  }
  if (status === "running") {
    return theme.accentBright(padded);
  }
  if (status === "blocked") {
    return theme.warn(padded);
  }
  return theme.muted(padded);
}

function goalTaskCounts(flow: TaskFlowRecord): string {
  const taskSummary = getFlowTaskSummary(flow.flowId);
  return `${taskSummary.active} active/${taskSummary.total} total`;
}

function formatGoalRows(flows: TaskFlowRecord[], rich: boolean) {
  const header = [
    "Goal".padEnd(ID_PAD),
    "Status".padEnd(STATUS_PAD),
    "Owner".padEnd(OWNER_PAD),
    "Tasks".padEnd(14),
    "Step".padEnd(24),
    "Goal text",
  ].join(" ");
  const lines = [rich ? theme.heading(header) : header];
  for (const flow of flows) {
    lines.push(
      [
        shortToken(flow.flowId).padEnd(ID_PAD),
        formatGoalStatusCell(flow.status, rich),
        safeGoalText(flow.ownerKey, OWNER_PAD).padEnd(OWNER_PAD),
        goalTaskCounts(flow).padEnd(14),
        safeGoalText(flow.currentStep, 24).padEnd(24),
        safeGoalText(flow.goal, 80),
      ].join(" "),
    );
  }
  return lines;
}

function formatGoalListSummary(flows: TaskFlowRecord[]) {
  const active = flows.filter((flow) => ACTIVE_GOAL_STATUSES.has(flow.status)).length;
  const blocked = flows.filter((flow) => flow.status === "blocked").length;
  const cancelRequested = flows.filter((flow) => flow.cancelRequestedAt != null).length;
  return `${active} active / ${blocked} blocked / ${cancelRequested} cancel-requested / ${flows.length} total`;
}

function buildGoalDetail(flow: TaskFlowRecord) {
  const tasks = listTasksForFlowId(flow.flowId);
  return {
    ...flow,
    tasks,
    taskSummary: getFlowTaskSummary(flow.flowId),
  };
}

function resolveGoalFlow(lookup: string): TaskFlowRecord | undefined {
  const flow = resolveTaskFlowForLookupToken(lookup);
  if (!flow || !isGoalFlow(flow)) {
    return undefined;
  }
  return flow;
}

function logFlowUpdateFailure(runtime: RuntimeEnv, lookup: string, reason: string): void {
  runtime.error(`Could not update goal ${lookup}: ${reason}.`);
  runtime.exit(1);
}

export async function goalsListCommand(
  opts: { json?: boolean; status?: string; all?: boolean },
  runtime: RuntimeEnv,
) {
  const status = parseGoalStatus(opts.status);
  if (opts.status && !status) {
    runtime.error(`Unknown goal status: ${opts.status}`);
    runtime.exit(1);
    return;
  }
  const flows = listTaskFlowRecords().filter((flow) => {
    if (!isGoalFlow(flow)) {
      return false;
    }
    if (status) {
      return flow.status === status;
    }
    if (opts.all) {
      return true;
    }
    return ACTIVE_GOAL_STATUSES.has(flow.status);
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          count: flows.length,
          status: status ?? null,
          all: Boolean(opts.all),
          goals: flows.map(buildGoalDetail),
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(info(`Goals: ${flows.length}`));
  runtime.log(info(`Goal pressure: ${formatGoalListSummary(flows)}`));
  if (status) {
    runtime.log(info(`Status filter: ${status}`));
  } else if (!opts.all) {
    runtime.log(info("Showing active goals only. Use --all for finished goals."));
  }
  if (flows.length === 0) {
    runtime.log("No goals found.");
    return;
  }
  const rich = isRich();
  for (const line of formatGoalRows(flows, rich)) {
    runtime.log(line);
  }
}

export async function goalsAddCommand(
  opts: { json?: boolean; goal: string; step?: string; agent?: string },
  runtime: RuntimeEnv,
) {
  const goal = normalizeOptionalString(opts.goal);
  if (!goal) {
    runtime.error("Goal text is required.");
    runtime.exit(1);
    return;
  }
  const cfg = getRuntimeConfig();
  const ownerKey = opts.agent
    ? resolveAgentMainSessionKey({ cfg, agentId: opts.agent })
    : resolveMainSessionKey(cfg);
  const flow = createManagedTaskFlow({
    ownerKey,
    controllerId: GOALS_CONTROLLER_ID,
    goal,
    currentStep: normalizeOptionalString(opts.step),
    status: "queued",
  });

  if (opts.json) {
    runtime.log(JSON.stringify(buildGoalDetail(flow), null, 2));
    return;
  }

  runtime.log(`Created goal ${flow.flowId}.`);
  runtime.log(`status: ${flow.status}`);
  runtime.log(`owner: ${safeGoalText(flow.ownerKey)}`);
  runtime.log(`step: ${safeGoalText(flow.currentStep)}`);
  runtime.log(`goal: ${safeGoalText(flow.goal)}`);
}

export async function goalsShowCommand(
  opts: { json?: boolean; lookup: string },
  runtime: RuntimeEnv,
) {
  const flow = resolveGoalFlow(opts.lookup);
  if (!flow) {
    runtime.error(`Goal not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const detail = buildGoalDetail(flow);

  if (opts.json) {
    runtime.log(JSON.stringify(detail, null, 2));
    return;
  }

  const lines = [
    "Goal:",
    `flowId: ${flow.flowId}`,
    `status: ${flow.status}`,
    `goal: ${safeGoalText(flow.goal)}`,
    `currentStep: ${safeGoalText(flow.currentStep)}`,
    `owner: ${safeGoalText(flow.ownerKey)}`,
    `tasks: ${detail.taskSummary.total} total / ${detail.taskSummary.active} active / ${detail.taskSummary.failures} issues`,
    ...(flow.cancelRequestedAt
      ? [`cancelRequestedAt: ${new Date(flow.cancelRequestedAt).toISOString()}`]
      : []),
    `createdAt: ${new Date(flow.createdAt).toISOString()}`,
    `updatedAt: ${new Date(flow.updatedAt).toISOString()}`,
    `endedAt: ${flow.endedAt ? new Date(flow.endedAt).toISOString() : "n/a"}`,
  ];
  for (const line of lines) {
    runtime.log(line);
  }
  if (detail.tasks.length === 0) {
    runtime.log("Linked tasks: none");
    return;
  }
  runtime.log("Linked tasks:");
  for (const task of detail.tasks) {
    runtime.log(
      `- ${task.taskId} ${task.status} ${task.runId ?? "n/a"} ${safeGoalText(task.label ?? task.task)}`,
    );
  }
}

export async function goalsSetCommand(
  opts: { json?: boolean; lookup: string; status?: string; step?: string },
  runtime: RuntimeEnv,
) {
  const flow = resolveGoalFlow(opts.lookup);
  if (!flow) {
    runtime.error(`Goal not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const status = opts.status ? parseSettableGoalStatus(opts.status) : undefined;
  if (opts.status && !status) {
    runtime.error(
      `--status must be one of queued, running, waiting, blocked. Use "goals done", "goals fail", or "goals cancel" for terminal states.`,
    );
    runtime.exit(1);
    return;
  }
  const step = normalizeOptionalString(opts.step);
  if (!status && step == null) {
    runtime.error("Nothing to update. Pass --status, --step, or both.");
    runtime.exit(1);
    return;
  }

  const result = updateFlowRecordByIdExpectedRevision({
    flowId: flow.flowId,
    expectedRevision: flow.revision,
    patch: {
      ...(status ? { status } : {}),
      ...(opts.step !== undefined ? { currentStep: step ?? null } : {}),
      endedAt: null,
    },
  });
  if (!result.applied) {
    logFlowUpdateFailure(runtime, opts.lookup, result.reason);
    return;
  }
  if (opts.json) {
    runtime.log(JSON.stringify(buildGoalDetail(result.flow), null, 2));
    return;
  }
  runtime.log(`Updated goal ${result.flow.flowId}.`);
  runtime.log(`status: ${result.flow.status}`);
  runtime.log(`step: ${safeGoalText(result.flow.currentStep)}`);
}

export async function goalsDoneCommand(
  opts: { json?: boolean; lookup: string; step?: string },
  runtime: RuntimeEnv,
) {
  const flow = resolveGoalFlow(opts.lookup);
  if (!flow) {
    runtime.error(`Goal not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const result = finishFlow({
    flowId: flow.flowId,
    expectedRevision: flow.revision,
    currentStep: normalizeOptionalString(opts.step) ?? flow.currentStep ?? "done",
  });
  if (!result.applied) {
    logFlowUpdateFailure(runtime, opts.lookup, result.reason);
    return;
  }
  if (opts.json) {
    runtime.log(JSON.stringify(buildGoalDetail(result.flow), null, 2));
    return;
  }
  runtime.log(`Completed goal ${result.flow.flowId}.`);
}

export async function goalsFailCommand(
  opts: { json?: boolean; lookup: string; step?: string; reason?: string },
  runtime: RuntimeEnv,
) {
  const flow = resolveGoalFlow(opts.lookup);
  if (!flow) {
    runtime.error(`Goal not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const result = failFlow({
    flowId: flow.flowId,
    expectedRevision: flow.revision,
    currentStep: normalizeOptionalString(opts.step) ?? flow.currentStep ?? "failed",
    blockedSummary: normalizeOptionalString(opts.reason) ?? "Marked failed from CLI.",
  });
  if (!result.applied) {
    logFlowUpdateFailure(runtime, opts.lookup, result.reason);
    return;
  }
  if (opts.json) {
    runtime.log(JSON.stringify(buildGoalDetail(result.flow), null, 2));
    return;
  }
  runtime.log(`Failed goal ${result.flow.flowId}.`);
  runtime.log(`reason: ${safeGoalText(result.flow.blockedSummary)}`);
}

export async function goalsCancelCommand(
  opts: { json?: boolean; lookup: string },
  runtime: RuntimeEnv,
) {
  const flow = resolveGoalFlow(opts.lookup);
  if (!flow) {
    runtime.error(`Goal not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const result = await cancelFlowById({
    cfg: getRuntimeConfig(),
    flowId: flow.flowId,
  });
  const updated = getTaskFlowById(flow.flowId) ?? result.flow ?? flow;
  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          ...result,
          goal: buildGoalDetail(updated),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (!result.cancelled) {
    runtime.error(result.reason ?? `Could not cancel goal: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  runtime.log(`Cancelled goal ${updated.flowId}.`);
}
