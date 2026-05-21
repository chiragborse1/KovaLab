import type { SkillStatusReport } from "../agents/skills-status.js";
import type {
  CommandEntry,
  CommandsListParams,
  SessionsListParams,
  SessionsPatchParams,
  SessionsPatchResult,
  ToolsCatalogResult,
} from "../gateway/protocol/index.js";
import type { TaskRunAggregateSummary, TaskRunView } from "../plugins/runtime/task-domain-types.js";
import type { TaskFlowAuditSummary } from "../tasks/task-flow-registry.audit.js";
import type { TaskFlowRegistryMaintenanceSummary } from "../tasks/task-flow-registry.maintenance.js";
import type { TaskAuditSummary } from "../tasks/task-registry.audit.js";
import type { TaskRegistryMaintenanceSummary } from "../tasks/task-registry.maintenance.js";
import type { ResponseUsageMode, SessionInfo, SessionScope } from "./tui-types.js";

export type ChatSendOptions = {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  timeoutMs?: number;
  runId?: string;
};

export type TuiEvent = {
  event: string;
  payload?: unknown;
  seq?: number;
};

export type TuiSessionList = {
  ts: number;
  path: string;
  count: number;
  defaults?: {
    model?: string | null;
    modelProvider?: string | null;
    contextTokens?: number | null;
  };
  sessions: Array<
    Pick<
      SessionInfo,
      | "thinkingLevel"
      | "fastMode"
      | "verboseLevel"
      | "reasoningLevel"
      | "model"
      | "contextTokens"
      | "inputTokens"
      | "outputTokens"
      | "totalTokens"
      | "modelProvider"
      | "displayName"
    > & {
      key: string;
      sessionId?: string;
      updatedAt?: number | null;
      fastMode?: boolean;
      sendPolicy?: string;
      responseUsage?: ResponseUsageMode;
      label?: string;
      provider?: string;
      groupChannel?: string;
      space?: string;
      subject?: string;
      chatType?: string;
      lastProvider?: string;
      lastTo?: string;
      lastAccountId?: string;
      derivedTitle?: string;
      lastMessagePreview?: string;
    }
  >;
};

export type TuiAgentsList = {
  defaultId: string;
  mainKey: string;
  scope: SessionScope;
  agents: Array<{
    id: string;
    name?: string;
  }>;
};

export type TuiModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

export type TuiTasksList = {
  tasks: TaskRunView[];
  summary: TaskRunAggregateSummary;
  count: number;
};

export type TuiTasksAudit = {
  tasks: TaskAuditSummary;
  flows: TaskFlowAuditSummary;
};

export type TuiTasksMaintenance = {
  apply: boolean;
  tasks: TaskRegistryMaintenanceSummary;
  flows: TaskFlowRegistryMaintenanceSummary;
};

export type TuiBackend = {
  connection: {
    url: string;
    token?: string;
    password?: string;
  };
  onEvent?: (evt: TuiEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;
  start: () => void;
  stop: () => void;
  sendChat: (opts: ChatSendOptions) => Promise<{ runId: string }>;
  steerChat?: (opts: {
    sessionKey: string;
    message: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  abortChat: (opts: {
    sessionKey: string;
    runId: string;
  }) => Promise<{ ok: boolean; aborted: boolean }>;
  loadHistory: (opts: { sessionKey: string; limit?: number }) => Promise<unknown>;
  listSessions: (opts?: SessionsListParams) => Promise<TuiSessionList>;
  listAgents: () => Promise<TuiAgentsList>;
  patchSession: (opts: SessionsPatchParams) => Promise<SessionsPatchResult>;
  resetSession: (key: string, reason?: "new" | "reset") => Promise<unknown>;
  getGatewayStatus: () => Promise<unknown>;
  listModels: () => Promise<TuiModelChoice[]>;
  listCommands?: (opts?: CommandsListParams) => Promise<CommandEntry[]>;
  listTools?: (opts: { agentId: string; includePlugins?: boolean }) => Promise<ToolsCatalogResult>;
  listSkills?: (opts: { agentId: string }) => Promise<SkillStatusReport>;
  listTasks?: (opts?: {
    status?: string;
    runtime?: string;
    limit?: number;
  }) => Promise<TuiTasksList>;
  auditTasks?: () => Promise<TuiTasksAudit>;
  maintainTasks?: (opts?: { apply?: boolean }) => Promise<TuiTasksMaintenance>;
};
