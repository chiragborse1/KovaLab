import type {
  BackendTaskRuntime,
  BackendTaskStatus,
  Task,
  TaskSource,
  TaskStatus,
  TimelineEvent,
  TaskRunView,
} from "./types.ts";
import { formatDuration } from "./utils.ts";

function formatRelativeTime(timestampMs: number | undefined, nowMs: number): string {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs)) {
    return "unknown";
  }
  const deltaMs = Math.max(0, nowMs - timestampMs);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestampMs).toLocaleDateString();
}

function mapStatus(status: BackendTaskStatus): TaskStatus {
  if (status === "succeeded") {
    return "completed";
  }
  if (
    status === "failed" ||
    status === "timed_out" ||
    status === "cancelled" ||
    status === "lost"
  ) {
    return "failed";
  }
  return status;
}

function mapSource(runtime: BackendTaskRuntime, sourceId: string | undefined): TaskSource {
  const source = sourceId?.toLowerCase() ?? "";
  if (source.includes("telegram")) {
    return "telegram";
  }
  if (source.includes("discord")) {
    return "discord";
  }
  if (runtime === "cron") {
    return "cron";
  }
  if (runtime === "acp" || runtime === "subagent") {
    return "pipeline";
  }
  return "manual";
}

function resolveAgentName(task: TaskRunView): string {
  if (task.agentId?.trim()) {
    return task.agentId.trim();
  }
  const sessionMatch = /^agent:([^:]+)/.exec(task.sessionKey);
  return sessionMatch?.[1] ?? "main";
}

function resolveDuration(task: TaskRunView, nowMs: number): number | undefined {
  if (typeof task.startedAt !== "number") {
    return undefined;
  }
  const end = typeof task.endedAt === "number" ? task.endedAt : nowMs;
  return Math.max(0, Math.floor((end - task.startedAt) / 1000));
}

function buildOutput(task: TaskRunView): string {
  const lines = [
    task.progressSummary,
    task.terminalSummary,
    task.error ? `Error: ${task.error}` : undefined,
  ].filter((line): line is string => Boolean(line?.trim()));
  if (lines.length > 0) {
    return lines.join("\n");
  }
  if (task.status === "running") {
    return "Task is running. Live output is tracked by the owning runtime.";
  }
  if (task.status === "queued") {
    return "Task is queued.";
  }
  return "No output summary recorded for this task.";
}

function buildTimeline(task: TaskRunView, nowMs: number): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      timestamp: formatRelativeTime(task.createdAt, nowMs),
      timestampMs: task.createdAt,
      type: "created",
      label: "Task created",
    },
  ];
  if (typeof task.startedAt === "number") {
    events.push({
      timestamp: formatRelativeTime(task.startedAt, nowMs),
      timestampMs: task.startedAt,
      type: "started",
      label: "Task started",
    });
  } else if (task.status === "queued") {
    events.push({
      timestamp: formatRelativeTime(task.createdAt, nowMs),
      timestampMs: task.createdAt,
      type: "queued",
      label: "Queued for execution",
    });
  }
  if (typeof task.lastEventAt === "number" && task.progressSummary) {
    events.push({
      timestamp: formatRelativeTime(task.lastEventAt, nowMs),
      timestampMs: task.lastEventAt,
      type: "tool_call",
      label: task.progressSummary,
    });
  }
  if (typeof task.endedAt === "number") {
    events.push({
      timestamp: formatRelativeTime(task.endedAt, nowMs),
      timestampMs: task.endedAt,
      type: task.status === "succeeded" ? "completed" : "failed",
      label:
        task.terminalSummary ??
        task.error ??
        (task.status === "succeeded" ? "Completed successfully" : `Ended as ${task.status}`),
    });
  }
  return events;
}

export function mapGatewayTask(task: TaskRunView, nowMs = Date.now()): Task {
  const status = mapStatus(task.status);
  const duration = resolveDuration(task, nowMs);
  const createdAt = formatRelativeTime(task.createdAt, nowMs);
  const endedLabel =
    typeof task.endedAt === "number"
      ? `${status === "completed" ? "completed" : task.status.replace("_", " ")} ${formatRelativeTime(task.endedAt, nowMs)}`
      : undefined;
  return {
    id: task.id,
    title: task.title?.trim() || task.label?.trim() || "Background task",
    status,
    backendStatus: task.status,
    source: mapSource(task.runtime, task.sourceId),
    runtime: task.runtime,
    sourceId: task.sourceId,
    sessionKey: task.sessionKey,
    runId: task.runId,
    deliveryStatus: task.deliveryStatus,
    notifyPolicy: task.notifyPolicy,
    progressSummary: task.progressSummary,
    terminalSummary: task.terminalSummary,
    agent: resolveAgentName(task),
    model: "agent default",
    duration,
    createdAt,
    createdAtMs: task.createdAt,
    startedAt:
      typeof task.startedAt === "number" ? formatRelativeTime(task.startedAt, nowMs) : undefined,
    startedAtMs: task.startedAt,
    completedAt: endedLabel,
    completedAtMs: task.endedAt,
    error: task.error ?? (task.status === "cancelled" ? "Task cancelled." : undefined),
    output: buildOutput(task),
    timeline: buildTimeline(task, nowMs),
  };
}

export function tickGatewayTasks(tasks: Task[], tickAtMs: number): Task[] {
  return tasks.map((task) => {
    if (task.status !== "running" || typeof task.startedAtMs !== "number") {
      return task;
    }
    return {
      ...task,
      duration: Math.max(0, Math.floor((tickAtMs - task.startedAtMs) / 1000)),
      startedAt: formatRelativeTime(task.startedAtMs, tickAtMs),
      output: task.progressSummary?.trim()
        ? task.progressSummary
        : `Task is running. Elapsed: ${formatDuration(
            Math.max(0, Math.floor((tickAtMs - task.startedAtMs) / 1000)),
          )}`,
    };
  });
}
