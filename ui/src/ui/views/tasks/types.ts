import type { GatewayBrowserClient } from "../../gateway.ts";
import type { AgentsListResult, ModelCatalogEntry, SessionsListResult } from "../../types.ts";

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "needs_approval";
export type TaskSource = "manual" | "cron" | "telegram" | "discord" | "pipeline";
export type TaskViewMode = "board" | "list";
export type TaskRunMode = "now" | "scheduled" | "recurring";
export type TaskDetailTab = "overview" | "output" | "timeline";
export type TaskOnComplete = "none" | "notification" | "chain";
export type BackendTaskRuntime = "subagent" | "acp" | "cli" | "cron";
export type BackendTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "lost";
export type BackendTaskDeliveryStatus =
  | "pending"
  | "delivered"
  | "session_queued"
  | "failed"
  | "parent_missing"
  | "not_applicable";
export type BackendTaskNotifyPolicy = "done_only" | "state_changes" | "silent";

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
  backendStatus?: BackendTaskStatus;
  source: TaskSource;
  runtime?: BackendTaskRuntime;
  sourceId?: string;
  sessionKey?: string;
  runId?: string;
  deliveryStatus?: BackendTaskDeliveryStatus;
  notifyPolicy?: BackendTaskNotifyPolicy;
  progressSummary?: string;
  terminalSummary?: string;
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
  client: GatewayBrowserClient | null;
  sessionKey?: string | null;
  agentsList: AgentsListResult | null;
  sessionsResult: SessionsListResult | null;
  modelCatalog: ModelCatalogEntry[];
  onNavigateToCron?: () => void;
}

export interface TaskRunView {
  id: string;
  runtime: BackendTaskRuntime;
  sourceId?: string;
  sessionKey: string;
  ownerKey: string;
  scope: "session" | "system";
  childSessionKey?: string;
  flowId?: string;
  parentTaskId?: string;
  agentId?: string;
  runId?: string;
  label?: string;
  title: string;
  status: BackendTaskStatus;
  deliveryStatus: BackendTaskDeliveryStatus;
  notifyPolicy: BackendTaskNotifyPolicy;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  lastEventAt?: number;
  cleanupAfter?: number;
  error?: string;
  progressSummary?: string;
  terminalSummary?: string;
  terminalOutcome?: "succeeded" | "blocked";
}

export interface TasksListResult {
  tasks: TaskRunView[];
  count: number;
}
