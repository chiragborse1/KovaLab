import AjvPkg, { type AnySchema, type ErrorObject, type ValidateFunction } from "ajv";
import type { SessionsPatchResult } from "../session-utils.types.js";
import {
  type AgentEvent,
  AgentEventSchema,
  type AgentIdentityParams,
  AgentIdentityParamsSchema,
  type AgentIdentityResult,
  AgentIdentityResultSchema,
  AgentParamsSchema,
  type MessageActionParams,
  MessageActionParamsSchema,
  type AgentSummary,
  AgentSummarySchema,
  type AgentsFileEntry,
  AgentsFileEntrySchema,
  type AgentsCreateParams,
  AgentsCreateParamsSchema,
  type AgentsCreateResult,
  AgentsCreateResultSchema,
  type AgentsUpdateParams,
  AgentsUpdateParamsSchema,
  type AgentsUpdateResult,
  AgentsUpdateResultSchema,
  type AgentsDeleteParams,
  AgentsDeleteParamsSchema,
  type AgentsDeleteResult,
  AgentsDeleteResultSchema,
  type AgentsFilesGetParams,
  AgentsFilesGetParamsSchema,
  type AgentsFilesGetResult,
  AgentsFilesGetResultSchema,
  type AgentsFilesListParams,
  AgentsFilesListParamsSchema,
  type AgentsFilesListResult,
  AgentsFilesListResultSchema,
  type AgentsFilesSetParams,
  AgentsFilesSetParamsSchema,
  type AgentsFilesSetResult,
  AgentsFilesSetResultSchema,
  type AgentsListParams,
  AgentsListParamsSchema,
  type AgentsListResult,
  AgentsListResultSchema,
  type AgentWaitParams,
  AgentWaitParamsSchema,
  type ChannelsStartParams,
  ChannelsStartParamsSchema,
  type ChannelsLogoutParams,
  ChannelsLogoutParamsSchema,
  type TalkConfigParams,
  TalkConfigParamsSchema,
  type TalkConfigResult,
  TalkConfigResultSchema,
  type TalkRealtimeSessionParams,
  TalkRealtimeSessionParamsSchema,
  type TalkRealtimeSessionResult,
  TalkRealtimeSessionResultSchema,
  type TalkSpeakParams,
  TalkSpeakParamsSchema,
  type TalkSpeakResult,
  TalkSpeakResultSchema,
  type ChannelsStatusParams,
  ChannelsStatusParamsSchema,
  type ChannelsStatusResult,
  ChannelsStatusResultSchema,
  type CommandEntry,
  type CommandsListParams,
  CommandsListParamsSchema,
  type CommandsListResult,
  CommandsListResultSchema,
  type ChatAbortParams,
  ChatAbortParamsSchema,
  type ChatEvent,
  ChatEventSchema,
  ChatHistoryParamsSchema,
  type ChatInjectParams,
  ChatInjectParamsSchema,
  ChatSendParamsSchema,
  type ConfigApplyParams,
  ConfigApplyParamsSchema,
  type ConfigGetParams,
  ConfigGetParamsSchema,
  type ConfigPatchParams,
  ConfigPatchParamsSchema,
  type ConfigSchemaLookupParams,
  ConfigSchemaLookupParamsSchema,
  type ConfigSchemaLookupResult,
  ConfigSchemaLookupResultSchema,
  type ConfigSchemaParams,
  ConfigSchemaParamsSchema,
  type ConfigSchemaResponse,
  ConfigSchemaResponseSchema,
  type ConfigSetParams,
  ConfigSetParamsSchema,
  type UpdateStatusParams,
  UpdateStatusParamsSchema,
  type ConnectParams,
  ConnectParamsSchema,
  type CronAddParams,
  CronAddParamsSchema,
  type CronJob,
  CronJobSchema,
  type CronListParams,
  CronListParamsSchema,
  type CronRemoveParams,
  CronRemoveParamsSchema,
  type CronRunLogEntry,
  type CronRunParams,
  CronRunParamsSchema,
  type CronRunsParams,
  CronRunsParamsSchema,
  type CronStatusParams,
  CronStatusParamsSchema,
  type CronUpdateParams,
  CronUpdateParamsSchema,
  type TasksCancelParams,
  TasksCancelParamsSchema,
  type TasksCancelResult,
  TasksCancelResultSchema,
  type TasksDeleteParams,
  TasksDeleteParamsSchema,
  type TasksDeleteResult,
  TasksDeleteResultSchema,
  type TasksListParams,
  TasksListParamsSchema,
  type TasksListResult,
  TasksListResultSchema,
  type TasksNotifyParams,
  TasksNotifyParamsSchema,
  type TasksNotifyResult,
  TasksNotifyResultSchema,
  type TasksShowParams,
  TasksShowParamsSchema,
  type TasksShowResult,
  TasksShowResultSchema,
  type DevicePairApproveParams,
  DevicePairApproveParamsSchema,
  type DevicePairListParams,
  DevicePairListParamsSchema,
  type DevicePairRemoveParams,
  DevicePairRemoveParamsSchema,
  type DevicePairRejectParams,
  DevicePairRejectParamsSchema,
  type DeviceTokenRevokeParams,
  DeviceTokenRevokeParamsSchema,
  type DeviceTokenRotateParams,
  DeviceTokenRotateParamsSchema,
  type ExecApprovalsGetParams,
  ExecApprovalsGetParamsSchema,
  type ExecApprovalsNodeGetParams,
  ExecApprovalsNodeGetParamsSchema,
  type ExecApprovalsNodeSetParams,
  ExecApprovalsNodeSetParamsSchema,
  type ExecApprovalsSetParams,
  ExecApprovalsSetParamsSchema,
  type ExecApprovalsSnapshot,
  type ExecApprovalGetParams,
  ExecApprovalGetParamsSchema,
  type ExecApprovalRequestParams,
  ExecApprovalRequestParamsSchema,
  type ExecApprovalResolveParams,
  ExecApprovalResolveParamsSchema,
  type PluginApprovalRequestParams,
  PluginApprovalRequestParamsSchema,
  type PluginApprovalResolveParams,
  PluginApprovalResolveParamsSchema,
  type PluginsInstallParams,
  PluginsInstallParamsSchema,
  type PluginsInstallResult,
  type PluginsMutationResult,
  type PluginsSetEnabledParams,
  PluginsSetEnabledParamsSchema,
  type PluginStatusDiagnostic,
  type PluginStatusSummary,
  type PluginsStatusParams,
  PluginsStatusParamsSchema,
  type PluginsStatusResult,
  type PluginsUninstallParams,
  PluginsUninstallParamsSchema,
  ErrorCodes,
  type ErrorShape,
  ErrorShapeSchema,
  type EventFrame,
  EventFrameSchema,
  errorShape,
  type GatewayFrame,
  GatewayFrameSchema,
  type HelloOk,
  HelloOkSchema,
  type LogsTailParams,
  LogsTailParamsSchema,
  type LogsTailResult,
  LogsTailResultSchema,
  type ModelsListParams,
  ModelsListParamsSchema,
  type NodeDescribeParams,
  NodeDescribeParamsSchema,
  type NodeEventParams,
  NodeEventParamsSchema,
  type NodePendingDrainParams,
  NodePendingDrainParamsSchema,
  type NodePendingDrainResult,
  NodePendingDrainResultSchema,
  type NodePendingEnqueueParams,
  NodePendingEnqueueParamsSchema,
  type NodePendingEnqueueResult,
  NodePendingEnqueueResultSchema,
  type NodeInvokeParams,
  NodeInvokeParamsSchema,
  type NodeInvokeResultParams,
  NodeInvokeResultParamsSchema,
  type NodeListParams,
  NodeListParamsSchema,
  type NodePendingAckParams,
  NodePendingAckParamsSchema,
  type NodePairApproveParams,
  NodePairApproveParamsSchema,
  type NodePairListParams,
  NodePairListParamsSchema,
  type NodePairRejectParams,
  NodePairRejectParamsSchema,
  type NodePairRemoveParams,
  NodePairRemoveParamsSchema,
  type NodePairRequestParams,
  NodePairRequestParamsSchema,
  type NodePairVerifyParams,
  NodePairVerifyParamsSchema,
  type NodeRenameParams,
  NodeRenameParamsSchema,
  type PollParams,
  PollParamsSchema,
  PROTOCOL_VERSION,
  type PushTestParams,
  PushTestParamsSchema,
  PushTestResultSchema,
  type WebPushVapidPublicKeyParams,
  WebPushVapidPublicKeyParamsSchema,
  type WebPushSubscribeParams,
  WebPushSubscribeParamsSchema,
  type WebPushUnsubscribeParams,
  WebPushUnsubscribeParamsSchema,
  type WebPushTestParams,
  WebPushTestParamsSchema,
  type PresenceEntry,
  PresenceEntrySchema,
  ProtocolSchemas,
  type RequestFrame,
  RequestFrameSchema,
  type ResponseFrame,
  ResponseFrameSchema,
  SendParamsSchema,
  type SecretsResolveParams,
  type SecretsResolveResult,
  SecretsResolveParamsSchema,
  SecretsResolveResultSchema,
  type SessionsAbortParams,
  SessionsAbortParamsSchema,
  type SessionsCompactParams,
  SessionsCompactParamsSchema,
  type SessionsCompactionBranchParams,
  SessionsCompactionBranchParamsSchema,
  type SessionsCompactionGetParams,
  SessionsCompactionGetParamsSchema,
  type SessionsCompactionListParams,
  SessionsCompactionListParamsSchema,
  type SessionsCompactionRestoreParams,
  SessionsCompactionRestoreParamsSchema,
  type SessionsCreateParams,
  SessionsCreateParamsSchema,
  type SessionsDeleteParams,
  SessionsDeleteParamsSchema,
  type SessionsListParams,
  SessionsListParamsSchema,
  type SessionsMessagesSubscribeParams,
  SessionsMessagesSubscribeParamsSchema,
  type SessionsMessagesUnsubscribeParams,
  SessionsMessagesUnsubscribeParamsSchema,
  type SessionsPatchParams,
  SessionsPatchParamsSchema,
  type SessionsPreviewParams,
  SessionsPreviewParamsSchema,
  type SessionsResetParams,
  SessionsResetParamsSchema,
  type SessionsResolveParams,
  SessionsResolveParamsSchema,
  type SessionsSendParams,
  SessionsSendParamsSchema,
  type SessionsUsageParams,
  SessionsUsageParamsSchema,
  type ShutdownEvent,
  ShutdownEventSchema,
  type SkillsBinsParams,
  SkillsBinsParamsSchema,
  type SkillsBinsResult,
  type SkillsDetailParams,
  SkillsDetailParamsSchema,
  type SkillsDetailResult,
  SkillsDetailResultSchema,
  type SkillsInstallParams,
  SkillsInstallParamsSchema,
  type SkillsUninstallParams,
  SkillsUninstallParamsSchema,
  type SkillsSearchParams,
  SkillsSearchParamsSchema,
  type SkillsSearchResult,
  SkillsSearchResultSchema,
  type SkillsStatusParams,
  SkillsStatusParamsSchema,
  type SkillsUpdateParams,
  SkillsUpdateParamsSchema,
  type ToolsCatalogParams,
  ToolsCatalogParamsSchema,
  type ToolsCatalogResult,
  type ToolsEffectiveParams,
  ToolsEffectiveParamsSchema,
  type ToolsEffectiveResult,
  type Snapshot,
  SnapshotSchema,
  type StateVersion,
  StateVersionSchema,
  type TalkModeParams,
  TalkModeParamsSchema,
  type TickEvent,
  TickEventSchema,
  type UpdateRunParams,
  UpdateRunParamsSchema,
  type WakeParams,
  WakeParamsSchema,
  type WebLoginStartParams,
  WebLoginStartParamsSchema,
  type WebLoginWaitParams,
  WebLoginWaitParamsSchema,
  type WizardCancelParams,
  WizardCancelParamsSchema,
  type WizardNextParams,
  WizardNextParamsSchema,
  type WizardNextResult,
  WizardNextResultSchema,
  type WizardStartParams,
  WizardStartParamsSchema,
  type WizardStartResult,
  WizardStartResultSchema,
  type WizardStatusParams,
  WizardStatusParamsSchema,
  type WizardStatusResult,
  WizardStatusResultSchema,
  type WizardStep,
  WizardStepSchema,
} from "./schema.js";

type AjvInstance = import("ajv").default;
type ValidationContext = Parameters<ValidateFunction>[1];

const AjvCtor = AjvPkg as unknown as new (opts?: object) => AjvInstance;

let ajv: AjvInstance | undefined;

function getAjv() {
  ajv ??= new AjvCtor({
    allErrors: true,
    strict: false,
    removeAdditional: false,
  });
  return ajv;
}

function lazyCompile<T = unknown>(schema: AnySchema): ValidateFunction<T> {
  let compiled: ValidateFunction<T> | undefined;

  const getCompiled = () => {
    compiled ??= getAjv().compile<T>(schema);
    return compiled;
  };

  const validate = ((data: unknown, dataCxt?: ValidationContext) => {
    const current = getCompiled();
    const valid = current(data, dataCxt);
    validate.errors = current.errors;
    validate.evaluated = current.evaluated;
    return valid;
  }) as ValidateFunction<T>;

  Object.defineProperties(validate, {
    errors: {
      configurable: true,
      enumerable: true,
      get: () => compiled?.errors ?? null,
      set: (errors: ErrorObject[] | null | undefined) => {
        if (compiled) {
          compiled.errors = errors ?? null;
        }
      },
    },
    evaluated: {
      configurable: true,
      enumerable: true,
      get: () => compiled?.evaluated,
      set: (evaluated: ValidateFunction<T>["evaluated"]) => {
        if (compiled) {
          compiled.evaluated = evaluated;
        }
      },
    },
    schema: {
      configurable: true,
      enumerable: true,
      get: () => compiled?.schema ?? schema,
    },
    schemaEnv: {
      configurable: true,
      enumerable: true,
      get: () => getCompiled().schemaEnv,
    },
    source: {
      configurable: true,
      enumerable: true,
      get: () => compiled?.source,
    },
  });

  return validate;
}

export const validateCommandsListParams = lazyCompile<CommandsListParams>(CommandsListParamsSchema);
export const validateConnectParams = lazyCompile<ConnectParams>(ConnectParamsSchema);
export const validateRequestFrame = lazyCompile<RequestFrame>(RequestFrameSchema);
export const validateResponseFrame = lazyCompile<ResponseFrame>(ResponseFrameSchema);
export const validateEventFrame = lazyCompile<EventFrame>(EventFrameSchema);
export const validateMessageActionParams =
  lazyCompile<MessageActionParams>(MessageActionParamsSchema);
export const validateSendParams = lazyCompile(SendParamsSchema);
export const validatePollParams = lazyCompile<PollParams>(PollParamsSchema);
export const validateAgentParams = lazyCompile(AgentParamsSchema);
export const validateAgentIdentityParams =
  lazyCompile<AgentIdentityParams>(AgentIdentityParamsSchema);
export const validateAgentWaitParams = lazyCompile<AgentWaitParams>(AgentWaitParamsSchema);
export const validateWakeParams = lazyCompile<WakeParams>(WakeParamsSchema);
export const validateAgentsListParams = lazyCompile<AgentsListParams>(AgentsListParamsSchema);
export const validateAgentsCreateParams = lazyCompile<AgentsCreateParams>(AgentsCreateParamsSchema);
export const validateAgentsUpdateParams = lazyCompile<AgentsUpdateParams>(AgentsUpdateParamsSchema);
export const validateAgentsDeleteParams = lazyCompile<AgentsDeleteParams>(AgentsDeleteParamsSchema);
export const validateAgentsFilesListParams = lazyCompile<AgentsFilesListParams>(
  AgentsFilesListParamsSchema,
);
export const validateAgentsFilesGetParams = lazyCompile<AgentsFilesGetParams>(
  AgentsFilesGetParamsSchema,
);
export const validateAgentsFilesSetParams = lazyCompile<AgentsFilesSetParams>(
  AgentsFilesSetParamsSchema,
);
export const validateNodePairRequestParams = lazyCompile<NodePairRequestParams>(
  NodePairRequestParamsSchema,
);
export const validateNodePairListParams = lazyCompile<NodePairListParams>(NodePairListParamsSchema);
export const validateNodePairApproveParams = lazyCompile<NodePairApproveParams>(
  NodePairApproveParamsSchema,
);
export const validateNodePairRejectParams = lazyCompile<NodePairRejectParams>(
  NodePairRejectParamsSchema,
);
export const validateNodePairRemoveParams = lazyCompile<NodePairRemoveParams>(
  NodePairRemoveParamsSchema,
);
export const validateNodePairVerifyParams = lazyCompile<NodePairVerifyParams>(
  NodePairVerifyParamsSchema,
);
export const validateNodeRenameParams = lazyCompile<NodeRenameParams>(NodeRenameParamsSchema);
export const validateNodeListParams = lazyCompile<NodeListParams>(NodeListParamsSchema);
export const validateNodePendingAckParams = lazyCompile<NodePendingAckParams>(
  NodePendingAckParamsSchema,
);
export const validateNodeDescribeParams = lazyCompile<NodeDescribeParams>(NodeDescribeParamsSchema);
export const validateNodeInvokeParams = lazyCompile<NodeInvokeParams>(NodeInvokeParamsSchema);
export const validateNodeInvokeResultParams = lazyCompile<NodeInvokeResultParams>(
  NodeInvokeResultParamsSchema,
);
export const validateNodeEventParams = lazyCompile<NodeEventParams>(NodeEventParamsSchema);
export const validateNodePendingDrainParams = lazyCompile<NodePendingDrainParams>(
  NodePendingDrainParamsSchema,
);
export const validateNodePendingEnqueueParams = lazyCompile<NodePendingEnqueueParams>(
  NodePendingEnqueueParamsSchema,
);
export const validatePushTestParams = lazyCompile<PushTestParams>(PushTestParamsSchema);
export const validateWebPushVapidPublicKeyParams = lazyCompile<WebPushVapidPublicKeyParams>(
  WebPushVapidPublicKeyParamsSchema,
);
export const validateWebPushSubscribeParams = lazyCompile<WebPushSubscribeParams>(
  WebPushSubscribeParamsSchema,
);
export const validateWebPushUnsubscribeParams = lazyCompile<WebPushUnsubscribeParams>(
  WebPushUnsubscribeParamsSchema,
);
export const validateWebPushTestParams = lazyCompile<WebPushTestParams>(WebPushTestParamsSchema);
export const validateSecretsResolveParams = lazyCompile<SecretsResolveParams>(
  SecretsResolveParamsSchema,
);
export const validateSecretsResolveResult = lazyCompile<SecretsResolveResult>(
  SecretsResolveResultSchema,
);
export const validateSessionsListParams = lazyCompile<SessionsListParams>(SessionsListParamsSchema);
export const validateSessionsPreviewParams = lazyCompile<SessionsPreviewParams>(
  SessionsPreviewParamsSchema,
);
export const validateSessionsResolveParams = lazyCompile<SessionsResolveParams>(
  SessionsResolveParamsSchema,
);
export const validateSessionsCreateParams = lazyCompile<SessionsCreateParams>(
  SessionsCreateParamsSchema,
);
export const validateSessionsSendParams = lazyCompile<SessionsSendParams>(SessionsSendParamsSchema);
export const validateSessionsMessagesSubscribeParams = lazyCompile<SessionsMessagesSubscribeParams>(
  SessionsMessagesSubscribeParamsSchema,
);
export const validateSessionsMessagesUnsubscribeParams =
  lazyCompile<SessionsMessagesUnsubscribeParams>(SessionsMessagesUnsubscribeParamsSchema);
export const validateSessionsAbortParams =
  lazyCompile<SessionsAbortParams>(SessionsAbortParamsSchema);
export const validateSessionsPatchParams =
  lazyCompile<SessionsPatchParams>(SessionsPatchParamsSchema);
export const validateSessionsResetParams =
  lazyCompile<SessionsResetParams>(SessionsResetParamsSchema);
export const validateSessionsDeleteParams = lazyCompile<SessionsDeleteParams>(
  SessionsDeleteParamsSchema,
);
export const validateSessionsCompactParams = lazyCompile<SessionsCompactParams>(
  SessionsCompactParamsSchema,
);
export const validateSessionsCompactionListParams = lazyCompile<SessionsCompactionListParams>(
  SessionsCompactionListParamsSchema,
);
export const validateSessionsCompactionGetParams = lazyCompile<SessionsCompactionGetParams>(
  SessionsCompactionGetParamsSchema,
);
export const validateSessionsCompactionBranchParams = lazyCompile<SessionsCompactionBranchParams>(
  SessionsCompactionBranchParamsSchema,
);
export const validateSessionsCompactionRestoreParams = lazyCompile<SessionsCompactionRestoreParams>(
  SessionsCompactionRestoreParamsSchema,
);
export const validateSessionsUsageParams =
  lazyCompile<SessionsUsageParams>(SessionsUsageParamsSchema);
export const validateConfigGetParams = lazyCompile<ConfigGetParams>(ConfigGetParamsSchema);
export const validateConfigSetParams = lazyCompile<ConfigSetParams>(ConfigSetParamsSchema);
export const validateConfigApplyParams = lazyCompile<ConfigApplyParams>(ConfigApplyParamsSchema);
export const validateConfigPatchParams = lazyCompile<ConfigPatchParams>(ConfigPatchParamsSchema);
export const validateConfigSchemaParams = lazyCompile<ConfigSchemaParams>(ConfigSchemaParamsSchema);
export const validateConfigSchemaLookupParams = lazyCompile<ConfigSchemaLookupParams>(
  ConfigSchemaLookupParamsSchema,
);
export const validateConfigSchemaLookupResult = lazyCompile<ConfigSchemaLookupResult>(
  ConfigSchemaLookupResultSchema,
);
export const validateWizardStartParams = lazyCompile<WizardStartParams>(WizardStartParamsSchema);
export const validateWizardNextParams = lazyCompile<WizardNextParams>(WizardNextParamsSchema);
export const validateWizardCancelParams = lazyCompile<WizardCancelParams>(WizardCancelParamsSchema);
export const validateWizardStatusParams = lazyCompile<WizardStatusParams>(WizardStatusParamsSchema);
export const validateTalkModeParams = lazyCompile<TalkModeParams>(TalkModeParamsSchema);
export const validateTalkConfigParams = lazyCompile<TalkConfigParams>(TalkConfigParamsSchema);
export const validateTalkConfigResult = lazyCompile<TalkConfigResult>(TalkConfigResultSchema);
export const validateTalkRealtimeSessionParams = lazyCompile<TalkRealtimeSessionParams>(
  TalkRealtimeSessionParamsSchema,
);
export const validateTalkRealtimeSessionResult = lazyCompile<TalkRealtimeSessionResult>(
  TalkRealtimeSessionResultSchema,
);
export const validateTalkSpeakParams = lazyCompile<TalkSpeakParams>(TalkSpeakParamsSchema);
export const validateTalkSpeakResult = lazyCompile<TalkSpeakResult>(TalkSpeakResultSchema);
export const validateChannelsStatusParams = lazyCompile<ChannelsStatusParams>(
  ChannelsStatusParamsSchema,
);
export const validateChannelsStartParams =
  lazyCompile<ChannelsStartParams>(ChannelsStartParamsSchema);
export const validateChannelsLogoutParams = lazyCompile<ChannelsLogoutParams>(
  ChannelsLogoutParamsSchema,
);
export const validateModelsListParams = lazyCompile<ModelsListParams>(ModelsListParamsSchema);
export const validateSkillsStatusParams = lazyCompile<SkillsStatusParams>(SkillsStatusParamsSchema);
export const validateToolsCatalogParams = lazyCompile<ToolsCatalogParams>(ToolsCatalogParamsSchema);
export const validateToolsEffectiveParams = lazyCompile<ToolsEffectiveParams>(
  ToolsEffectiveParamsSchema,
);
export const validateSkillsBinsParams = lazyCompile<SkillsBinsParams>(SkillsBinsParamsSchema);
export const validateSkillsInstallParams =
  lazyCompile<SkillsInstallParams>(SkillsInstallParamsSchema);
export const validateSkillsUninstallParams = lazyCompile<SkillsUninstallParams>(
  SkillsUninstallParamsSchema,
);
export const validateSkillsUpdateParams = lazyCompile<SkillsUpdateParams>(SkillsUpdateParamsSchema);
export const validateSkillsSearchParams = lazyCompile<SkillsSearchParams>(SkillsSearchParamsSchema);
export const validateSkillsDetailParams = lazyCompile<SkillsDetailParams>(SkillsDetailParamsSchema);
export const validateCronListParams = lazyCompile<CronListParams>(CronListParamsSchema);
export const validateCronStatusParams = lazyCompile<CronStatusParams>(CronStatusParamsSchema);
export const validateCronAddParams = lazyCompile<CronAddParams>(CronAddParamsSchema);
export const validateCronUpdateParams = lazyCompile<CronUpdateParams>(CronUpdateParamsSchema);
export const validateCronRemoveParams = lazyCompile<CronRemoveParams>(CronRemoveParamsSchema);
export const validateCronRunParams = lazyCompile<CronRunParams>(CronRunParamsSchema);
export const validateCronRunsParams = lazyCompile<CronRunsParams>(CronRunsParamsSchema);
export const validateTasksListParams = lazyCompile<TasksListParams>(TasksListParamsSchema);
export const validateTasksShowParams = lazyCompile<TasksShowParams>(TasksShowParamsSchema);
export const validateTasksCancelParams = lazyCompile<TasksCancelParams>(TasksCancelParamsSchema);
export const validateTasksDeleteParams = lazyCompile<TasksDeleteParams>(TasksDeleteParamsSchema);
export const validateTasksNotifyParams = lazyCompile<TasksNotifyParams>(TasksNotifyParamsSchema);
export const validateTasksListResult = lazyCompile<TasksListResult>(TasksListResultSchema);
export const validateTasksShowResult = lazyCompile<TasksShowResult>(TasksShowResultSchema);
export const validateTasksCancelResult = lazyCompile<TasksCancelResult>(TasksCancelResultSchema);
export const validateTasksDeleteResult = lazyCompile<TasksDeleteResult>(TasksDeleteResultSchema);
export const validateTasksNotifyResult = lazyCompile<TasksNotifyResult>(TasksNotifyResultSchema);
export const validateDevicePairListParams = lazyCompile<DevicePairListParams>(
  DevicePairListParamsSchema,
);
export const validateDevicePairApproveParams = lazyCompile<DevicePairApproveParams>(
  DevicePairApproveParamsSchema,
);
export const validateDevicePairRejectParams = lazyCompile<DevicePairRejectParams>(
  DevicePairRejectParamsSchema,
);
export const validateDevicePairRemoveParams = lazyCompile<DevicePairRemoveParams>(
  DevicePairRemoveParamsSchema,
);
export const validateDeviceTokenRotateParams = lazyCompile<DeviceTokenRotateParams>(
  DeviceTokenRotateParamsSchema,
);
export const validateDeviceTokenRevokeParams = lazyCompile<DeviceTokenRevokeParams>(
  DeviceTokenRevokeParamsSchema,
);
export const validateExecApprovalsGetParams = lazyCompile<ExecApprovalsGetParams>(
  ExecApprovalsGetParamsSchema,
);
export const validateExecApprovalsSetParams = lazyCompile<ExecApprovalsSetParams>(
  ExecApprovalsSetParamsSchema,
);
export const validateExecApprovalGetParams = lazyCompile<ExecApprovalGetParams>(
  ExecApprovalGetParamsSchema,
);
export const validateExecApprovalRequestParams = lazyCompile<ExecApprovalRequestParams>(
  ExecApprovalRequestParamsSchema,
);
export const validateExecApprovalResolveParams = lazyCompile<ExecApprovalResolveParams>(
  ExecApprovalResolveParamsSchema,
);
export const validatePluginApprovalRequestParams = lazyCompile<PluginApprovalRequestParams>(
  PluginApprovalRequestParamsSchema,
);
export const validatePluginApprovalResolveParams = lazyCompile<PluginApprovalResolveParams>(
  PluginApprovalResolveParamsSchema,
);
export const validatePluginsStatusParams =
  lazyCompile<PluginsStatusParams>(PluginsStatusParamsSchema);
export const validatePluginsSetEnabledParams = lazyCompile<PluginsSetEnabledParams>(
  PluginsSetEnabledParamsSchema,
);
export const validatePluginsUninstallParams = lazyCompile<PluginsUninstallParams>(
  PluginsUninstallParamsSchema,
);
export const validatePluginsInstallParams = lazyCompile<PluginsInstallParams>(
  PluginsInstallParamsSchema,
);
export const validateExecApprovalsNodeGetParams = lazyCompile<ExecApprovalsNodeGetParams>(
  ExecApprovalsNodeGetParamsSchema,
);
export const validateExecApprovalsNodeSetParams = lazyCompile<ExecApprovalsNodeSetParams>(
  ExecApprovalsNodeSetParamsSchema,
);
export const validateLogsTailParams = lazyCompile<LogsTailParams>(LogsTailParamsSchema);
export const validateChatHistoryParams = lazyCompile(ChatHistoryParamsSchema);
export const validateChatSendParams = lazyCompile(ChatSendParamsSchema);
export const validateChatAbortParams = lazyCompile<ChatAbortParams>(ChatAbortParamsSchema);
export const validateChatInjectParams = lazyCompile<ChatInjectParams>(ChatInjectParamsSchema);
export const validateChatEvent = lazyCompile(ChatEventSchema);
export const validateUpdateStatusParams = lazyCompile<UpdateStatusParams>(UpdateStatusParamsSchema);
export const validateUpdateRunParams = lazyCompile<UpdateRunParams>(UpdateRunParamsSchema);
export const validateWebLoginStartParams =
  lazyCompile<WebLoginStartParams>(WebLoginStartParamsSchema);
export const validateWebLoginWaitParams = lazyCompile<WebLoginWaitParams>(WebLoginWaitParamsSchema);

export function formatValidationErrors(errors: ErrorObject[] | null | undefined) {
  if (!errors?.length) {
    return "unknown validation error";
  }

  const parts: string[] = [];

  for (const err of errors) {
    const keyword = typeof err?.keyword === "string" ? err.keyword : "";
    const instancePath = typeof err?.instancePath === "string" ? err.instancePath : "";

    if (keyword === "additionalProperties") {
      const params = err?.params as { additionalProperty?: unknown } | undefined;
      const additionalProperty = params?.additionalProperty;
      if (typeof additionalProperty === "string" && additionalProperty.trim()) {
        const where = instancePath ? `at ${instancePath}` : "at root";
        parts.push(`${where}: unexpected property '${additionalProperty}'`);
        continue;
      }
    }

    const message =
      typeof err?.message === "string" && err.message.trim() ? err.message : "validation error";
    const where = instancePath ? `at ${instancePath}: ` : "";
    parts.push(`${where}${message}`);
  }

  // De-dupe while preserving order.
  const unique = Array.from(new Set(parts.filter((part) => part.trim())));
  if (!unique.length) {
    const fallback = ajv.errorsText(errors, { separator: "; " });
    return fallback || "unknown validation error";
  }
  return unique.join("; ");
}

export {
  ConnectParamsSchema,
  HelloOkSchema,
  RequestFrameSchema,
  ResponseFrameSchema,
  EventFrameSchema,
  GatewayFrameSchema,
  PresenceEntrySchema,
  SnapshotSchema,
  ErrorShapeSchema,
  StateVersionSchema,
  AgentEventSchema,
  MessageActionParamsSchema,
  ChatEventSchema,
  SendParamsSchema,
  PollParamsSchema,
  AgentParamsSchema,
  AgentIdentityParamsSchema,
  AgentIdentityResultSchema,
  WakeParamsSchema,
  PushTestParamsSchema,
  PushTestResultSchema,
  WebPushVapidPublicKeyParamsSchema,
  WebPushSubscribeParamsSchema,
  WebPushUnsubscribeParamsSchema,
  WebPushTestParamsSchema,
  NodePairRequestParamsSchema,
  NodePairListParamsSchema,
  NodePairApproveParamsSchema,
  NodePairRejectParamsSchema,
  NodePairRemoveParamsSchema,
  NodePairVerifyParamsSchema,
  NodeListParamsSchema,
  NodePendingAckParamsSchema,
  NodeInvokeParamsSchema,
  NodePendingDrainParamsSchema,
  NodePendingDrainResultSchema,
  NodePendingEnqueueParamsSchema,
  NodePendingEnqueueResultSchema,
  SessionsListParamsSchema,
  SessionsPreviewParamsSchema,
  SessionsResolveParamsSchema,
  SessionsCompactionListParamsSchema,
  SessionsCompactionGetParamsSchema,
  SessionsCompactionBranchParamsSchema,
  SessionsCompactionRestoreParamsSchema,
  SessionsCreateParamsSchema,
  SessionsSendParamsSchema,
  SessionsAbortParamsSchema,
  SessionsPatchParamsSchema,
  SessionsResetParamsSchema,
  SessionsDeleteParamsSchema,
  SessionsCompactParamsSchema,
  SessionsUsageParamsSchema,
  ConfigGetParamsSchema,
  ConfigSetParamsSchema,
  ConfigApplyParamsSchema,
  ConfigPatchParamsSchema,
  ConfigSchemaParamsSchema,
  ConfigSchemaLookupParamsSchema,
  ConfigSchemaResponseSchema,
  ConfigSchemaLookupResultSchema,
  UpdateStatusParamsSchema,
  WizardStartParamsSchema,
  WizardNextParamsSchema,
  WizardCancelParamsSchema,
  WizardStatusParamsSchema,
  WizardStepSchema,
  WizardNextResultSchema,
  WizardStartResultSchema,
  WizardStatusResultSchema,
  TalkConfigParamsSchema,
  TalkConfigResultSchema,
  TalkRealtimeSessionParamsSchema,
  TalkRealtimeSessionResultSchema,
  TalkSpeakParamsSchema,
  TalkSpeakResultSchema,
  ChannelsStatusParamsSchema,
  ChannelsStatusResultSchema,
  ChannelsStartParamsSchema,
  ChannelsLogoutParamsSchema,
  WebLoginStartParamsSchema,
  WebLoginWaitParamsSchema,
  AgentSummarySchema,
  AgentsFileEntrySchema,
  AgentsCreateParamsSchema,
  AgentsCreateResultSchema,
  AgentsUpdateParamsSchema,
  AgentsUpdateResultSchema,
  AgentsDeleteParamsSchema,
  AgentsDeleteResultSchema,
  AgentsFilesListParamsSchema,
  AgentsFilesListResultSchema,
  AgentsFilesGetParamsSchema,
  AgentsFilesGetResultSchema,
  AgentsFilesSetParamsSchema,
  AgentsFilesSetResultSchema,
  AgentsListParamsSchema,
  AgentsListResultSchema,
  CommandsListParamsSchema,
  CommandsListResultSchema,
  ModelsListParamsSchema,
  SkillsStatusParamsSchema,
  ToolsCatalogParamsSchema,
  ToolsEffectiveParamsSchema,
  SkillsInstallParamsSchema,
  SkillsUninstallParamsSchema,
  SkillsSearchParamsSchema,
  SkillsSearchResultSchema,
  SkillsDetailParamsSchema,
  SkillsDetailResultSchema,
  SkillsUpdateParamsSchema,
  CronJobSchema,
  CronListParamsSchema,
  CronStatusParamsSchema,
  CronAddParamsSchema,
  CronUpdateParamsSchema,
  CronRemoveParamsSchema,
  CronRunParamsSchema,
  CronRunsParamsSchema,
  TasksListParamsSchema,
  TasksListResultSchema,
  TasksShowParamsSchema,
  TasksShowResultSchema,
  TasksCancelParamsSchema,
  TasksCancelResultSchema,
  TasksDeleteParamsSchema,
  TasksDeleteResultSchema,
  TasksNotifyParamsSchema,
  TasksNotifyResultSchema,
  LogsTailParamsSchema,
  LogsTailResultSchema,
  ExecApprovalsGetParamsSchema,
  ExecApprovalsSetParamsSchema,
  ExecApprovalGetParamsSchema,
  ExecApprovalRequestParamsSchema,
  ExecApprovalResolveParamsSchema,
  ChatHistoryParamsSchema,
  ChatSendParamsSchema,
  ChatInjectParamsSchema,
  UpdateRunParamsSchema,
  TickEventSchema,
  ShutdownEventSchema,
  ProtocolSchemas,
  PROTOCOL_VERSION,
  ErrorCodes,
  errorShape,
};

export type {
  GatewayFrame,
  ConnectParams,
  HelloOk,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  PresenceEntry,
  Snapshot,
  ErrorShape,
  StateVersion,
  AgentEvent,
  AgentIdentityParams,
  AgentIdentityResult,
  AgentWaitParams,
  ChatEvent,
  TickEvent,
  ShutdownEvent,
  WakeParams,
  NodePairRequestParams,
  NodePairListParams,
  NodePairApproveParams,
  DevicePairListParams,
  DevicePairApproveParams,
  DevicePairRejectParams,
  ConfigGetParams,
  ConfigSetParams,
  ConfigApplyParams,
  ConfigPatchParams,
  ConfigSchemaParams,
  ConfigSchemaResponse,
  WizardStartParams,
  WizardNextParams,
  WizardCancelParams,
  WizardStatusParams,
  WizardStep,
  WizardNextResult,
  WizardStartResult,
  WizardStatusResult,
  TalkConfigParams,
  TalkConfigResult,
  TalkRealtimeSessionParams,
  TalkRealtimeSessionResult,
  TalkSpeakParams,
  TalkSpeakResult,
  TalkModeParams,
  ChannelsStatusParams,
  ChannelsStatusResult,
  ChannelsStartParams,
  ChannelsLogoutParams,
  WebLoginStartParams,
  WebLoginWaitParams,
  AgentSummary,
  AgentsFileEntry,
  AgentsCreateParams,
  AgentsCreateResult,
  AgentsUpdateParams,
  AgentsUpdateResult,
  AgentsDeleteParams,
  AgentsDeleteResult,
  AgentsFilesListParams,
  AgentsFilesListResult,
  AgentsFilesGetParams,
  AgentsFilesGetResult,
  AgentsFilesSetParams,
  AgentsFilesSetResult,
  AgentsListParams,
  AgentsListResult,
  CommandsListParams,
  CommandsListResult,
  CommandEntry,
  SkillsStatusParams,
  ToolsCatalogParams,
  ToolsCatalogResult,
  ToolsEffectiveParams,
  ToolsEffectiveResult,
  SkillsBinsParams,
  SkillsBinsResult,
  SkillsSearchParams,
  SkillsSearchResult,
  SkillsDetailParams,
  SkillsDetailResult,
  SkillsInstallParams,
  SkillsUninstallParams,
  SkillsUpdateParams,
  NodePairRejectParams,
  NodePairRemoveParams,
  NodePairVerifyParams,
  NodeListParams,
  NodeInvokeParams,
  NodeInvokeResultParams,
  NodeEventParams,
  NodePendingDrainParams,
  NodePendingDrainResult,
  NodePendingEnqueueParams,
  NodePendingEnqueueResult,
  SessionsListParams,
  SessionsPreviewParams,
  SessionsResolveParams,
  SessionsPatchParams,
  SessionsPatchResult,
  SessionsResetParams,
  SessionsDeleteParams,
  SessionsCompactParams,
  SessionsUsageParams,
  CronJob,
  CronListParams,
  CronStatusParams,
  CronAddParams,
  CronUpdateParams,
  CronRemoveParams,
  CronRunParams,
  CronRunsParams,
  CronRunLogEntry,
  TasksListParams,
  TasksListResult,
  TasksShowParams,
  TasksShowResult,
  TasksCancelParams,
  TasksCancelResult,
  TasksDeleteParams,
  TasksDeleteResult,
  TasksNotifyParams,
  TasksNotifyResult,
  ExecApprovalsGetParams,
  ExecApprovalsSetParams,
  ExecApprovalsSnapshot,
  ExecApprovalGetParams,
  ExecApprovalRequestParams,
  ExecApprovalResolveParams,
  LogsTailParams,
  LogsTailResult,
  PluginsInstallParams,
  PluginsInstallResult,
  PluginsMutationResult,
  PluginsSetEnabledParams,
  PluginStatusDiagnostic,
  PluginStatusSummary,
  PluginsStatusParams,
  PluginsStatusResult,
  PluginsUninstallParams,
  PollParams,
  WebPushVapidPublicKeyParams,
  WebPushSubscribeParams,
  WebPushUnsubscribeParams,
  WebPushTestParams,
  UpdateStatusParams,
  UpdateRunParams,
  ChatInjectParams,
};
