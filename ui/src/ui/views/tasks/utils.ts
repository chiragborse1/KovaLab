import type { CronDraft, Task, TaskSource, TaskStatus } from "./types.ts";

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "queued",
  "running",
  "completed",
  "failed",
  "needs_approval",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  needs_approval: "Needs Approval",
};

export const TASK_STATUS_ICONS: Record<TaskStatus, string> = {
  queued: "⏳",
  running: "⚡",
  completed: "✅",
  failed: "🔴",
  needs_approval: "👋",
};

export const TASK_SOURCE_LABELS: Record<TaskSource, string> = {
  manual: "manual",
  cron: "cron",
  telegram: "telegram",
  discord: "discord",
  pipeline: "pipeline",
};

export function formatCurrency(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `$${value.toFixed(3)}`;
}

export function formatDuration(seconds: number | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "—";
  }
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function taskTimeLabel(task: Task): string {
  if (task.status === "running") {
    return formatDuration(task.duration);
  }
  if (task.status === "completed") {
    return task.completedAt ?? "completed";
  }
  if (task.status === "failed") {
    return task.completedAt ?? "failed";
  }
  if (task.status === "queued") {
    return task.scheduledFor ? `scheduled for ${task.scheduledFor}` : `queued ${task.createdAt}`;
  }
  return task.startedAt ? `waiting since ${task.startedAt}` : `created ${task.createdAt}`;
}

export function statusClass(status: TaskStatus): string {
  return `task-status-${status.replace("_", "-")}`;
}

export function sourceClass(source: TaskSource): string {
  return `task-source-${source}`;
}

export function cronExpression(draft: CronDraft): string {
  if (draft.preset === "hourly") {
    return "0 * * * *";
  }
  if (draft.preset === "daily") {
    return "0 9 * * *";
  }
  if (draft.preset === "weekly") {
    return "0 9 * * 1";
  }
  return `${draft.minute || "*"} ${draft.hour || "*"} ${draft.day || "*"} ${draft.month || "*"} ${draft.weekday || "*"}`;
}

export function cronPreview(draft: CronDraft): string {
  if (draft.preset === "hourly") {
    return "Runs every hour";
  }
  if (draft.preset === "daily") {
    return "Runs every day at 9:00 AM";
  }
  if (draft.preset === "weekly") {
    return "Runs every Monday at 9:00 AM";
  }
  const weekday = draft.weekday === "1" ? "Monday" : draft.weekday || "selected weekdays";
  const hour = draft.hour && draft.hour !== "*" ? draft.hour.padStart(2, "0") : "09";
  const minute = draft.minute && draft.minute !== "*" ? draft.minute.padStart(2, "0") : "00";
  return `Runs on ${weekday} at ${hour}:${minute}`;
}

export function sortValue(task: Task, key: string): string | number {
  switch (key) {
    case "status":
      return TASK_STATUS_ORDER.indexOf(task.status);
    case "title":
      return task.title.toLowerCase();
    case "source":
      return task.source;
    case "agent":
      return task.agent;
    case "model":
      return task.model;
    case "duration":
      return task.duration ?? 0;
    case "cost":
      return task.cost ?? 0;
    case "created":
      return task.scheduledForMs ?? task.createdAtMs ?? 0;
    default:
      return task.createdAtMs ?? 0;
  }
}
