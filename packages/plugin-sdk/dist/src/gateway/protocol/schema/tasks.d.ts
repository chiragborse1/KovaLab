import { Type, type Static } from "typebox";
export declare const TaskRunAggregateSummarySchema: Type.TObject<{
    total: Type.TNumber;
    active: Type.TNumber;
    terminal: Type.TNumber;
    failures: Type.TNumber;
    byStatus: Type.TObject<{
        queued: Type.TNumber;
        running: Type.TNumber;
        succeeded: Type.TNumber;
        failed: Type.TNumber;
        timed_out: Type.TNumber;
        cancelled: Type.TNumber;
        lost: Type.TNumber;
    }>;
    byRuntime: Type.TObject<{
        subagent: Type.TNumber;
        acp: Type.TNumber;
        cli: Type.TNumber;
        cron: Type.TNumber;
    }>;
}>;
export declare const TaskRunViewSchema: Type.TObject<{
    id: Type.TString;
    runtime: Type.TUnion<[Type.TLiteral<"subagent">, Type.TLiteral<"acp">, Type.TLiteral<"cli">, Type.TLiteral<"cron">]>;
    sourceId: Type.TOptional<Type.TString>;
    sessionKey: Type.TString;
    ownerKey: Type.TString;
    scope: Type.TUnion<[Type.TLiteral<"session">, Type.TLiteral<"system">]>;
    childSessionKey: Type.TOptional<Type.TString>;
    flowId: Type.TOptional<Type.TString>;
    parentTaskId: Type.TOptional<Type.TString>;
    agentId: Type.TOptional<Type.TString>;
    runId: Type.TOptional<Type.TString>;
    label: Type.TOptional<Type.TString>;
    title: Type.TString;
    status: Type.TUnion<[Type.TLiteral<"queued">, Type.TLiteral<"running">, Type.TLiteral<"succeeded">, Type.TLiteral<"failed">, Type.TLiteral<"timed_out">, Type.TLiteral<"cancelled">, Type.TLiteral<"lost">]>;
    deliveryStatus: Type.TUnion<[Type.TLiteral<"pending">, Type.TLiteral<"delivered">, Type.TLiteral<"session_queued">, Type.TLiteral<"failed">, Type.TLiteral<"parent_missing">, Type.TLiteral<"not_applicable">]>;
    notifyPolicy: Type.TUnion<[Type.TLiteral<"done_only">, Type.TLiteral<"state_changes">, Type.TLiteral<"silent">]>;
    createdAt: Type.TNumber;
    startedAt: Type.TOptional<Type.TNumber>;
    endedAt: Type.TOptional<Type.TNumber>;
    lastEventAt: Type.TOptional<Type.TNumber>;
    cleanupAfter: Type.TOptional<Type.TNumber>;
    error: Type.TOptional<Type.TString>;
    progressSummary: Type.TOptional<Type.TString>;
    terminalSummary: Type.TOptional<Type.TString>;
    terminalOutcome: Type.TOptional<Type.TUnion<[Type.TLiteral<"succeeded">, Type.TLiteral<"blocked">]>>;
}>;
export declare const TasksListParamsSchema: Type.TObject<{
    status: Type.TOptional<Type.TUnion<[Type.TUnion<[Type.TLiteral<"queued">, Type.TLiteral<"running">, Type.TLiteral<"succeeded">, Type.TLiteral<"failed">, Type.TLiteral<"timed_out">, Type.TLiteral<"cancelled">, Type.TLiteral<"lost">]>, Type.TLiteral<"all">]>>;
    runtime: Type.TOptional<Type.TUnion<[Type.TUnion<[Type.TLiteral<"subagent">, Type.TLiteral<"acp">, Type.TLiteral<"cli">, Type.TLiteral<"cron">]>, Type.TLiteral<"all">]>>;
    limit: Type.TOptional<Type.TInteger>;
}>;
export type TasksListParams = Static<typeof TasksListParamsSchema>;
export declare const TasksListResultSchema: Type.TObject<{
    tasks: Type.TArray<Type.TObject<{
        id: Type.TString;
        runtime: Type.TUnion<[Type.TLiteral<"subagent">, Type.TLiteral<"acp">, Type.TLiteral<"cli">, Type.TLiteral<"cron">]>;
        sourceId: Type.TOptional<Type.TString>;
        sessionKey: Type.TString;
        ownerKey: Type.TString;
        scope: Type.TUnion<[Type.TLiteral<"session">, Type.TLiteral<"system">]>;
        childSessionKey: Type.TOptional<Type.TString>;
        flowId: Type.TOptional<Type.TString>;
        parentTaskId: Type.TOptional<Type.TString>;
        agentId: Type.TOptional<Type.TString>;
        runId: Type.TOptional<Type.TString>;
        label: Type.TOptional<Type.TString>;
        title: Type.TString;
        status: Type.TUnion<[Type.TLiteral<"queued">, Type.TLiteral<"running">, Type.TLiteral<"succeeded">, Type.TLiteral<"failed">, Type.TLiteral<"timed_out">, Type.TLiteral<"cancelled">, Type.TLiteral<"lost">]>;
        deliveryStatus: Type.TUnion<[Type.TLiteral<"pending">, Type.TLiteral<"delivered">, Type.TLiteral<"session_queued">, Type.TLiteral<"failed">, Type.TLiteral<"parent_missing">, Type.TLiteral<"not_applicable">]>;
        notifyPolicy: Type.TUnion<[Type.TLiteral<"done_only">, Type.TLiteral<"state_changes">, Type.TLiteral<"silent">]>;
        createdAt: Type.TNumber;
        startedAt: Type.TOptional<Type.TNumber>;
        endedAt: Type.TOptional<Type.TNumber>;
        lastEventAt: Type.TOptional<Type.TNumber>;
        cleanupAfter: Type.TOptional<Type.TNumber>;
        error: Type.TOptional<Type.TString>;
        progressSummary: Type.TOptional<Type.TString>;
        terminalSummary: Type.TOptional<Type.TString>;
        terminalOutcome: Type.TOptional<Type.TUnion<[Type.TLiteral<"succeeded">, Type.TLiteral<"blocked">]>>;
    }>>;
    summary: Type.TObject<{
        total: Type.TNumber;
        active: Type.TNumber;
        terminal: Type.TNumber;
        failures: Type.TNumber;
        byStatus: Type.TObject<{
            queued: Type.TNumber;
            running: Type.TNumber;
            succeeded: Type.TNumber;
            failed: Type.TNumber;
            timed_out: Type.TNumber;
            cancelled: Type.TNumber;
            lost: Type.TNumber;
        }>;
        byRuntime: Type.TObject<{
            subagent: Type.TNumber;
            acp: Type.TNumber;
            cli: Type.TNumber;
            cron: Type.TNumber;
        }>;
    }>;
    count: Type.TNumber;
}>;
export type TasksListResult = Static<typeof TasksListResultSchema>;
export declare const TasksAuditParamsSchema: Type.TObject<{}>;
export type TasksAuditParams = Static<typeof TasksAuditParamsSchema>;
export declare const TasksAuditResultSchema: Type.TObject<{
    tasks: Type.TObject<{
        total: Type.TNumber;
        warnings: Type.TNumber;
        errors: Type.TNumber;
        byCode: Type.TObject<{
            stale_queued: Type.TNumber;
            stale_running: Type.TNumber;
            lost: Type.TNumber;
            delivery_failed: Type.TNumber;
            missing_cleanup: Type.TNumber;
            inconsistent_timestamps: Type.TNumber;
        }>;
    }>;
    flows: Type.TObject<{
        total: Type.TNumber;
        warnings: Type.TNumber;
        errors: Type.TNumber;
        byCode: Type.TObject<{
            restore_failed: Type.TNumber;
            stale_running: Type.TNumber;
            stale_waiting: Type.TNumber;
            stale_blocked: Type.TNumber;
            cancel_stuck: Type.TNumber;
            missing_linked_tasks: Type.TNumber;
            blocked_task_missing: Type.TNumber;
            inconsistent_timestamps: Type.TNumber;
        }>;
    }>;
}>;
export type TasksAuditResult = Static<typeof TasksAuditResultSchema>;
export declare const TasksMaintenanceParamsSchema: Type.TObject<{
    apply: Type.TOptional<Type.TBoolean>;
}>;
export type TasksMaintenanceParams = Static<typeof TasksMaintenanceParamsSchema>;
export declare const TasksMaintenanceResultSchema: Type.TObject<{
    apply: Type.TBoolean;
    tasks: Type.TObject<{
        reconciled: Type.TNumber;
        recovered: Type.TNumber;
        cleanupStamped: Type.TNumber;
        pruned: Type.TNumber;
    }>;
    flows: Type.TObject<{
        reconciled: Type.TNumber;
        pruned: Type.TNumber;
    }>;
}>;
export type TasksMaintenanceResult = Static<typeof TasksMaintenanceResultSchema>;
export declare const TasksShowParamsSchema: Type.TObject<{
    lookup: Type.TString;
}>;
export type TasksShowParams = Static<typeof TasksShowParamsSchema>;
export declare const TasksShowResultSchema: Type.TObject<{
    task: Type.TObject<{
        id: Type.TString;
        runtime: Type.TUnion<[Type.TLiteral<"subagent">, Type.TLiteral<"acp">, Type.TLiteral<"cli">, Type.TLiteral<"cron">]>;
        sourceId: Type.TOptional<Type.TString>;
        sessionKey: Type.TString;
        ownerKey: Type.TString;
        scope: Type.TUnion<[Type.TLiteral<"session">, Type.TLiteral<"system">]>;
        childSessionKey: Type.TOptional<Type.TString>;
        flowId: Type.TOptional<Type.TString>;
        parentTaskId: Type.TOptional<Type.TString>;
        agentId: Type.TOptional<Type.TString>;
        runId: Type.TOptional<Type.TString>;
        label: Type.TOptional<Type.TString>;
        title: Type.TString;
        status: Type.TUnion<[Type.TLiteral<"queued">, Type.TLiteral<"running">, Type.TLiteral<"succeeded">, Type.TLiteral<"failed">, Type.TLiteral<"timed_out">, Type.TLiteral<"cancelled">, Type.TLiteral<"lost">]>;
        deliveryStatus: Type.TUnion<[Type.TLiteral<"pending">, Type.TLiteral<"delivered">, Type.TLiteral<"session_queued">, Type.TLiteral<"failed">, Type.TLiteral<"parent_missing">, Type.TLiteral<"not_applicable">]>;
        notifyPolicy: Type.TUnion<[Type.TLiteral<"done_only">, Type.TLiteral<"state_changes">, Type.TLiteral<"silent">]>;
        createdAt: Type.TNumber;
        startedAt: Type.TOptional<Type.TNumber>;
        endedAt: Type.TOptional<Type.TNumber>;
        lastEventAt: Type.TOptional<Type.TNumber>;
        cleanupAfter: Type.TOptional<Type.TNumber>;
        error: Type.TOptional<Type.TString>;
        progressSummary: Type.TOptional<Type.TString>;
        terminalSummary: Type.TOptional<Type.TString>;
        terminalOutcome: Type.TOptional<Type.TUnion<[Type.TLiteral<"succeeded">, Type.TLiteral<"blocked">]>>;
    }>;
}>;
export type TasksShowResult = Static<typeof TasksShowResultSchema>;
export declare const TasksCancelParamsSchema: Type.TObject<{
    lookup: Type.TString;
}>;
export type TasksCancelParams = Static<typeof TasksCancelParamsSchema>;
export declare const TasksCancelResultSchema: Type.TObject<{
    found: Type.TBoolean;
    cancelled: Type.TBoolean;
    reason: Type.TOptional<Type.TString>;
    task: Type.TOptional<Type.TObject<{
        id: Type.TString;
        runtime: Type.TUnion<[Type.TLiteral<"subagent">, Type.TLiteral<"acp">, Type.TLiteral<"cli">, Type.TLiteral<"cron">]>;
        sourceId: Type.TOptional<Type.TString>;
        sessionKey: Type.TString;
        ownerKey: Type.TString;
        scope: Type.TUnion<[Type.TLiteral<"session">, Type.TLiteral<"system">]>;
        childSessionKey: Type.TOptional<Type.TString>;
        flowId: Type.TOptional<Type.TString>;
        parentTaskId: Type.TOptional<Type.TString>;
        agentId: Type.TOptional<Type.TString>;
        runId: Type.TOptional<Type.TString>;
        label: Type.TOptional<Type.TString>;
        title: Type.TString;
        status: Type.TUnion<[Type.TLiteral<"queued">, Type.TLiteral<"running">, Type.TLiteral<"succeeded">, Type.TLiteral<"failed">, Type.TLiteral<"timed_out">, Type.TLiteral<"cancelled">, Type.TLiteral<"lost">]>;
        deliveryStatus: Type.TUnion<[Type.TLiteral<"pending">, Type.TLiteral<"delivered">, Type.TLiteral<"session_queued">, Type.TLiteral<"failed">, Type.TLiteral<"parent_missing">, Type.TLiteral<"not_applicable">]>;
        notifyPolicy: Type.TUnion<[Type.TLiteral<"done_only">, Type.TLiteral<"state_changes">, Type.TLiteral<"silent">]>;
        createdAt: Type.TNumber;
        startedAt: Type.TOptional<Type.TNumber>;
        endedAt: Type.TOptional<Type.TNumber>;
        lastEventAt: Type.TOptional<Type.TNumber>;
        cleanupAfter: Type.TOptional<Type.TNumber>;
        error: Type.TOptional<Type.TString>;
        progressSummary: Type.TOptional<Type.TString>;
        terminalSummary: Type.TOptional<Type.TString>;
        terminalOutcome: Type.TOptional<Type.TUnion<[Type.TLiteral<"succeeded">, Type.TLiteral<"blocked">]>>;
    }>>;
}>;
export type TasksCancelResult = Static<typeof TasksCancelResultSchema>;
export declare const TasksDeleteParamsSchema: Type.TObject<{
    taskId: Type.TString;
    force: Type.TOptional<Type.TBoolean>;
}>;
export type TasksDeleteParams = Static<typeof TasksDeleteParamsSchema>;
export declare const TasksDeleteResultSchema: Type.TObject<{
    deleted: Type.TBoolean;
    reason: Type.TOptional<Type.TString>;
}>;
export type TasksDeleteResult = Static<typeof TasksDeleteResultSchema>;
export declare const TasksNotifyParamsSchema: Type.TObject<{
    lookup: Type.TString;
    notifyPolicy: Type.TUnion<[Type.TLiteral<"done_only">, Type.TLiteral<"state_changes">, Type.TLiteral<"silent">]>;
}>;
export type TasksNotifyParams = Static<typeof TasksNotifyParamsSchema>;
export declare const TasksNotifyResultSchema: Type.TObject<{
    updated: Type.TBoolean;
    task: Type.TOptional<Type.TObject<{
        id: Type.TString;
        runtime: Type.TUnion<[Type.TLiteral<"subagent">, Type.TLiteral<"acp">, Type.TLiteral<"cli">, Type.TLiteral<"cron">]>;
        sourceId: Type.TOptional<Type.TString>;
        sessionKey: Type.TString;
        ownerKey: Type.TString;
        scope: Type.TUnion<[Type.TLiteral<"session">, Type.TLiteral<"system">]>;
        childSessionKey: Type.TOptional<Type.TString>;
        flowId: Type.TOptional<Type.TString>;
        parentTaskId: Type.TOptional<Type.TString>;
        agentId: Type.TOptional<Type.TString>;
        runId: Type.TOptional<Type.TString>;
        label: Type.TOptional<Type.TString>;
        title: Type.TString;
        status: Type.TUnion<[Type.TLiteral<"queued">, Type.TLiteral<"running">, Type.TLiteral<"succeeded">, Type.TLiteral<"failed">, Type.TLiteral<"timed_out">, Type.TLiteral<"cancelled">, Type.TLiteral<"lost">]>;
        deliveryStatus: Type.TUnion<[Type.TLiteral<"pending">, Type.TLiteral<"delivered">, Type.TLiteral<"session_queued">, Type.TLiteral<"failed">, Type.TLiteral<"parent_missing">, Type.TLiteral<"not_applicable">]>;
        notifyPolicy: Type.TUnion<[Type.TLiteral<"done_only">, Type.TLiteral<"state_changes">, Type.TLiteral<"silent">]>;
        createdAt: Type.TNumber;
        startedAt: Type.TOptional<Type.TNumber>;
        endedAt: Type.TOptional<Type.TNumber>;
        lastEventAt: Type.TOptional<Type.TNumber>;
        cleanupAfter: Type.TOptional<Type.TNumber>;
        error: Type.TOptional<Type.TString>;
        progressSummary: Type.TOptional<Type.TString>;
        terminalSummary: Type.TOptional<Type.TString>;
        terminalOutcome: Type.TOptional<Type.TUnion<[Type.TLiteral<"succeeded">, Type.TLiteral<"blocked">]>>;
    }>>;
    reason: Type.TOptional<Type.TString>;
}>;
export type TasksNotifyResult = Static<typeof TasksNotifyResultSchema>;
