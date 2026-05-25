import { type TaskFlowAuditSummary } from "./task-flow-registry.audit.js";
export type TaskFlowRegistryMaintenanceSummary = {
    reconciled: number;
    pruned: number;
};
export declare function getInspectableTaskFlowAuditSummary(): TaskFlowAuditSummary;
export declare function previewTaskFlowRegistryMaintenance(): TaskFlowRegistryMaintenanceSummary;
export declare function runTaskFlowRegistryMaintenance(): Promise<TaskFlowRegistryMaintenanceSummary>;
