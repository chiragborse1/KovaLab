import type { TaskFlowRecord } from "./task-flow-registry.types.js";
export type TaskFlowAuditSeverity = "warn" | "error";
export type TaskFlowAuditCode = "restore_failed" | "stale_running" | "stale_waiting" | "stale_blocked" | "cancel_stuck" | "missing_linked_tasks" | "blocked_task_missing" | "inconsistent_timestamps";
export type TaskFlowAuditFinding = {
    severity: TaskFlowAuditSeverity;
    code: TaskFlowAuditCode;
    detail: string;
    ageMs?: number;
    flow?: TaskFlowRecord;
};
export type TaskFlowAuditSummary = {
    total: number;
    warnings: number;
    errors: number;
    byCode: Record<TaskFlowAuditCode, number>;
};
export type TaskFlowAuditOptions = {
    now?: number;
    flows?: TaskFlowRecord[];
    staleRunningMs?: number;
    staleWaitingMs?: number;
    staleBlockedMs?: number;
    cancelStuckMs?: number;
};
export declare function createEmptyTaskFlowAuditSummary(): TaskFlowAuditSummary;
export declare function listTaskFlowAuditFindings(options?: TaskFlowAuditOptions): TaskFlowAuditFinding[];
export declare function summarizeTaskFlowAuditFindings(findings: Iterable<TaskFlowAuditFinding>): TaskFlowAuditSummary;
