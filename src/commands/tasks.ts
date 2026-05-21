import { getRuntimeConfig } from "../config/config.js";
import { resolveCronStorePath } from "../cron/store.js";
import type { RuntimeEnv } from "../runtime.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { getTaskById, updateTaskNotifyPolicyById } from "../tasks/runtime-internal.js";
import { cancelDetachedTaskRunById } from "../tasks/task-executor.js";
import {
  listTaskFlowAuditFindings,
  summarizeTaskFlowAuditFindings,
  type TaskFlowAuditCode,
  type TaskFlowAuditSeverity,
} from "../tasks/task-flow-registry.audit.js";
import {
  getInspectableTaskFlowAuditSummary,
  previewTaskFlowRegistryMaintenance,
  runTaskFlowRegistryMaintenance,
} from "../tasks/task-flow-registry.maintenance.js";
import type { TaskFlowRecord } from "../tasks/task-flow-registry.types.js";
import { listTaskFlowRecords } from "../tasks/task-flow-runtime-internal.js";
import {
  listTaskAuditFindings,
  summarizeTaskAuditFindings,
  type TaskAuditCode,
  type TaskAuditSeverity,
} from "../tasks/task-registry.audit.js";
import { compareTaskAuditFindingSortKeys } from "../tasks/task-registry.audit.shared.js";
import {
  getInspectableTaskAuditSummary,
  getInspectableTaskRegistrySummary,
  configureTaskRegistryMaintenance,
  previewTaskRegistryMaintenance,
  runTaskRegistryMaintenance,
} from "../tasks/task-registry.maintenance.js";
import {
  reconcileInspectableTasks,
  reconcileTaskLookupToken,
} from "../tasks/task-registry.reconcile.js";
import { summarizeTaskRecords } from "../tasks/task-registry.summary.js";
import type { TaskNotifyPolicy, TaskRecord } from "../tasks/task-registry.types.js";
import { isRich, theme } from "../terminal/theme.js";

const RUNTIME_PAD = 8;
const STATUS_PAD = 10;
const DELIVERY_PAD = 14;
const ID_PAD = 10;
const RUN_PAD = 10;

const TASK_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
  "lost",
] as const;
const TASK_RUNTIMES = ["subagent", "acp", "cli", "cron"] as const;
const TASK_DELIVERY_STATUSES = [
  "pending",
  "delivered",
  "session_queued",
  "failed",
  "parent_missing",
  "not_applicable",
] as const;
const TASK_NOTIFY_POLICIES = ["done_only", "state_changes", "silent"] as const;
const TASK_FLOW_STATUSES = [
  "queued",
  "running",
  "waiting",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
  "lost",
] as const;

const info = theme.info;

async function loadTaskCancelConfig() {
  return getRuntimeConfig();
}

function configureTaskMaintenanceFromConfig(): void {
  const cfg = getRuntimeConfig();
  configureTaskRegistryMaintenance({
    cronStorePath: resolveCronStorePath(cfg.cron?.store),
  });
}

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }
  if (maxChars <= 1) {
    return value.slice(0, maxChars);
  }
  return `${value.slice(0, maxChars - 1)}…`;
}

function shortToken(value: string | undefined, maxChars = ID_PAD): string {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return "n/a";
  }
  return truncate(trimmed, maxChars);
}

function formatTaskStatusCell(status: string, rich: boolean) {
  const padded = status.padEnd(STATUS_PAD);
  if (!rich) {
    return padded;
  }
  if (status === "succeeded") {
    return theme.success(padded);
  }
  if (status === "failed" || status === "lost" || status === "timed_out") {
    return theme.error(padded);
  }
  if (status === "running") {
    return theme.accentBright(padded);
  }
  return theme.muted(padded);
}

function formatTaskRows(tasks: TaskRecord[], rich: boolean) {
  const header = [
    "Task".padEnd(ID_PAD),
    "Kind".padEnd(RUNTIME_PAD),
    "Status".padEnd(STATUS_PAD),
    "Delivery".padEnd(DELIVERY_PAD),
    "Run".padEnd(RUN_PAD),
    "Child Session",
    "Summary",
  ].join(" ");
  const lines = [rich ? theme.heading(header) : header];
  for (const task of tasks) {
    const summary = truncate(
      normalizeOptionalString(task.terminalSummary) ||
        normalizeOptionalString(task.progressSummary) ||
        normalizeOptionalString(task.label) ||
        task.task.trim(),
      80,
    );
    const line = [
      shortToken(task.taskId).padEnd(ID_PAD),
      task.runtime.padEnd(RUNTIME_PAD),
      formatTaskStatusCell(task.status, rich),
      task.deliveryStatus.padEnd(DELIVERY_PAD),
      shortToken(task.runId, RUN_PAD).padEnd(RUN_PAD),
      truncate(normalizeOptionalString(task.childSessionKey) || "n/a", 36).padEnd(36),
      summary,
    ].join(" ");
    lines.push(line.trimEnd());
  }
  return lines;
}

function formatTaskListSummary(tasks: TaskRecord[]) {
  const summary = summarizeTaskRecords(tasks);
  return `${summary.byStatus.queued} queued · ${summary.byStatus.running} running · ${summary.failures} issues`;
}

function createCountRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function formatCountPairs(counts: Record<string, number>, keys: readonly string[]): string {
  const pairs = keys
    .map((key) => `${key} ${counts[key] ?? 0}`)
    .filter((entry) => !entry.endsWith(" 0"));
  return pairs.length > 0 ? pairs.join(" · ") : "none";
}

function resolveReportLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return 10;
  }
  return Math.min(50, Math.floor(limit));
}

function formatDurationCompact(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
    return "n/a";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${Math.round(ms / 100) / 10}s`;
  }
  if (ms < 3_600_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  if (ms < 86_400_000) {
    return `${Math.round(ms / 3_600_000)}h`;
  }
  return `${Math.round(ms / 86_400_000)}d`;
}

function percentile(sortedValues: number[], percentileValue: number): number | null {
  if (sortedValues.length === 0) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, percentileValue));
  const index = Math.max(
    0,
    Math.min(sortedValues.length - 1, Math.ceil((clamped / 100) * sortedValues.length) - 1),
  );
  return sortedValues[index] ?? null;
}

function summarizeCompletedTaskDurations(tasks: TaskRecord[]) {
  const durations = tasks
    .flatMap((task) => {
      if (typeof task.endedAt !== "number") {
        return [];
      }
      const start = typeof task.startedAt === "number" ? task.startedAt : task.createdAt;
      const duration = task.endedAt - start;
      return Number.isFinite(duration) && duration >= 0 ? [duration] : [];
    })
    .toSorted((left, right) => left - right);
  const totalMs = durations.reduce((sum, duration) => sum + duration, 0);
  return {
    count: durations.length,
    avgMs: durations.length > 0 ? Math.round(totalMs / durations.length) : null,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    maxMs: durations.at(-1) ?? null,
  };
}

function summarizeTaskFlows(flows: TaskFlowRecord[]) {
  const byStatus = createCountRecord(TASK_FLOW_STATUSES);
  for (const flow of flows) {
    byStatus[flow.status] += 1;
  }
  const active = flows.filter(
    (flow) =>
      flow.status === "queued" ||
      flow.status === "running" ||
      flow.status === "waiting" ||
      flow.status === "blocked",
  ).length;
  return {
    total: flows.length,
    active,
    terminal: flows.length - active,
    byStatus,
  };
}

function compareRecentTaskActivity(left: TaskRecord, right: TaskRecord): number {
  const leftAt = left.endedAt ?? left.lastEventAt ?? left.startedAt ?? left.createdAt;
  const rightAt = right.endedAt ?? right.lastEventAt ?? right.startedAt ?? right.createdAt;
  return rightAt - leftAt;
}

function isTaskIssue(task: TaskRecord): boolean {
  return (
    task.status === "failed" ||
    task.status === "timed_out" ||
    task.status === "lost" ||
    task.deliveryStatus === "failed" ||
    task.deliveryStatus === "parent_missing"
  );
}

export function buildTaskAutomationReport(opts: {
  runtime?: string;
  status?: string;
  limit?: number;
}) {
  const runtimeFilter = opts.runtime?.trim();
  const statusFilter = opts.status?.trim();
  const limit = resolveReportLimit(opts.limit);
  const tasks = reconcileInspectableTasks().filter((task) => {
    if (runtimeFilter && task.runtime !== runtimeFilter) {
      return false;
    }
    if (statusFilter && task.status !== statusFilter) {
      return false;
    }
    return true;
  });
  const flows = listTaskFlowRecords();
  const summary = summarizeTaskRecords(tasks);
  const byDeliveryStatus = createCountRecord(TASK_DELIVERY_STATUSES);
  const byNotifyPolicy = createCountRecord(TASK_NOTIFY_POLICIES);
  for (const task of tasks) {
    byDeliveryStatus[task.deliveryStatus] += 1;
    byNotifyPolicy[task.notifyPolicy] += 1;
  }
  const { summary: auditSummary } = toSystemAuditFindings({});
  return {
    generatedAt: new Date().toISOString(),
    filters: {
      runtime: runtimeFilter ?? null,
      status: statusFilter ?? null,
      limit,
    },
    tasks: {
      ...summary,
      byDeliveryStatus,
      byNotifyPolicy,
      completedDurationMs: summarizeCompletedTaskDurations(tasks),
    },
    taskFlows: summarizeTaskFlows(flows),
    audit: {
      total: auditSummary.total,
      errors: auditSummary.errors,
      warnings: auditSummary.warnings,
      tasks: auditSummary.tasks,
      taskFlows: auditSummary.taskFlows,
    },
    activeTasks: tasks
      .filter((task) => task.status === "queued" || task.status === "running")
      .toSorted(compareRecentTaskActivity)
      .slice(0, limit),
    recentIssues: tasks.filter(isTaskIssue).toSorted(compareRecentTaskActivity).slice(0, limit),
  };
}

function formatAgeMs(ageMs: number | undefined): string {
  if (typeof ageMs !== "number" || ageMs < 1000) {
    return "fresh";
  }
  const totalSeconds = Math.floor(ageMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) {
    return `${days}d${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

type TaskSystemAuditCode = TaskAuditCode | TaskFlowAuditCode;
type TaskSystemAuditSeverity = TaskAuditSeverity | TaskFlowAuditSeverity;

type TaskSystemAuditFinding = {
  kind: "task" | "task_flow";
  severity: TaskSystemAuditSeverity;
  code: TaskSystemAuditCode;
  detail: string;
  ageMs?: number;
  status?: string;
  token?: string;
  task?: TaskRecord;
  flow?: TaskFlowRecord;
};

function compareSystemAuditFindings(left: TaskSystemAuditFinding, right: TaskSystemAuditFinding) {
  return compareTaskAuditFindingSortKeys(
    {
      severity: left.severity,
      ageMs: left.ageMs,
      createdAt: left.task?.createdAt ?? left.flow?.createdAt ?? 0,
    },
    {
      severity: right.severity,
      ageMs: right.ageMs,
      createdAt: right.task?.createdAt ?? right.flow?.createdAt ?? 0,
    },
  );
}

function formatAuditRows(findings: TaskSystemAuditFinding[], rich: boolean) {
  const header = [
    "Scope".padEnd(8),
    "Severity".padEnd(8),
    "Code".padEnd(22),
    "Item".padEnd(ID_PAD),
    "Status".padEnd(STATUS_PAD),
    "Age".padEnd(8),
    "Detail",
  ].join(" ");
  const lines = [rich ? theme.heading(header) : header];
  for (const finding of findings) {
    const severity = finding.severity.padEnd(8);
    const status = formatTaskStatusCell(finding.status ?? "n/a", rich);
    const severityCell = !rich
      ? severity
      : finding.severity === "error"
        ? theme.error(severity)
        : theme.warn(severity);
    const scope = finding.kind === "task" ? "Task" : "TaskFlow";
    lines.push(
      [
        scope.padEnd(8),
        severityCell,
        finding.code.padEnd(22),
        shortToken(finding.token).padEnd(ID_PAD),
        status,
        formatAgeMs(finding.ageMs).padEnd(8),
        truncate(finding.detail, 88),
      ]
        .join(" ")
        .trimEnd(),
    );
  }
  return lines;
}

function toSystemAuditFindings(params: {
  severityFilter?: TaskSystemAuditSeverity;
  codeFilter?: TaskSystemAuditCode;
}) {
  const taskFindings = listTaskAuditFindings();
  const flowFindings = listTaskFlowAuditFindings();
  const allFindings: TaskSystemAuditFinding[] = [
    ...taskFindings.map((finding) => ({
      kind: "task" as const,
      severity: finding.severity,
      code: finding.code,
      detail: finding.detail,
      ageMs: finding.ageMs,
      status: finding.task.status,
      token: finding.task.taskId,
      task: finding.task,
    })),
    ...flowFindings.map((finding) => ({
      kind: "task_flow" as const,
      severity: finding.severity,
      code: finding.code,
      detail: finding.detail,
      ageMs: finding.ageMs,
      status: finding.flow?.status ?? "n/a",
      token: finding.flow?.flowId,
      ...(finding.flow ? { flow: finding.flow } : {}),
    })),
  ];
  const filteredFindings = allFindings
    .filter((finding) => {
      if (params.severityFilter && finding.severity !== params.severityFilter) {
        return false;
      }
      if (params.codeFilter && finding.code !== params.codeFilter) {
        return false;
      }
      return true;
    })
    .toSorted(compareSystemAuditFindings);
  const sortedAllFindings = [...allFindings].toSorted(compareSystemAuditFindings);
  return {
    allFindings: sortedAllFindings,
    filteredFindings,
    taskFindings,
    flowFindings,
    summary: {
      total: sortedAllFindings.length,
      errors: sortedAllFindings.filter((finding) => finding.severity === "error").length,
      warnings: sortedAllFindings.filter((finding) => finding.severity !== "error").length,
      tasks: summarizeTaskAuditFindings(taskFindings),
      taskFlows: summarizeTaskFlowAuditFindings(flowFindings),
    },
  };
}

export async function tasksListCommand(
  opts: { json?: boolean; runtime?: string; status?: string },
  runtime: RuntimeEnv,
) {
  const runtimeFilter = opts.runtime?.trim();
  const statusFilter = opts.status?.trim();
  const tasks = reconcileInspectableTasks().filter((task) => {
    if (runtimeFilter && task.runtime !== runtimeFilter) {
      return false;
    }
    if (statusFilter && task.status !== statusFilter) {
      return false;
    }
    return true;
  });

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          count: tasks.length,
          runtime: runtimeFilter ?? null,
          status: statusFilter ?? null,
          tasks,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(info(`Background tasks: ${tasks.length}`));
  runtime.log(info(`Task pressure: ${formatTaskListSummary(tasks)}`));
  if (runtimeFilter) {
    runtime.log(info(`Runtime filter: ${runtimeFilter}`));
  }
  if (statusFilter) {
    runtime.log(info(`Status filter: ${statusFilter}`));
  }
  if (tasks.length === 0) {
    runtime.log("No background tasks found.");
    return;
  }
  const rich = isRich();
  for (const line of formatTaskRows(tasks, rich)) {
    runtime.log(line);
  }
}

export async function tasksShowCommand(
  opts: { json?: boolean; lookup: string },
  runtime: RuntimeEnv,
) {
  const task = reconcileTaskLookupToken(opts.lookup);
  if (!task) {
    runtime.error(`Task not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }

  if (opts.json) {
    runtime.log(JSON.stringify(task, null, 2));
    return;
  }

  const lines = [
    "Background task:",
    `taskId: ${task.taskId}`,
    `kind: ${task.runtime}`,
    `sourceId: ${task.sourceId ?? "n/a"}`,
    `status: ${task.status}`,
    `result: ${task.terminalOutcome ?? "n/a"}`,
    `delivery: ${task.deliveryStatus}`,
    `notify: ${task.notifyPolicy}`,
    `ownerKey: ${task.ownerKey}`,
    `childSessionKey: ${task.childSessionKey ?? "n/a"}`,
    `parentTaskId: ${task.parentTaskId ?? "n/a"}`,
    `agentId: ${task.agentId ?? "n/a"}`,
    `runId: ${task.runId ?? "n/a"}`,
    `label: ${task.label ?? "n/a"}`,
    `task: ${task.task}`,
    `createdAt: ${new Date(task.createdAt).toISOString()}`,
    `startedAt: ${task.startedAt ? new Date(task.startedAt).toISOString() : "n/a"}`,
    `endedAt: ${task.endedAt ? new Date(task.endedAt).toISOString() : "n/a"}`,
    `lastEventAt: ${task.lastEventAt ? new Date(task.lastEventAt).toISOString() : "n/a"}`,
    `cleanupAfter: ${task.cleanupAfter ? new Date(task.cleanupAfter).toISOString() : "n/a"}`,
    ...(task.error ? [`error: ${task.error}`] : []),
    ...(task.progressSummary ? [`progressSummary: ${task.progressSummary}`] : []),
    ...(task.terminalSummary ? [`terminalSummary: ${task.terminalSummary}`] : []),
  ];
  for (const line of lines) {
    runtime.log(line);
  }
}

export async function tasksNotifyCommand(
  opts: { lookup: string; notify: TaskNotifyPolicy },
  runtime: RuntimeEnv,
) {
  const task = reconcileTaskLookupToken(opts.lookup);
  if (!task) {
    runtime.error(`Task not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const updated = updateTaskNotifyPolicyById({
    taskId: task.taskId,
    notifyPolicy: opts.notify,
  });
  if (!updated) {
    runtime.error(`Task not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  runtime.log(`Updated ${updated.taskId} notify policy to ${updated.notifyPolicy}.`);
}

export async function tasksCancelCommand(opts: { lookup: string }, runtime: RuntimeEnv) {
  const task = reconcileTaskLookupToken(opts.lookup);
  if (!task) {
    runtime.error(`Task not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const result = await cancelDetachedTaskRunById({
    cfg: await loadTaskCancelConfig(),
    taskId: task.taskId,
  });
  if (!result.found) {
    runtime.error(result.reason ?? `Task not found: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  if (!result.cancelled) {
    runtime.error(result.reason ?? `Could not cancel task: ${opts.lookup}`);
    runtime.exit(1);
    return;
  }
  const updated = getTaskById(task.taskId);
  runtime.log(
    `Cancelled ${updated?.taskId ?? task.taskId} (${updated?.runtime ?? task.runtime})${updated?.runId ? ` run ${updated.runId}` : ""}.`,
  );
}

export async function tasksAuditCommand(
  opts: {
    json?: boolean;
    severity?: TaskSystemAuditSeverity;
    code?: TaskSystemAuditCode;
    limit?: number;
  },
  runtime: RuntimeEnv,
) {
  configureTaskMaintenanceFromConfig();
  const severityFilter = opts.severity?.trim() as TaskSystemAuditSeverity | undefined;
  const codeFilter = opts.code?.trim() as TaskSystemAuditCode | undefined;
  const { allFindings, filteredFindings, taskFindings, summary } = toSystemAuditFindings({
    severityFilter,
    codeFilter,
  });
  const limit = typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : undefined;
  const displayed = limit ? filteredFindings.slice(0, limit) : filteredFindings;

  if (opts.json) {
    const legacySummary = summarizeTaskAuditFindings(taskFindings);
    runtime.log(
      JSON.stringify(
        {
          count: allFindings.length,
          filteredCount: filteredFindings.length,
          displayed: displayed.length,
          filters: {
            severity: severityFilter ?? null,
            code: codeFilter ?? null,
            limit: limit ?? null,
          },
          summary: {
            ...legacySummary,
            taskFlows: summary.taskFlows,
            combined: {
              total: summary.total,
              errors: summary.errors,
              warnings: summary.warnings,
            },
          },
          findings: displayed,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(
    info(
      `Tasks audit: ${summary.total} findings · ${summary.errors} errors · ${summary.warnings} warnings`,
    ),
  );
  if (severityFilter || codeFilter) {
    runtime.log(info(`Showing ${filteredFindings.length} matching findings.`));
  }
  if (severityFilter) {
    runtime.log(info(`Severity filter: ${severityFilter}`));
  }
  if (codeFilter) {
    runtime.log(info(`Code filter: ${codeFilter}`));
  }
  if (limit) {
    runtime.log(info(`Limit: ${limit}`));
  }
  runtime.log(
    info(`Task findings: ${summary.tasks.total} · TaskFlow findings: ${summary.taskFlows.total}`),
  );
  if (displayed.length === 0) {
    runtime.log("No tasks audit findings.");
    return;
  }
  const rich = isRich();
  for (const line of formatAuditRows(displayed, rich)) {
    runtime.log(line);
  }
}

export async function tasksReportCommand(
  opts: { json?: boolean; runtime?: string; status?: string; limit?: number },
  runtime: RuntimeEnv,
) {
  configureTaskMaintenanceFromConfig();
  const report = buildTaskAutomationReport(opts);

  if (opts.json) {
    runtime.log(JSON.stringify(report, null, 2));
    return;
  }

  runtime.log(info("Background automation report"));
  runtime.log(
    info(
      `Tasks: ${report.tasks.total} total · ${report.tasks.active} active · ${report.tasks.failures} issues`,
    ),
  );
  runtime.log(info(`Task status: ${formatCountPairs(report.tasks.byStatus, TASK_STATUSES)}`));
  runtime.log(info(`Runtimes: ${formatCountPairs(report.tasks.byRuntime, TASK_RUNTIMES)}`));
  runtime.log(
    info(`Delivery: ${formatCountPairs(report.tasks.byDeliveryStatus, TASK_DELIVERY_STATUSES)}`),
  );
  runtime.log(
    info(
      `TaskFlow: ${report.taskFlows.total} total · ${report.taskFlows.active} active · ${formatCountPairs(report.taskFlows.byStatus, TASK_FLOW_STATUSES)}`,
    ),
  );
  runtime.log(
    info(
      `Audit: ${report.audit.total} findings · ${report.audit.errors} errors · ${report.audit.warnings} warnings`,
    ),
  );
  const durations = report.tasks.completedDurationMs;
  runtime.log(
    info(
      `Completed task duration: ${durations.count} samples · avg ${formatDurationCompact(durations.avgMs)} · p95 ${formatDurationCompact(durations.p95Ms)} · max ${formatDurationCompact(durations.maxMs)}`,
    ),
  );

  if (report.filters.runtime) {
    runtime.log(info(`Runtime filter: ${report.filters.runtime}`));
  }
  if (report.filters.status) {
    runtime.log(info(`Status filter: ${report.filters.status}`));
  }

  const rich = isRich();
  if (report.activeTasks.length > 0) {
    runtime.log("");
    runtime.log(info(`Active tasks (${report.activeTasks.length}):`));
    for (const line of formatTaskRows(report.activeTasks, rich)) {
      runtime.log(line);
    }
  }
  if (report.recentIssues.length > 0) {
    runtime.log("");
    runtime.log(info(`Recent task issues (${report.recentIssues.length}):`));
    for (const line of formatTaskRows(report.recentIssues, rich)) {
      runtime.log(line);
    }
    return;
  }
  runtime.log("");
  runtime.log("No recent task issues.");
}

export async function tasksMaintenanceCommand(
  opts: { json?: boolean; apply?: boolean },
  runtime: RuntimeEnv,
) {
  configureTaskMaintenanceFromConfig();
  const auditBefore = getInspectableTaskAuditSummary();
  const flowAuditBefore = getInspectableTaskFlowAuditSummary();
  const taskMaintenance = opts.apply
    ? await runTaskRegistryMaintenance()
    : previewTaskRegistryMaintenance();
  const flowMaintenance = opts.apply
    ? await runTaskFlowRegistryMaintenance()
    : previewTaskFlowRegistryMaintenance();
  const summary = getInspectableTaskRegistrySummary();
  const auditAfter = opts.apply ? getInspectableTaskAuditSummary() : auditBefore;
  const flowAuditAfter = opts.apply ? getInspectableTaskFlowAuditSummary() : flowAuditBefore;

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          mode: opts.apply ? "apply" : "preview",
          maintenance: {
            tasks: taskMaintenance,
            taskFlows: flowMaintenance,
          },
          tasks: summary,
          auditBefore: {
            ...auditBefore,
            taskFlows: flowAuditBefore,
          },
          auditAfter: {
            ...auditAfter,
            taskFlows: flowAuditAfter,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(
    info(
      `Tasks maintenance (${opts.apply ? "applied" : "preview"}): tasks ${taskMaintenance.reconciled} reconcile · ${taskMaintenance.recovered} recovered · ${taskMaintenance.cleanupStamped} cleanup stamp · ${taskMaintenance.pruned} prune; task-flows ${flowMaintenance.reconciled} reconcile · ${flowMaintenance.pruned} prune`,
    ),
  );
  runtime.log(
    info(
      `${opts.apply ? "Tasks health after apply" : "Tasks health"}: ${summary.byStatus.queued} queued · ${summary.byStatus.running} running · ${auditAfter.errors + flowAuditAfter.errors} audit errors · ${auditAfter.warnings + flowAuditAfter.warnings} audit warnings`,
    ),
  );
  if (opts.apply) {
    runtime.log(
      info(
        `Tasks health before apply: ${auditBefore.errors + flowAuditBefore.errors} audit errors · ${auditBefore.warnings + flowAuditBefore.warnings} audit warnings`,
      ),
    );
  }
  if (!opts.apply) {
    runtime.log("Dry run only. Re-run with `kova tasks maintenance --apply` to write changes.");
  }
}
