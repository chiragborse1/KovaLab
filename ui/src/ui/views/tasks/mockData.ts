import type { NewTaskDraft, Task, TaskTemplate } from "./types.ts";

// TODO: Replace with real gateway API calls when tasks endpoint is available.
export const TASKS_API_MODE: "mock" | "gateway" = "mock";

const now = Date.now();

function minutesAgo(minutes: number): number {
  return now - minutes * 60_000;
}

function hoursAgo(hours: number): number {
  return now - hours * 60 * 60_000;
}

export const MOCK_TASKS: Task[] = [
  {
    id: "task_001",
    title: "Morning briefing summary",
    status: "completed",
    source: "cron",
    agent: "main",
    model: "gpt-5.5",
    cost: 0.023,
    tokensUsed: 8420,
    duration: 142,
    createdAt: "2h ago",
    createdAtMs: hoursAgo(2),
    startedAt: "2h ago",
    startedAtMs: hoursAgo(2) + 60_000,
    completedAt: "completed 2h ago",
    completedAtMs: hoursAgo(2) + 202_000,
    output:
      "Briefing complete.\n- No critical channel messages.\n- One active coding session.\n- Memory index is healthy.",
    timeline: [
      {
        timestamp: "2h ago",
        timestampMs: hoursAgo(2),
        type: "created",
        label: "Task created from cron schedule",
      },
      {
        timestamp: "2h ago",
        timestampMs: hoursAgo(2) + 60_000,
        type: "started",
        label: "Agent main started execution",
      },
      {
        timestamp: "2h ago",
        timestampMs: hoursAgo(2) + 85_000,
        type: "tool_call",
        label: "Called sessions.list",
      },
      {
        timestamp: "2h ago",
        timestampMs: hoursAgo(2) + 202_000,
        type: "completed",
        label: "Completed successfully",
      },
    ],
  },
  {
    id: "task_002",
    title: "Summarize Telegram messages from @wotmeno",
    status: "running",
    source: "telegram",
    agent: "main",
    model: "openrouter/auto",
    cost: 0.008,
    tokensUsed: 3100,
    duration: 240,
    createdAt: "4m ago",
    createdAtMs: minutesAgo(4),
    startedAt: "4m ago",
    startedAtMs: minutesAgo(4),
    output:
      "Reading recent Telegram messages...\nGrouping replies by sender...\nDrafting short summary...",
    timeline: [
      {
        timestamp: "4m ago",
        timestampMs: minutesAgo(4),
        type: "created",
        label: "Task created from Telegram trigger",
      },
      {
        timestamp: "4m ago",
        timestampMs: minutesAgo(4) + 5_000,
        type: "started",
        label: "Agent main started execution",
      },
      {
        timestamp: "3m ago",
        timestampMs: minutesAgo(3),
        type: "tool_call",
        label: "Called message.read: telegram",
      },
    ],
  },
  {
    id: "task_003",
    title: "Memory Dreaming Promotion",
    status: "queued",
    source: "cron",
    agent: "main",
    model: "openrouter/auto",
    createdAt: "just now",
    createdAtMs: now - 20_000,
    scheduledFor: "Tonight at 11:00 PM",
    scheduledForMs: now + 7 * 60 * 60_000,
    output: "Waiting for scheduled start.",
    timeline: [
      { timestamp: "just now", timestampMs: now - 20_000, type: "created", label: "Task created" },
      {
        timestamp: "just now",
        timestampMs: now - 18_000,
        type: "queued",
        label: "Queued for tonight at 11:00 PM",
      },
    ],
  },
  {
    id: "task_004",
    title: "Refactor kova/src/agents folder",
    status: "needs_approval",
    source: "manual",
    agent: "main",
    model: "gpt-5.5",
    createdAt: "12m ago",
    createdAtMs: minutesAgo(12),
    startedAt: "11m ago",
    startedAtMs: minutesAgo(11),
    approvalRequest: "Agent wants to run: exec rm -rf dist/ && pnpm build",
    output:
      "Plan prepared.\nWaiting for human approval before running a destructive cleanup command.",
    timeline: [
      {
        timestamp: "12m ago",
        timestampMs: minutesAgo(12),
        type: "created",
        label: "Manual task created",
      },
      {
        timestamp: "11m ago",
        timestampMs: minutesAgo(11),
        type: "started",
        label: "Agent inspected workspace",
      },
      {
        timestamp: "10m ago",
        timestampMs: minutesAgo(10),
        type: "tool_call",
        label: "Requested elevated exec approval",
      },
    ],
  },
  {
    id: "task_005",
    title: "Weekly cost report generation",
    status: "failed",
    source: "cron",
    agent: "main",
    model: "openrouter/auto",
    error: "Gateway timeout after 300s",
    cost: 0.041,
    tokensUsed: 12_900,
    duration: 300,
    createdAt: "1h ago",
    createdAtMs: hoursAgo(1),
    startedAt: "59m ago",
    startedAtMs: minutesAgo(59),
    completedAt: "failed 54m ago",
    completedAtMs: minutesAgo(54),
    output: "Collecting usage data...\nGateway timeout after 300s.",
    timeline: [
      {
        timestamp: "1h ago",
        timestampMs: hoursAgo(1),
        type: "created",
        label: "Task created from cron schedule",
      },
      {
        timestamp: "59m ago",
        timestampMs: minutesAgo(59),
        type: "started",
        label: "Agent started cost report",
      },
      {
        timestamp: "54m ago",
        timestampMs: minutesAgo(54),
        type: "failed",
        label: "Gateway timeout after 300s",
      },
    ],
  },
];

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "daily-briefing",
    icon: "🌅",
    name: "Daily Briefing",
    description: "Summarize recent sessions and messages every morning",
    defaultTitle: "Daily briefing",
    defaultNotes: "Summarize recent sessions, messages, costs, and any blocked tasks.",
  },
  {
    id: "inbox-triage",
    icon: "📥",
    name: "Inbox Triage",
    description: "Review and categorize incoming channel messages",
    defaultTitle: "Inbox triage",
    defaultNotes: "Review new channel messages, group them by priority, and suggest replies.",
  },
  {
    id: "memory-consolidation",
    icon: "🧠",
    name: "Memory Consolidation",
    description: "Compress and organize agent memory files",
    defaultTitle: "Memory consolidation",
    defaultNotes: "Review memory files, consolidate duplicate notes, and summarize durable facts.",
  },
  {
    id: "weekly-summary",
    icon: "📋",
    name: "Weekly Summary",
    description: "Generate a weekly activity and cost report",
    defaultTitle: "Weekly activity summary",
    defaultNotes: "Create a weekly summary covering sessions, jobs, costs, and failed tasks.",
  },
  {
    id: "code-review",
    icon: "🔍",
    name: "Code Review",
    description: "Review recent code changes in the workspace",
    defaultTitle: "Review recent code changes",
    defaultNotes: "Inspect recent git changes and report bugs, regressions, and missing tests.",
  },
  {
    id: "custom",
    icon: "⚡",
    name: "Custom",
    description: "Start from scratch",
    defaultTitle: "",
    defaultNotes: "",
  },
];

export function createInitialTasks(): Task[] {
  return MOCK_TASKS.map((task) => ({
    ...task,
    timeline: task.timeline?.map((event) => ({ ...event })),
  }));
}

export function tickMockTasks(tasks: Task[], tickAtMs: number): Task[] {
  return tasks.map((task) => {
    if (task.status !== "running") {
      return task;
    }
    const startedAtMs = task.startedAtMs ?? tickAtMs;
    const duration = Math.max(0, Math.floor((tickAtMs - startedAtMs) / 1000));
    const cost = Number(((task.cost ?? 0) + 0.0015).toFixed(4));
    const tokensUsed = (task.tokensUsed ?? 0) + 180;
    return {
      ...task,
      cost,
      duration,
      tokensUsed,
      output: `${task.output ?? ""}\n${new Date(tickAtMs).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })} streamed task heartbeat`,
    };
  });
}

export function createTaskFromDraft(draft: NewTaskDraft, model: string): Task {
  const createdAtMs = Date.now();
  const isNow = draft.runMode === "now";
  const id = `task_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    title: draft.title.trim(),
    status: isNow ? "running" : "queued",
    source: "manual",
    agent: draft.agent || "main",
    model,
    cost: isNow ? 0.001 : undefined,
    tokensUsed: isNow ? 120 : undefined,
    duration: isNow ? 0 : undefined,
    createdAt: "just now",
    createdAtMs,
    startedAt: isNow ? "just now" : undefined,
    startedAtMs: isNow ? createdAtMs : undefined,
    scheduledFor:
      draft.runMode === "scheduled"
        ? draft.scheduledFor
        : draft.runMode === "recurring"
          ? "Recurring schedule"
          : undefined,
    output: draft.notes.trim()
      ? `Task created with notes:\n${draft.notes.trim()}`
      : "Task created.",
    timeline: [
      {
        timestamp: "just now",
        timestampMs: createdAtMs,
        type: "created",
        label: "Task created manually",
      },
      {
        timestamp: "just now",
        timestampMs: createdAtMs,
        type: isNow ? "started" : "queued",
        label: isNow ? "Agent started execution" : "Task queued for schedule",
      },
    ],
  };
}
