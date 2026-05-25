import { type ErrorObject, type ValidateFunction } from "ajv";
import type { SessionsPatchResult } from "../session-utils.types.js";
import { type AgentEvent, AgentEventSchema, type AgentIdentityParams, AgentIdentityParamsSchema, type AgentIdentityResult, AgentIdentityResultSchema, AgentParamsSchema, MessageActionParamsSchema, type AgentSummary, AgentSummarySchema, type AgentsFileEntry, AgentsFileEntrySchema, type AgentsCreateParams, AgentsCreateParamsSchema, type AgentsCreateResult, AgentsCreateResultSchema, type AgentsUpdateParams, AgentsUpdateParamsSchema, type AgentsUpdateResult, AgentsUpdateResultSchema, type AgentsDeleteParams, AgentsDeleteParamsSchema, type AgentsDeleteResult, AgentsDeleteResultSchema, type AgentsFilesGetParams, AgentsFilesGetParamsSchema, type AgentsFilesGetResult, AgentsFilesGetResultSchema, type AgentsFilesListParams, AgentsFilesListParamsSchema, type AgentsFilesListResult, AgentsFilesListResultSchema, type AgentsFilesSetParams, AgentsFilesSetParamsSchema, type AgentsFilesSetResult, AgentsFilesSetResultSchema, type AgentsListParams, AgentsListParamsSchema, type AgentsListResult, AgentsListResultSchema, type AgentWaitParams, type ChannelsStartParams, ChannelsStartParamsSchema, type ChannelsLogoutParams, ChannelsLogoutParamsSchema, type TalkConfigParams, TalkConfigParamsSchema, type TalkConfigResult, TalkConfigResultSchema, type TalkRealtimeSessionParams, TalkRealtimeSessionParamsSchema, type TalkRealtimeSessionResult, TalkRealtimeSessionResultSchema, type TalkSpeakParams, TalkSpeakParamsSchema, type TalkSpeakResult, TalkSpeakResultSchema, type ChannelsStatusParams, ChannelsStatusParamsSchema, type ChannelsStatusResult, ChannelsStatusResultSchema, type CommandEntry, type CommandsListParams, CommandsListParamsSchema, type CommandsListResult, CommandsListResultSchema, type ChatEvent, ChatEventSchema, ChatHistoryParamsSchema, type ChatInjectParams, ChatInjectParamsSchema, ChatSendParamsSchema, type ConfigApplyParams, ConfigApplyParamsSchema, type ConfigGetParams, ConfigGetParamsSchema, type ConfigPatchParams, ConfigPatchParamsSchema, ConfigSchemaLookupParamsSchema, ConfigSchemaLookupResultSchema, type ConfigSchemaParams, ConfigSchemaParamsSchema, type ConfigSchemaResponse, ConfigSchemaResponseSchema, type ConfigSetParams, ConfigSetParamsSchema, type UpdateStatusParams, UpdateStatusParamsSchema, type ConnectParams, ConnectParamsSchema, type CronAddParams, CronAddParamsSchema, type CronJob, CronJobSchema, type CronListParams, CronListParamsSchema, type CronRemoveParams, CronRemoveParamsSchema, type CronRunLogEntry, type CronRunParams, CronRunParamsSchema, type CronRunsParams, CronRunsParamsSchema, type CronStatusParams, CronStatusParamsSchema, type CronUpdateParams, CronUpdateParamsSchema, type TasksAuditParams, TasksAuditParamsSchema, type TasksAuditResult, TasksAuditResultSchema, type TasksCancelParams, TasksCancelParamsSchema, type TasksCancelResult, TasksCancelResultSchema, type TasksDeleteParams, TasksDeleteParamsSchema, type TasksDeleteResult, TasksDeleteResultSchema, type TasksListParams, TasksListParamsSchema, type TasksListResult, TasksListResultSchema, type TasksMaintenanceParams, TasksMaintenanceParamsSchema, type TasksMaintenanceResult, TasksMaintenanceResultSchema, type TasksNotifyParams, TasksNotifyParamsSchema, type TasksNotifyResult, TasksNotifyResultSchema, type TasksShowParams, TasksShowParamsSchema, type TasksShowResult, TasksShowResultSchema, type DevicePairApproveParams, type DevicePairListParams, type DevicePairRejectParams, type ExecApprovalsGetParams, ExecApprovalsGetParamsSchema, type ExecApprovalsSetParams, ExecApprovalsSetParamsSchema, type ExecApprovalsSnapshot, type ExecApprovalGetParams, ExecApprovalGetParamsSchema, type ExecApprovalRequestParams, ExecApprovalRequestParamsSchema, type ExecApprovalResolveParams, ExecApprovalResolveParamsSchema, type PluginsInstallParams, type PluginsInstallResult, type PluginsMutationResult, type PluginsSetEnabledParams, type PluginStatusDiagnostic, type PluginStatusSummary, type PluginsStatusParams, type PluginsStatusResult, type PluginsUninstallParams, ErrorCodes, type ErrorShape, ErrorShapeSchema, type EventFrame, EventFrameSchema, errorShape, type GatewayFrame, GatewayFrameSchema, type HelloOk, HelloOkSchema, type LogsTailParams, LogsTailParamsSchema, type LogsTailResult, LogsTailResultSchema, ModelsListParamsSchema, type NodeEventParams, type NodePendingDrainParams, NodePendingDrainParamsSchema, type NodePendingDrainResult, NodePendingDrainResultSchema, type NodePendingEnqueueParams, NodePendingEnqueueParamsSchema, type NodePendingEnqueueResult, NodePendingEnqueueResultSchema, type NodeInvokeParams, NodeInvokeParamsSchema, type NodeInvokeResultParams, type NodeListParams, NodeListParamsSchema, NodePendingAckParamsSchema, type NodePairApproveParams, NodePairApproveParamsSchema, type NodePairListParams, NodePairListParamsSchema, type NodePairRejectParams, NodePairRejectParamsSchema, type NodePairRemoveParams, NodePairRemoveParamsSchema, type NodePairRequestParams, NodePairRequestParamsSchema, type NodePairVerifyParams, NodePairVerifyParamsSchema, type PollParams, PollParamsSchema, PROTOCOL_VERSION, PushTestParamsSchema, PushTestResultSchema, type WebPushVapidPublicKeyParams, WebPushVapidPublicKeyParamsSchema, type WebPushSubscribeParams, WebPushSubscribeParamsSchema, type WebPushUnsubscribeParams, WebPushUnsubscribeParamsSchema, type WebPushTestParams, WebPushTestParamsSchema, type PresenceEntry, PresenceEntrySchema, ProtocolSchemas, type RequestFrame, RequestFrameSchema, type ResponseFrame, ResponseFrameSchema, SendParamsSchema, SessionsAbortParamsSchema, type SessionsCompactParams, SessionsCompactParamsSchema, SessionsCompactionBranchParamsSchema, SessionsCompactionGetParamsSchema, SessionsCompactionListParamsSchema, SessionsCompactionRestoreParamsSchema, SessionsCreateParamsSchema, type SessionsDeleteParams, SessionsDeleteParamsSchema, type SessionsListParams, SessionsListParamsSchema, type SessionsPatchParams, SessionsPatchParamsSchema, type SessionsPreviewParams, SessionsPreviewParamsSchema, type SessionsResetParams, SessionsResetParamsSchema, type SessionsResolveParams, SessionsResolveParamsSchema, SessionsSendParamsSchema, type SessionsUsageParams, SessionsUsageParamsSchema, type ShutdownEvent, ShutdownEventSchema, type SkillsBinsParams, type SkillsBinsResult, type SkillsDetailParams, SkillsDetailParamsSchema, type SkillsDetailResult, SkillsDetailResultSchema, type SkillsInstallParams, SkillsInstallParamsSchema, type SkillsUninstallParams, SkillsUninstallParamsSchema, type SkillsSearchParams, SkillsSearchParamsSchema, type SkillsSearchResult, SkillsSearchResultSchema, type SkillsStatusParams, SkillsStatusParamsSchema, type SkillsUpdateParams, SkillsUpdateParamsSchema, type ToolsCatalogParams, ToolsCatalogParamsSchema, type ToolsCatalogResult, type ToolsEffectiveParams, ToolsEffectiveParamsSchema, type ToolsEffectiveResult, type Snapshot, SnapshotSchema, type StateVersion, StateVersionSchema, type TalkModeParams, type TickEvent, TickEventSchema, type UpdateRunParams, UpdateRunParamsSchema, type WakeParams, WakeParamsSchema, type WebLoginStartParams, WebLoginStartParamsSchema, type WebLoginWaitParams, WebLoginWaitParamsSchema, type WizardCancelParams, WizardCancelParamsSchema, type WizardNextParams, WizardNextParamsSchema, type WizardNextResult, WizardNextResultSchema, type WizardStartParams, WizardStartParamsSchema, type WizardStartResult, WizardStartResultSchema, type WizardStatusParams, WizardStatusParamsSchema, type WizardStatusResult, WizardStatusResultSchema, type WizardStep, WizardStepSchema } from "./schema.js";
export declare const validateCommandsListParams: ValidateFunction<{
    agentId?: string | undefined;
    provider?: string | undefined;
    scope?: "both" | "native" | "text" | undefined;
    includeArgs?: boolean | undefined;
}>;
export declare const validateConnectParams: ValidateFunction<{
    minProtocol: number;
    maxProtocol: number;
    client: {
        id: string;
        displayName?: string | undefined;
        version: string;
        platform: string;
        deviceFamily?: string | undefined;
        modelIdentifier?: string | undefined;
        mode: "backend" | "cli" | "node" | "probe" | "test" | "ui" | "webchat";
        instanceId?: string | undefined;
    };
    caps?: string[] | undefined;
    commands?: string[] | undefined;
    permissions?: Record<string, boolean> | undefined;
    pathEnv?: string | undefined;
    role?: string | undefined;
    scopes?: string[] | undefined;
    device?: {
        id: string;
        publicKey: string;
        signature: string;
        signedAt: number;
        nonce: string;
    } | undefined;
    auth?: {
        token?: string | undefined;
        bootstrapToken?: string | undefined;
        deviceToken?: string | undefined;
        password?: string | undefined;
    } | undefined;
    locale?: string | undefined;
    userAgent?: string | undefined;
}>;
export declare const validateRequestFrame: ValidateFunction<{
    type: "req";
    id: string;
    method: string;
    params?: unknown;
}>;
export declare const validateResponseFrame: ValidateFunction<{
    type: "res";
    id: string;
    ok: boolean;
    payload?: unknown;
    error?: {
        code: string;
        message: string;
        details?: unknown;
        retryable?: boolean | undefined;
        retryAfterMs?: number | undefined;
    } | undefined;
}>;
export declare const validateEventFrame: ValidateFunction<{
    type: "event";
    event: string;
    payload?: unknown;
    seq?: number | undefined;
    stateVersion?: {
        presence: number;
        health: number;
    } | undefined;
}>;
export declare const validateMessageActionParams: ValidateFunction<{
    channel: string;
    action: string;
    params: Record<string, unknown>;
    accountId?: string | undefined;
    requesterSenderId?: string | undefined;
    senderIsOwner?: boolean | undefined;
    sessionKey?: string | undefined;
    sessionId?: string | undefined;
    agentId?: string | undefined;
    toolContext?: {
        currentChannelId?: string | undefined;
        currentGraphChannelId?: string | undefined;
        currentChannelProvider?: string | undefined;
        currentThreadTs?: string | undefined;
        currentMessageId?: string | number | undefined;
        replyToMode?: "all" | "batched" | "first" | "off" | undefined;
        hasRepliedRef?: {
            value: boolean;
        } | undefined;
        skipCrossContextDecoration?: boolean | undefined;
    } | undefined;
    idempotencyKey: string;
}>;
export declare const validateSendParams: ValidateFunction<unknown>;
export declare const validatePollParams: ValidateFunction<{
    to: string;
    question: string;
    options: string[];
    maxSelections?: number | undefined;
    durationSeconds?: number | undefined;
    durationHours?: number | undefined;
    silent?: boolean | undefined;
    isAnonymous?: boolean | undefined;
    threadId?: string | undefined;
    channel?: string | undefined;
    accountId?: string | undefined;
    idempotencyKey: string;
}>;
export declare const validateAgentParams: ValidateFunction<unknown>;
export declare const validateAgentIdentityParams: ValidateFunction<{
    agentId?: string | undefined;
    sessionKey?: string | undefined;
}>;
export declare const validateAgentWaitParams: ValidateFunction<{
    runId: string;
    timeoutMs?: number | undefined;
}>;
export declare const validateWakeParams: ValidateFunction<{
    mode: "next-heartbeat" | "now";
    text: string;
}>;
export declare const validateAgentsListParams: ValidateFunction<object>;
export declare const validateAgentsCreateParams: ValidateFunction<{
    name: string;
    workspace: string;
    model?: string | undefined;
    emoji?: string | undefined;
    avatar?: string | undefined;
}>;
export declare const validateAgentsUpdateParams: ValidateFunction<{
    agentId: string;
    name?: string | undefined;
    workspace?: string | undefined;
    model?: string | undefined;
    emoji?: string | undefined;
    avatar?: string | undefined;
}>;
export declare const validateAgentsDeleteParams: ValidateFunction<{
    agentId: string;
    deleteFiles?: boolean | undefined;
}>;
export declare const validateAgentsFilesListParams: ValidateFunction<{
    agentId: string;
}>;
export declare const validateAgentsFilesGetParams: ValidateFunction<{
    agentId: string;
    name: string;
}>;
export declare const validateAgentsFilesSetParams: ValidateFunction<{
    agentId: string;
    name: string;
    content: string;
}>;
export declare const validateNodePairRequestParams: ValidateFunction<{
    nodeId: string;
    displayName?: string | undefined;
    platform?: string | undefined;
    version?: string | undefined;
    coreVersion?: string | undefined;
    uiVersion?: string | undefined;
    deviceFamily?: string | undefined;
    modelIdentifier?: string | undefined;
    caps?: string[] | undefined;
    commands?: string[] | undefined;
    permissions?: Record<string, boolean> | undefined;
    remoteIp?: string | undefined;
    silent?: boolean | undefined;
}>;
export declare const validateNodePairListParams: ValidateFunction<object>;
export declare const validateNodePairApproveParams: ValidateFunction<{
    requestId: string;
}>;
export declare const validateNodePairRejectParams: ValidateFunction<{
    requestId: string;
}>;
export declare const validateNodePairRemoveParams: ValidateFunction<{
    nodeId: string;
}>;
export declare const validateNodePairVerifyParams: ValidateFunction<{
    nodeId: string;
    token: string;
}>;
export declare const validateNodeRenameParams: ValidateFunction<{
    nodeId: string;
    displayName: string;
}>;
export declare const validateNodeListParams: ValidateFunction<object>;
export declare const validateNodePendingAckParams: ValidateFunction<{
    ids: string[];
}>;
export declare const validateNodeDescribeParams: ValidateFunction<{
    nodeId: string;
}>;
export declare const validateNodeInvokeParams: ValidateFunction<{
    nodeId: string;
    command: string;
    params?: unknown;
    timeoutMs?: number | undefined;
    idempotencyKey: string;
}>;
export declare const validateNodeInvokeResultParams: ValidateFunction<{
    id: string;
    nodeId: string;
    ok: boolean;
    payload?: unknown;
    payloadJSON?: string | undefined;
    error?: {
        code?: string | undefined;
        message?: string | undefined;
    } | undefined;
}>;
export declare const validateNodeEventParams: ValidateFunction<{
    event: string;
    payload?: unknown;
    payloadJSON?: string | undefined;
}>;
export declare const validateNodePendingDrainParams: ValidateFunction<{
    maxItems?: number | undefined;
}>;
export declare const validateNodePendingEnqueueParams: ValidateFunction<{
    nodeId: string;
    type: string;
    priority?: string | undefined;
    expiresInMs?: number | undefined;
    wake?: boolean | undefined;
}>;
export declare const validatePushTestParams: ValidateFunction<{
    nodeId: string;
    title?: string | undefined;
    body?: string | undefined;
    environment?: string | undefined;
}>;
export declare const validateWebPushVapidPublicKeyParams: ValidateFunction<WebPushVapidPublicKeyParams>;
export declare const validateWebPushSubscribeParams: ValidateFunction<WebPushSubscribeParams>;
export declare const validateWebPushUnsubscribeParams: ValidateFunction<WebPushUnsubscribeParams>;
export declare const validateWebPushTestParams: ValidateFunction<WebPushTestParams>;
export declare const validateSecretsResolveParams: ValidateFunction<{
    commandName: string;
    targetIds: string[];
}>;
export declare const validateSecretsResolveResult: ValidateFunction<{
    ok?: boolean | undefined;
    assignments?: {
        path?: string | undefined;
        pathSegments: string[];
        value: unknown;
    }[] | undefined;
    diagnostics?: string[] | undefined;
    inactiveRefPaths?: string[] | undefined;
}>;
export declare const validateSessionsListParams: ValidateFunction<{
    limit?: number | undefined;
    activeMinutes?: number | undefined;
    includeGlobal?: boolean | undefined;
    includeUnknown?: boolean | undefined;
    includeDerivedTitles?: boolean | undefined;
    includeLastMessage?: boolean | undefined;
    label?: string | undefined;
    spawnedBy?: string | undefined;
    agentId?: string | undefined;
    search?: string | undefined;
}>;
export declare const validateSessionsPreviewParams: ValidateFunction<{
    keys: string[];
    limit?: number | undefined;
    maxChars?: number | undefined;
}>;
export declare const validateSessionsResolveParams: ValidateFunction<{
    key?: string | undefined;
    sessionId?: string | undefined;
    label?: string | undefined;
    agentId?: string | undefined;
    spawnedBy?: string | undefined;
    includeGlobal?: boolean | undefined;
    includeUnknown?: boolean | undefined;
}>;
export declare const validateSessionsCreateParams: ValidateFunction<{
    key?: string | undefined;
    agentId?: string | undefined;
    label?: string | undefined;
    model?: string | undefined;
    parentSessionKey?: string | undefined;
    emitCommandHooks?: boolean | undefined;
    task?: string | undefined;
    message?: string | undefined;
}>;
export declare const validateSessionsSendParams: ValidateFunction<{
    key: string;
    message: string;
    thinking?: string | undefined;
    attachments?: unknown[] | undefined;
    timeoutMs?: number | undefined;
    idempotencyKey?: string | undefined;
}>;
export declare const validateSessionsMessagesSubscribeParams: ValidateFunction<{
    key: string;
}>;
export declare const validateSessionsMessagesUnsubscribeParams: ValidateFunction<{
    key: string;
}>;
export declare const validateSessionsAbortParams: ValidateFunction<{
    key: string;
    runId?: string | undefined;
}>;
export declare const validateSessionsPatchParams: ValidateFunction<{
    key: string;
    label?: string | null | undefined;
    thinkingLevel?: string | null | undefined;
    fastMode?: boolean | null | undefined;
    verboseLevel?: string | null | undefined;
    traceLevel?: string | null | undefined;
    reasoningLevel?: string | null | undefined;
    responseUsage?: "full" | "off" | "on" | "tokens" | null | undefined;
    elevatedLevel?: string | null | undefined;
    execHost?: string | null | undefined;
    execSecurity?: string | null | undefined;
    execAsk?: string | null | undefined;
    execNode?: string | null | undefined;
    model?: string | null | undefined;
    spawnedBy?: string | null | undefined;
    spawnedWorkspaceDir?: string | null | undefined;
    spawnDepth?: number | null | undefined;
    subagentRole?: "leaf" | "orchestrator" | null | undefined;
    subagentControlScope?: "children" | "none" | null | undefined;
    sendPolicy?: "allow" | "deny" | null | undefined;
    groupActivation?: "always" | "mention" | null | undefined;
}>;
export declare const validateSessionsResetParams: ValidateFunction<{
    key: string;
    reason?: "new" | "reset" | undefined;
}>;
export declare const validateSessionsDeleteParams: ValidateFunction<{
    key: string;
    deleteTranscript?: boolean | undefined;
    emitLifecycleHooks?: boolean | undefined;
}>;
export declare const validateSessionsCompactParams: ValidateFunction<{
    key: string;
    maxLines?: number | undefined;
}>;
export declare const validateSessionsCompactionListParams: ValidateFunction<{
    key: string;
}>;
export declare const validateSessionsCompactionGetParams: ValidateFunction<{
    key: string;
    checkpointId: string;
}>;
export declare const validateSessionsCompactionBranchParams: ValidateFunction<{
    key: string;
    checkpointId: string;
}>;
export declare const validateSessionsCompactionRestoreParams: ValidateFunction<{
    key: string;
    checkpointId: string;
}>;
export declare const validateSessionsUsageParams: ValidateFunction<{
    key?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    mode?: "gateway" | "specific" | "utc" | undefined;
    utcOffset?: string | undefined;
    limit?: number | undefined;
    includeContextWeight?: boolean | undefined;
}>;
export declare const validateConfigGetParams: ValidateFunction<object>;
export declare const validateConfigSetParams: ValidateFunction<{
    raw: string;
    baseHash?: string | undefined;
}>;
export declare const validateConfigApplyParams: ValidateFunction<{
    raw: string;
    baseHash?: string | undefined;
    sessionKey?: string | undefined;
    deliveryContext?: {
        channel?: string | undefined;
        to?: string | undefined;
        accountId?: string | undefined;
        threadId?: string | number | undefined;
    } | undefined;
    note?: string | undefined;
    restartDelayMs?: number | undefined;
}>;
export declare const validateConfigPatchParams: ValidateFunction<{
    raw: string;
    baseHash?: string | undefined;
    sessionKey?: string | undefined;
    deliveryContext?: {
        channel?: string | undefined;
        to?: string | undefined;
        accountId?: string | undefined;
        threadId?: string | number | undefined;
    } | undefined;
    note?: string | undefined;
    restartDelayMs?: number | undefined;
}>;
export declare const validateConfigSchemaParams: ValidateFunction<object>;
export declare const validateConfigSchemaLookupParams: ValidateFunction<{
    path: string;
}>;
export declare const validateConfigSchemaLookupResult: ValidateFunction<{
    path: string;
    schema: unknown;
    hint?: {
        label?: string | undefined;
        help?: string | undefined;
        tags?: string[] | undefined;
        group?: string | undefined;
        order?: number | undefined;
        advanced?: boolean | undefined;
        sensitive?: boolean | undefined;
        placeholder?: string | undefined;
        itemTemplate?: unknown;
    } | undefined;
    hintPath?: string | undefined;
    children: {
        key: string;
        path: string;
        type?: string | string[] | undefined;
        required: boolean;
        hasChildren: boolean;
        hint?: {
            label?: string | undefined;
            help?: string | undefined;
            tags?: string[] | undefined;
            group?: string | undefined;
            order?: number | undefined;
            advanced?: boolean | undefined;
            sensitive?: boolean | undefined;
            placeholder?: string | undefined;
            itemTemplate?: unknown;
        } | undefined;
        hintPath?: string | undefined;
    }[];
}>;
export declare const validateWizardStartParams: ValidateFunction<{
    flow?: "configure" | "onboard" | undefined;
    mode?: "local" | "remote" | undefined;
    section?: "channels" | "daemon" | "gateway" | "health" | "model" | "plugins" | "skills" | "web" | "workspace" | undefined;
    workspace?: string | undefined;
}>;
export declare const validateWizardNextParams: ValidateFunction<{
    sessionId: string;
    answer?: {
        stepId: string;
        value?: unknown;
    } | undefined;
}>;
export declare const validateWizardCancelParams: ValidateFunction<{
    sessionId: string;
}>;
export declare const validateWizardStatusParams: ValidateFunction<{
    sessionId: string;
}>;
export declare const validateTalkModeParams: ValidateFunction<{
    enabled: boolean;
    phase?: string | undefined;
}>;
export declare const validateTalkConfigParams: ValidateFunction<{
    includeSecrets?: boolean | undefined;
}>;
export declare const validateTalkConfigResult: ValidateFunction<{
    config: {
        talk?: {
            provider?: string | undefined;
            providers?: Record<string, {
                apiKey?: string | {
                    source: "env";
                    provider: string;
                    id: string;
                } | {
                    source: "file";
                    provider: string;
                    id: string;
                } | {
                    source: "exec";
                    provider: string;
                    id: string;
                } | undefined;
            }> | undefined;
            resolved: {
                provider: string;
                config: {
                    apiKey?: string | {
                        source: "env";
                        provider: string;
                        id: string;
                    } | {
                        source: "file";
                        provider: string;
                        id: string;
                    } | {
                        source: "exec";
                        provider: string;
                        id: string;
                    } | undefined;
                };
            };
            speechLocale?: string | undefined;
            interruptOnSpeech?: boolean | undefined;
            silenceTimeoutMs?: number | undefined;
        } | undefined;
        session?: {
            mainKey?: string | undefined;
        } | undefined;
        ui?: {
            seamColor?: string | undefined;
        } | undefined;
    };
}>;
export declare const validateTalkRealtimeSessionParams: ValidateFunction<{
    sessionKey?: string | undefined;
    provider?: string | undefined;
    model?: string | undefined;
    voice?: string | undefined;
}>;
export declare const validateTalkRealtimeSessionResult: ValidateFunction<{
    provider: string;
    clientSecret: string;
    model?: string | undefined;
    voice?: string | undefined;
    expiresAt?: number | undefined;
}>;
export declare const validateTalkSpeakParams: ValidateFunction<{
    text: string;
    voiceId?: string | undefined;
    modelId?: string | undefined;
    outputFormat?: string | undefined;
    speed?: number | undefined;
    rateWpm?: number | undefined;
    stability?: number | undefined;
    similarity?: number | undefined;
    style?: number | undefined;
    speakerBoost?: boolean | undefined;
    seed?: number | undefined;
    normalize?: string | undefined;
    language?: string | undefined;
    latencyTier?: number | undefined;
}>;
export declare const validateTalkSpeakResult: ValidateFunction<{
    audioBase64: string;
    provider: string;
    outputFormat?: string | undefined;
    voiceCompatible?: boolean | undefined;
    mimeType?: string | undefined;
    fileExtension?: string | undefined;
}>;
export declare const validateChannelsStatusParams: ValidateFunction<{
    probe?: boolean | undefined;
    timeoutMs?: number | undefined;
}>;
export declare const validateChannelsStartParams: ValidateFunction<{
    channel: string;
    accountId?: string | undefined;
}>;
export declare const validateChannelsLogoutParams: ValidateFunction<{
    channel: string;
    accountId?: string | undefined;
}>;
export declare const validateModelsListParams: ValidateFunction<{
    preferCached?: boolean | undefined;
}>;
export declare const validateSkillsStatusParams: ValidateFunction<{
    agentId?: string | undefined;
}>;
export declare const validateToolsCatalogParams: ValidateFunction<{
    agentId?: string | undefined;
    includePlugins?: boolean | undefined;
}>;
export declare const validateToolsEffectiveParams: ValidateFunction<{
    agentId?: string | undefined;
    sessionKey: string;
}>;
export declare const validateSkillsBinsParams: ValidateFunction<object>;
export declare const validateSkillsInstallParams: ValidateFunction<{
    name: string;
    installId: string;
    dangerouslyForceUnsafeInstall?: boolean | undefined;
    timeoutMs?: number | undefined;
} | {
    source: "kovahub";
    slug: string;
    version?: string | undefined;
    force?: boolean | undefined;
    timeoutMs?: number | undefined;
}>;
export declare const validateSkillsUninstallParams: ValidateFunction<{
    source: "kovahub";
    slug: string;
}>;
export declare const validateSkillsUpdateParams: ValidateFunction<{
    skillKey: string;
    enabled?: boolean | undefined;
    apiKey?: string | undefined;
    env?: Record<string, string> | undefined;
} | {
    source: "kovahub";
    slug?: string | undefined;
    all?: boolean | undefined;
}>;
export declare const validateSkillsSearchParams: ValidateFunction<{
    query?: string | undefined;
    limit?: number | undefined;
}>;
export declare const validateSkillsDetailParams: ValidateFunction<{
    slug: string;
}>;
export declare const validateCronListParams: ValidateFunction<{
    includeDisabled?: boolean | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    query?: string | undefined;
    enabled?: "all" | "disabled" | "enabled" | undefined;
    sortBy?: "name" | "nextRunAtMs" | "updatedAtMs" | undefined;
    sortDir?: "asc" | "desc" | undefined;
}>;
export declare const validateCronStatusParams: ValidateFunction<object>;
export declare const validateCronAddParams: ValidateFunction<{
    agentId?: string | null | undefined;
    sessionKey?: string | null | undefined;
    description?: string | undefined;
    enabled?: boolean | undefined;
    deleteAfterRun?: boolean | undefined;
    name: string;
    schedule: {
        kind: "at";
        at: string;
    } | {
        kind: "every";
        everyMs: number;
        anchorMs?: number | undefined;
    } | {
        kind: "cron";
        expr: string;
        tz?: string | undefined;
        staggerMs?: number | undefined;
    };
    sessionTarget: string;
    wakeMode: "next-heartbeat" | "now";
    payload: {
        kind: "systemEvent";
        text: string;
    } | {
        kind: "agentTurn";
        message: unknown;
        model?: string | undefined;
        fallbacks?: string[] | undefined;
        thinking?: string | undefined;
        timeoutSeconds?: number | undefined;
        allowUnsafeExternalContent?: boolean | undefined;
        lightContext?: boolean | undefined;
        toolsAllow?: unknown;
    };
    delivery?: {
        channel?: string | undefined;
        accountId?: string | undefined;
        bestEffort?: boolean | undefined;
        failureDestination?: {
            channel?: string | undefined;
            to?: string | undefined;
            accountId?: string | undefined;
            mode?: "announce" | "webhook" | undefined;
        } | undefined;
        mode: "none";
        to?: string | undefined;
    } | {
        channel?: string | undefined;
        accountId?: string | undefined;
        bestEffort?: boolean | undefined;
        failureDestination?: {
            channel?: string | undefined;
            to?: string | undefined;
            accountId?: string | undefined;
            mode?: "announce" | "webhook" | undefined;
        } | undefined;
        mode: "announce";
        to?: string | undefined;
    } | {
        channel?: string | undefined;
        accountId?: string | undefined;
        bestEffort?: boolean | undefined;
        failureDestination?: {
            channel?: string | undefined;
            to?: string | undefined;
            accountId?: string | undefined;
            mode?: "announce" | "webhook" | undefined;
        } | undefined;
        mode: "webhook";
        to: string;
    } | undefined;
    failureAlert?: false | {
        after?: number | undefined;
        channel?: string | undefined;
        to?: string | undefined;
        cooldownMs?: number | undefined;
        includeSkipped?: boolean | undefined;
        mode?: "announce" | "webhook" | undefined;
        accountId?: string | undefined;
    } | undefined;
}>;
export declare const validateCronUpdateParams: ValidateFunction<{
    id: string;
} | {
    jobId: string;
}>;
export declare const validateCronRemoveParams: ValidateFunction<{
    id: string;
} | {
    jobId: string;
}>;
export declare const validateCronRunParams: ValidateFunction<{
    id: string;
} | {
    jobId: string;
}>;
export declare const validateCronRunsParams: ValidateFunction<{
    scope?: "all" | "job" | undefined;
    id?: string | undefined;
    jobId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    statuses?: ("error" | "ok" | "skipped")[] | undefined;
    status?: "all" | "error" | "ok" | "skipped" | undefined;
    deliveryStatuses?: ("delivered" | "not-delivered" | "not-requested" | "unknown")[] | undefined;
    deliveryStatus?: "delivered" | "not-delivered" | "not-requested" | "unknown" | undefined;
    query?: string | undefined;
    sortDir?: "asc" | "desc" | undefined;
}>;
export declare const validateTasksListParams: ValidateFunction<{
    status?: "all" | "cancelled" | "failed" | "lost" | "queued" | "running" | "succeeded" | "timed_out" | undefined;
    runtime?: "acp" | "all" | "cli" | "cron" | "subagent" | undefined;
    limit?: number | undefined;
}>;
export declare const validateTasksAuditParams: ValidateFunction<object>;
export declare const validateTasksMaintenanceParams: ValidateFunction<{
    apply?: boolean | undefined;
}>;
export declare const validateTasksShowParams: ValidateFunction<{
    lookup: string;
}>;
export declare const validateTasksCancelParams: ValidateFunction<{
    lookup: string;
}>;
export declare const validateTasksDeleteParams: ValidateFunction<{
    taskId: string;
    force?: boolean | undefined;
}>;
export declare const validateTasksNotifyParams: ValidateFunction<{
    lookup: string;
    notifyPolicy: "done_only" | "silent" | "state_changes";
}>;
export declare const validateTasksListResult: ValidateFunction<{
    tasks: {
        id: string;
        runtime: "acp" | "cli" | "cron" | "subagent";
        sourceId?: string | undefined;
        sessionKey: string;
        ownerKey: string;
        scope: "session" | "system";
        childSessionKey?: string | undefined;
        flowId?: string | undefined;
        parentTaskId?: string | undefined;
        agentId?: string | undefined;
        runId?: string | undefined;
        label?: string | undefined;
        title: string;
        status: "cancelled" | "failed" | "lost" | "queued" | "running" | "succeeded" | "timed_out";
        deliveryStatus: "delivered" | "failed" | "not_applicable" | "parent_missing" | "pending" | "session_queued";
        notifyPolicy: "done_only" | "silent" | "state_changes";
        createdAt: number;
        startedAt?: number | undefined;
        endedAt?: number | undefined;
        lastEventAt?: number | undefined;
        cleanupAfter?: number | undefined;
        error?: string | undefined;
        progressSummary?: string | undefined;
        terminalSummary?: string | undefined;
        terminalOutcome?: "blocked" | "succeeded" | undefined;
    }[];
    summary: {
        total: number;
        active: number;
        terminal: number;
        failures: number;
        byStatus: {
            queued: number;
            running: number;
            succeeded: number;
            failed: number;
            timed_out: number;
            cancelled: number;
            lost: number;
        };
        byRuntime: {
            subagent: number;
            acp: number;
            cli: number;
            cron: number;
        };
    };
    count: number;
}>;
export declare const validateTasksAuditResult: ValidateFunction<{
    tasks: {
        total: number;
        warnings: number;
        errors: number;
        byCode: {
            stale_queued: number;
            stale_running: number;
            lost: number;
            delivery_failed: number;
            missing_cleanup: number;
            inconsistent_timestamps: number;
        };
    };
    flows: {
        total: number;
        warnings: number;
        errors: number;
        byCode: {
            restore_failed: number;
            stale_running: number;
            stale_waiting: number;
            stale_blocked: number;
            cancel_stuck: number;
            missing_linked_tasks: number;
            blocked_task_missing: number;
            inconsistent_timestamps: number;
        };
    };
}>;
export declare const validateTasksMaintenanceResult: ValidateFunction<{
    apply: boolean;
    tasks: {
        reconciled: number;
        recovered: number;
        cleanupStamped: number;
        pruned: number;
    };
    flows: {
        reconciled: number;
        pruned: number;
    };
}>;
export declare const validateTasksShowResult: ValidateFunction<{
    task: {
        id: string;
        runtime: "acp" | "cli" | "cron" | "subagent";
        sourceId?: string | undefined;
        sessionKey: string;
        ownerKey: string;
        scope: "session" | "system";
        childSessionKey?: string | undefined;
        flowId?: string | undefined;
        parentTaskId?: string | undefined;
        agentId?: string | undefined;
        runId?: string | undefined;
        label?: string | undefined;
        title: string;
        status: "cancelled" | "failed" | "lost" | "queued" | "running" | "succeeded" | "timed_out";
        deliveryStatus: "delivered" | "failed" | "not_applicable" | "parent_missing" | "pending" | "session_queued";
        notifyPolicy: "done_only" | "silent" | "state_changes";
        createdAt: number;
        startedAt?: number | undefined;
        endedAt?: number | undefined;
        lastEventAt?: number | undefined;
        cleanupAfter?: number | undefined;
        error?: string | undefined;
        progressSummary?: string | undefined;
        terminalSummary?: string | undefined;
        terminalOutcome?: "blocked" | "succeeded" | undefined;
    };
}>;
export declare const validateTasksCancelResult: ValidateFunction<{
    found: boolean;
    cancelled: boolean;
    reason?: string | undefined;
    task?: {
        id: string;
        runtime: "acp" | "cli" | "cron" | "subagent";
        sourceId?: string | undefined;
        sessionKey: string;
        ownerKey: string;
        scope: "session" | "system";
        childSessionKey?: string | undefined;
        flowId?: string | undefined;
        parentTaskId?: string | undefined;
        agentId?: string | undefined;
        runId?: string | undefined;
        label?: string | undefined;
        title: string;
        status: "cancelled" | "failed" | "lost" | "queued" | "running" | "succeeded" | "timed_out";
        deliveryStatus: "delivered" | "failed" | "not_applicable" | "parent_missing" | "pending" | "session_queued";
        notifyPolicy: "done_only" | "silent" | "state_changes";
        createdAt: number;
        startedAt?: number | undefined;
        endedAt?: number | undefined;
        lastEventAt?: number | undefined;
        cleanupAfter?: number | undefined;
        error?: string | undefined;
        progressSummary?: string | undefined;
        terminalSummary?: string | undefined;
        terminalOutcome?: "blocked" | "succeeded" | undefined;
    } | undefined;
}>;
export declare const validateTasksDeleteResult: ValidateFunction<{
    deleted: boolean;
    reason?: string | undefined;
}>;
export declare const validateTasksNotifyResult: ValidateFunction<{
    updated: boolean;
    task?: {
        id: string;
        runtime: "acp" | "cli" | "cron" | "subagent";
        sourceId?: string | undefined;
        sessionKey: string;
        ownerKey: string;
        scope: "session" | "system";
        childSessionKey?: string | undefined;
        flowId?: string | undefined;
        parentTaskId?: string | undefined;
        agentId?: string | undefined;
        runId?: string | undefined;
        label?: string | undefined;
        title: string;
        status: "cancelled" | "failed" | "lost" | "queued" | "running" | "succeeded" | "timed_out";
        deliveryStatus: "delivered" | "failed" | "not_applicable" | "parent_missing" | "pending" | "session_queued";
        notifyPolicy: "done_only" | "silent" | "state_changes";
        createdAt: number;
        startedAt?: number | undefined;
        endedAt?: number | undefined;
        lastEventAt?: number | undefined;
        cleanupAfter?: number | undefined;
        error?: string | undefined;
        progressSummary?: string | undefined;
        terminalSummary?: string | undefined;
        terminalOutcome?: "blocked" | "succeeded" | undefined;
    } | undefined;
    reason?: string | undefined;
}>;
export declare const validateDevicePairListParams: ValidateFunction<object>;
export declare const validateDevicePairApproveParams: ValidateFunction<{
    requestId: string;
}>;
export declare const validateDevicePairRejectParams: ValidateFunction<{
    requestId: string;
}>;
export declare const validateDevicePairRemoveParams: ValidateFunction<{
    deviceId: string;
}>;
export declare const validateDeviceTokenRotateParams: ValidateFunction<{
    deviceId: string;
    role: string;
    scopes?: string[] | undefined;
}>;
export declare const validateDeviceTokenRevokeParams: ValidateFunction<{
    deviceId: string;
    role: string;
}>;
export declare const validateExecApprovalsGetParams: ValidateFunction<object>;
export declare const validateExecApprovalsSetParams: ValidateFunction<{
    file: {
        version: 1;
        socket?: {
            path?: string | undefined;
            token?: string | undefined;
        } | undefined;
        defaults?: {
            security?: string | undefined;
            ask?: string | undefined;
            askFallback?: string | undefined;
            autoAllowSkills?: boolean | undefined;
        } | undefined;
        agents?: Record<string, {
            security?: string | undefined;
            ask?: string | undefined;
            askFallback?: string | undefined;
            autoAllowSkills?: boolean | undefined;
            allowlist?: {
                id?: string | undefined;
                pattern: string;
                source?: "allow-always" | undefined;
                commandText?: string | undefined;
                argPattern?: string | undefined;
                lastUsedAt?: number | undefined;
                lastUsedCommand?: string | undefined;
                lastResolvedPath?: string | undefined;
            }[] | undefined;
        }> | undefined;
    };
    baseHash?: string | undefined;
}>;
export declare const validateExecApprovalGetParams: ValidateFunction<{
    id: string;
}>;
export declare const validateExecApprovalRequestParams: ValidateFunction<{
    id?: string | undefined;
    command?: string | undefined;
    commandArgv?: string[] | undefined;
    systemRunPlan?: {
        argv: string[];
        cwd: string | null;
        commandText: string;
        commandPreview?: string | null | undefined;
        agentId: string | null;
        sessionKey: string | null;
        mutableFileOperand?: {
            argvIndex: number;
            path: string;
            sha256: string;
        } | null | undefined;
    } | undefined;
    env?: Record<string, string> | undefined;
    cwd?: string | null | undefined;
    nodeId?: string | null | undefined;
    host?: string | null | undefined;
    security?: string | null | undefined;
    ask?: string | null | undefined;
    agentId?: string | null | undefined;
    resolvedPath?: string | null | undefined;
    sessionKey?: string | null | undefined;
    turnSourceChannel?: string | null | undefined;
    turnSourceTo?: string | null | undefined;
    turnSourceAccountId?: string | null | undefined;
    turnSourceThreadId?: string | number | null | undefined;
    timeoutMs?: number | undefined;
    twoPhase?: boolean | undefined;
}>;
export declare const validateExecApprovalResolveParams: ValidateFunction<{
    id: string;
    decision: string;
}>;
export declare const validatePluginApprovalRequestParams: ValidateFunction<{
    pluginId?: string | undefined;
    title: string;
    description: string;
    severity?: string | undefined;
    toolName?: string | undefined;
    toolCallId?: string | undefined;
    agentId?: string | undefined;
    sessionKey?: string | undefined;
    turnSourceChannel?: string | undefined;
    turnSourceTo?: string | undefined;
    turnSourceAccountId?: string | undefined;
    turnSourceThreadId?: string | number | undefined;
    timeoutMs?: number | undefined;
    twoPhase?: boolean | undefined;
}>;
export declare const validatePluginApprovalResolveParams: ValidateFunction<{
    id: string;
    decision: string;
}>;
export declare const validatePluginsStatusParams: ValidateFunction<object>;
export declare const validatePluginsSetEnabledParams: ValidateFunction<{
    pluginId: string;
    enabled: boolean;
}>;
export declare const validatePluginsUninstallParams: ValidateFunction<{
    pluginId: string;
    deleteFiles?: boolean | undefined;
}>;
export declare const validatePluginsInstallParams: ValidateFunction<{
    spec: string;
    force?: boolean | undefined;
    pin?: boolean | undefined;
    dangerouslyForceUnsafeInstall?: boolean | undefined;
}>;
export declare const validateExecApprovalsNodeGetParams: ValidateFunction<{
    nodeId: string;
}>;
export declare const validateExecApprovalsNodeSetParams: ValidateFunction<{
    nodeId: string;
    file: {
        version: 1;
        socket?: {
            path?: string | undefined;
            token?: string | undefined;
        } | undefined;
        defaults?: {
            security?: string | undefined;
            ask?: string | undefined;
            askFallback?: string | undefined;
            autoAllowSkills?: boolean | undefined;
        } | undefined;
        agents?: Record<string, {
            security?: string | undefined;
            ask?: string | undefined;
            askFallback?: string | undefined;
            autoAllowSkills?: boolean | undefined;
            allowlist?: {
                id?: string | undefined;
                pattern: string;
                source?: "allow-always" | undefined;
                commandText?: string | undefined;
                argPattern?: string | undefined;
                lastUsedAt?: number | undefined;
                lastUsedCommand?: string | undefined;
                lastResolvedPath?: string | undefined;
            }[] | undefined;
        }> | undefined;
    };
    baseHash?: string | undefined;
}>;
export declare const validateLogsTailParams: ValidateFunction<{
    cursor?: number | undefined;
    limit?: number | undefined;
    maxBytes?: number | undefined;
}>;
export declare const validateChatHistoryParams: ValidateFunction<unknown>;
export declare const validateChatSendParams: ValidateFunction<unknown>;
export declare const validateChatAbortParams: ValidateFunction<{
    sessionKey: string;
    runId?: string | undefined;
}>;
export declare const validateChatInjectParams: ValidateFunction<{
    sessionKey: string;
    message: string;
    label?: string | undefined;
}>;
export declare const validateChatEvent: ValidateFunction<unknown>;
export declare const validateUpdateStatusParams: ValidateFunction<object>;
export declare const validateUpdateRunParams: ValidateFunction<{
    sessionKey?: string | undefined;
    deliveryContext?: {
        channel?: string | undefined;
        to?: string | undefined;
        accountId?: string | undefined;
        threadId?: string | number | undefined;
    } | undefined;
    note?: string | undefined;
    restartDelayMs?: number | undefined;
    timeoutMs?: number | undefined;
}>;
export declare const validateWebLoginStartParams: ValidateFunction<{
    force?: boolean | undefined;
    timeoutMs?: number | undefined;
    verbose?: boolean | undefined;
    accountId?: string | undefined;
}>;
export declare const validateWebLoginWaitParams: ValidateFunction<{
    timeoutMs?: number | undefined;
    accountId?: string | undefined;
    currentQrDataUrl?: string | undefined;
}>;
export declare function formatValidationErrors(errors: ErrorObject[] | null | undefined): string;
export { ConnectParamsSchema, HelloOkSchema, RequestFrameSchema, ResponseFrameSchema, EventFrameSchema, GatewayFrameSchema, PresenceEntrySchema, SnapshotSchema, ErrorShapeSchema, StateVersionSchema, AgentEventSchema, MessageActionParamsSchema, ChatEventSchema, SendParamsSchema, PollParamsSchema, AgentParamsSchema, AgentIdentityParamsSchema, AgentIdentityResultSchema, WakeParamsSchema, PushTestParamsSchema, PushTestResultSchema, WebPushVapidPublicKeyParamsSchema, WebPushSubscribeParamsSchema, WebPushUnsubscribeParamsSchema, WebPushTestParamsSchema, NodePairRequestParamsSchema, NodePairListParamsSchema, NodePairApproveParamsSchema, NodePairRejectParamsSchema, NodePairRemoveParamsSchema, NodePairVerifyParamsSchema, NodeListParamsSchema, NodePendingAckParamsSchema, NodeInvokeParamsSchema, NodePendingDrainParamsSchema, NodePendingDrainResultSchema, NodePendingEnqueueParamsSchema, NodePendingEnqueueResultSchema, SessionsListParamsSchema, SessionsPreviewParamsSchema, SessionsResolveParamsSchema, SessionsCompactionListParamsSchema, SessionsCompactionGetParamsSchema, SessionsCompactionBranchParamsSchema, SessionsCompactionRestoreParamsSchema, SessionsCreateParamsSchema, SessionsSendParamsSchema, SessionsAbortParamsSchema, SessionsPatchParamsSchema, SessionsResetParamsSchema, SessionsDeleteParamsSchema, SessionsCompactParamsSchema, SessionsUsageParamsSchema, ConfigGetParamsSchema, ConfigSetParamsSchema, ConfigApplyParamsSchema, ConfigPatchParamsSchema, ConfigSchemaParamsSchema, ConfigSchemaLookupParamsSchema, ConfigSchemaResponseSchema, ConfigSchemaLookupResultSchema, UpdateStatusParamsSchema, WizardStartParamsSchema, WizardNextParamsSchema, WizardCancelParamsSchema, WizardStatusParamsSchema, WizardStepSchema, WizardNextResultSchema, WizardStartResultSchema, WizardStatusResultSchema, TalkConfigParamsSchema, TalkConfigResultSchema, TalkRealtimeSessionParamsSchema, TalkRealtimeSessionResultSchema, TalkSpeakParamsSchema, TalkSpeakResultSchema, ChannelsStatusParamsSchema, ChannelsStatusResultSchema, ChannelsStartParamsSchema, ChannelsLogoutParamsSchema, WebLoginStartParamsSchema, WebLoginWaitParamsSchema, AgentSummarySchema, AgentsFileEntrySchema, AgentsCreateParamsSchema, AgentsCreateResultSchema, AgentsUpdateParamsSchema, AgentsUpdateResultSchema, AgentsDeleteParamsSchema, AgentsDeleteResultSchema, AgentsFilesListParamsSchema, AgentsFilesListResultSchema, AgentsFilesGetParamsSchema, AgentsFilesGetResultSchema, AgentsFilesSetParamsSchema, AgentsFilesSetResultSchema, AgentsListParamsSchema, AgentsListResultSchema, CommandsListParamsSchema, CommandsListResultSchema, ModelsListParamsSchema, SkillsStatusParamsSchema, ToolsCatalogParamsSchema, ToolsEffectiveParamsSchema, SkillsInstallParamsSchema, SkillsUninstallParamsSchema, SkillsSearchParamsSchema, SkillsSearchResultSchema, SkillsDetailParamsSchema, SkillsDetailResultSchema, SkillsUpdateParamsSchema, CronJobSchema, CronListParamsSchema, CronStatusParamsSchema, CronAddParamsSchema, CronUpdateParamsSchema, CronRemoveParamsSchema, CronRunParamsSchema, CronRunsParamsSchema, TasksListParamsSchema, TasksListResultSchema, TasksAuditParamsSchema, TasksAuditResultSchema, TasksMaintenanceParamsSchema, TasksMaintenanceResultSchema, TasksShowParamsSchema, TasksShowResultSchema, TasksCancelParamsSchema, TasksCancelResultSchema, TasksDeleteParamsSchema, TasksDeleteResultSchema, TasksNotifyParamsSchema, TasksNotifyResultSchema, LogsTailParamsSchema, LogsTailResultSchema, ExecApprovalsGetParamsSchema, ExecApprovalsSetParamsSchema, ExecApprovalGetParamsSchema, ExecApprovalRequestParamsSchema, ExecApprovalResolveParamsSchema, ChatHistoryParamsSchema, ChatSendParamsSchema, ChatInjectParamsSchema, UpdateRunParamsSchema, TickEventSchema, ShutdownEventSchema, ProtocolSchemas, PROTOCOL_VERSION, ErrorCodes, errorShape, };
export type { GatewayFrame, ConnectParams, HelloOk, RequestFrame, ResponseFrame, EventFrame, PresenceEntry, Snapshot, ErrorShape, StateVersion, AgentEvent, AgentIdentityParams, AgentIdentityResult, AgentWaitParams, ChatEvent, TickEvent, ShutdownEvent, WakeParams, NodePairRequestParams, NodePairListParams, NodePairApproveParams, DevicePairListParams, DevicePairApproveParams, DevicePairRejectParams, ConfigGetParams, ConfigSetParams, ConfigApplyParams, ConfigPatchParams, ConfigSchemaParams, ConfigSchemaResponse, WizardStartParams, WizardNextParams, WizardCancelParams, WizardStatusParams, WizardStep, WizardNextResult, WizardStartResult, WizardStatusResult, TalkConfigParams, TalkConfigResult, TalkRealtimeSessionParams, TalkRealtimeSessionResult, TalkSpeakParams, TalkSpeakResult, TalkModeParams, ChannelsStatusParams, ChannelsStatusResult, ChannelsStartParams, ChannelsLogoutParams, WebLoginStartParams, WebLoginWaitParams, AgentSummary, AgentsFileEntry, AgentsCreateParams, AgentsCreateResult, AgentsUpdateParams, AgentsUpdateResult, AgentsDeleteParams, AgentsDeleteResult, AgentsFilesListParams, AgentsFilesListResult, AgentsFilesGetParams, AgentsFilesGetResult, AgentsFilesSetParams, AgentsFilesSetResult, AgentsListParams, AgentsListResult, CommandsListParams, CommandsListResult, CommandEntry, SkillsStatusParams, ToolsCatalogParams, ToolsCatalogResult, ToolsEffectiveParams, ToolsEffectiveResult, SkillsBinsParams, SkillsBinsResult, SkillsSearchParams, SkillsSearchResult, SkillsDetailParams, SkillsDetailResult, SkillsInstallParams, SkillsUninstallParams, SkillsUpdateParams, NodePairRejectParams, NodePairRemoveParams, NodePairVerifyParams, NodeListParams, NodeInvokeParams, NodeInvokeResultParams, NodeEventParams, NodePendingDrainParams, NodePendingDrainResult, NodePendingEnqueueParams, NodePendingEnqueueResult, SessionsListParams, SessionsPreviewParams, SessionsResolveParams, SessionsPatchParams, SessionsPatchResult, SessionsResetParams, SessionsDeleteParams, SessionsCompactParams, SessionsUsageParams, CronJob, CronListParams, CronStatusParams, CronAddParams, CronUpdateParams, CronRemoveParams, CronRunParams, CronRunsParams, CronRunLogEntry, TasksListParams, TasksListResult, TasksAuditParams, TasksAuditResult, TasksMaintenanceParams, TasksMaintenanceResult, TasksShowParams, TasksShowResult, TasksCancelParams, TasksCancelResult, TasksDeleteParams, TasksDeleteResult, TasksNotifyParams, TasksNotifyResult, ExecApprovalsGetParams, ExecApprovalsSetParams, ExecApprovalsSnapshot, ExecApprovalGetParams, ExecApprovalRequestParams, ExecApprovalResolveParams, LogsTailParams, LogsTailResult, PluginsInstallParams, PluginsInstallResult, PluginsMutationResult, PluginsSetEnabledParams, PluginStatusDiagnostic, PluginStatusSummary, PluginsStatusParams, PluginsStatusResult, PluginsUninstallParams, PollParams, WebPushVapidPublicKeyParams, WebPushSubscribeParams, WebPushUnsubscribeParams, WebPushTestParams, UpdateStatusParams, UpdateRunParams, ChatInjectParams, };
