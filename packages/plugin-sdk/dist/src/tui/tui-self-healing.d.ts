import type { TuiTasksAudit, TuiTasksMaintenance } from "./tui-backend.js";
export type TuiRecoveryAction = "status" | "apply";
export type TuiSelfHealingReport = {
    action: TuiRecoveryAction;
    auditBefore?: TuiTasksAudit;
    maintenance?: TuiTasksMaintenance;
    auditAfter?: TuiTasksAudit;
    unavailable?: string[];
};
export declare function formatTaskAudit(result: TuiTasksAudit): string;
export declare function formatMaintenanceSummary(result: TuiTasksMaintenance): string;
export declare function normalizeRecoveryAction(args: string): TuiRecoveryAction | null;
export declare function formatSelfHealingReport(report: TuiSelfHealingReport): string;
