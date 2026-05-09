import { Type, type Static } from "typebox";
import { NonEmptyString } from "./primitives.js";

const TaskRuntimeSchema = Type.Union([
  Type.Literal("subagent"),
  Type.Literal("acp"),
  Type.Literal("cli"),
  Type.Literal("cron"),
]);

const TaskStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("succeeded"),
  Type.Literal("failed"),
  Type.Literal("timed_out"),
  Type.Literal("cancelled"),
  Type.Literal("lost"),
]);

const TaskDeliveryStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("delivered"),
  Type.Literal("session_queued"),
  Type.Literal("failed"),
  Type.Literal("parent_missing"),
  Type.Literal("not_applicable"),
]);

const TaskNotifyPolicySchema = Type.Union([
  Type.Literal("done_only"),
  Type.Literal("state_changes"),
  Type.Literal("silent"),
]);

const TaskScopeSchema = Type.Union([Type.Literal("session"), Type.Literal("system")]);

const TaskTerminalOutcomeSchema = Type.Union([Type.Literal("succeeded"), Type.Literal("blocked")]);

const TaskStatusCountsSchema = Type.Object(
  {
    queued: Type.Number(),
    running: Type.Number(),
    succeeded: Type.Number(),
    failed: Type.Number(),
    timed_out: Type.Number(),
    cancelled: Type.Number(),
    lost: Type.Number(),
  },
  { additionalProperties: false },
);

const TaskRuntimeCountsSchema = Type.Object(
  {
    subagent: Type.Number(),
    acp: Type.Number(),
    cli: Type.Number(),
    cron: Type.Number(),
  },
  { additionalProperties: false },
);

export const TaskRunAggregateSummarySchema = Type.Object(
  {
    total: Type.Number(),
    active: Type.Number(),
    terminal: Type.Number(),
    failures: Type.Number(),
    byStatus: TaskStatusCountsSchema,
    byRuntime: TaskRuntimeCountsSchema,
  },
  { additionalProperties: false },
);

export const TaskRunViewSchema = Type.Object(
  {
    id: NonEmptyString,
    runtime: TaskRuntimeSchema,
    sourceId: Type.Optional(NonEmptyString),
    sessionKey: NonEmptyString,
    ownerKey: NonEmptyString,
    scope: TaskScopeSchema,
    childSessionKey: Type.Optional(NonEmptyString),
    flowId: Type.Optional(NonEmptyString),
    parentTaskId: Type.Optional(NonEmptyString),
    agentId: Type.Optional(NonEmptyString),
    runId: Type.Optional(NonEmptyString),
    label: Type.Optional(NonEmptyString),
    title: Type.String(),
    status: TaskStatusSchema,
    deliveryStatus: TaskDeliveryStatusSchema,
    notifyPolicy: TaskNotifyPolicySchema,
    createdAt: Type.Number(),
    startedAt: Type.Optional(Type.Number()),
    endedAt: Type.Optional(Type.Number()),
    lastEventAt: Type.Optional(Type.Number()),
    cleanupAfter: Type.Optional(Type.Number()),
    error: Type.Optional(Type.String()),
    progressSummary: Type.Optional(Type.String()),
    terminalSummary: Type.Optional(Type.String()),
    terminalOutcome: Type.Optional(TaskTerminalOutcomeSchema),
  },
  { additionalProperties: false },
);

export const TasksListParamsSchema = Type.Object(
  {
    status: Type.Optional(Type.Union([TaskStatusSchema, Type.Literal("all")])),
    runtime: Type.Optional(Type.Union([TaskRuntimeSchema, Type.Literal("all")])),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
  },
  { additionalProperties: false },
);

export type TasksListParams = Static<typeof TasksListParamsSchema>;

export const TasksListResultSchema = Type.Object(
  {
    tasks: Type.Array(TaskRunViewSchema),
    summary: TaskRunAggregateSummarySchema,
    count: Type.Number(),
  },
  { additionalProperties: false },
);

export type TasksListResult = Static<typeof TasksListResultSchema>;

export const TasksShowParamsSchema = Type.Object(
  {
    lookup: NonEmptyString,
  },
  { additionalProperties: false },
);

export type TasksShowParams = Static<typeof TasksShowParamsSchema>;

export const TasksShowResultSchema = Type.Object(
  {
    task: TaskRunViewSchema,
  },
  { additionalProperties: false },
);

export type TasksShowResult = Static<typeof TasksShowResultSchema>;

export const TasksCancelParamsSchema = Type.Object(
  {
    lookup: NonEmptyString,
  },
  { additionalProperties: false },
);

export type TasksCancelParams = Static<typeof TasksCancelParamsSchema>;

export const TasksCancelResultSchema = Type.Object(
  {
    found: Type.Boolean(),
    cancelled: Type.Boolean(),
    reason: Type.Optional(Type.String()),
    task: Type.Optional(TaskRunViewSchema),
  },
  { additionalProperties: false },
);

export type TasksCancelResult = Static<typeof TasksCancelResultSchema>;

export const TasksDeleteParamsSchema = Type.Object(
  {
    taskId: NonEmptyString,
    force: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export type TasksDeleteParams = Static<typeof TasksDeleteParamsSchema>;

export const TasksDeleteResultSchema = Type.Object(
  {
    deleted: Type.Boolean(),
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type TasksDeleteResult = Static<typeof TasksDeleteResultSchema>;

export const TasksNotifyParamsSchema = Type.Object(
  {
    lookup: NonEmptyString,
    notifyPolicy: TaskNotifyPolicySchema,
  },
  { additionalProperties: false },
);

export type TasksNotifyParams = Static<typeof TasksNotifyParamsSchema>;

export const TasksNotifyResultSchema = Type.Object(
  {
    updated: Type.Boolean(),
    task: Type.Optional(TaskRunViewSchema),
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type TasksNotifyResult = Static<typeof TasksNotifyResultSchema>;
