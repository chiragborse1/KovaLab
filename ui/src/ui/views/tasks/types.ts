import type { AgentsListResult, ModelCatalogEntry, SessionsListResult } from "../../types.ts";

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "needs_approval";
export type TaskSource = "manual" | "cron" | "telegram" | "discord" | "pipeline";
export type TaskViewMode = "board" | "list";
export type TaskRunMode = "now" | "scheduled" | "recurring";
export type TaskDetailTab = "overview" | "output" | "timeline";
export type TaskOnComplete = "none" | "notification" | "chain";

export interface TimelineEvent {
  timestamp: string;
  timestampMs?: number;
  type: "created" | "queued" | "started" | "tool_call" | "completed" | "failed";
  label: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  source: TaskSource;
  agent: string;
  model: string;
  cost?: number;
  tokensUsed?: number;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  scheduledFor?: string;
  error?: string;
  approvalRequest?: string;
  output?: string;
  timeline?: TimelineEvent[];
  createdAtMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  scheduledForMs?: number;
}

export interface TaskTemplate {
  id: string;
  icon: string;
  name: string;
  description: string;
  defaultTitle: string;
  defaultNotes: string;
}

export interface CronDraft {
  preset: "hourly" | "daily" | "weekly" | "custom";
  minute: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
}

export interface NewTaskDraft {
  title: string;
  agent: string;
  runMode: TaskRunMode;
  scheduledFor: string;
  cron: CronDraft;
  urlDraft: string;
  urls: string[];
  sessionRef: string;
  notes: string;
  onComplete: TaskOnComplete;
  chainedTaskTitle: string;
  useDefaultModel: boolean;
  modelOverride: string;
  initialStatus?: TaskStatus;
}

export interface TaskActionHandlers {
  onOpen: (task: Task) => void;
  onRetry: (taskId: string) => void;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export interface TasksPageProps {
  agentsList: AgentsListResult | null;
  sessionsResult: SessionsListResult | null;
  modelCatalog: ModelCatalogEntry[];
  onNavigateToCron?: () => void;
}
