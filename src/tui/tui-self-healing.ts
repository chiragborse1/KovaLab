import type { TuiTasksAudit, TuiTasksMaintenance } from "./tui-backend.js";

export type TuiRecoveryAction = "status" | "apply";

export type TuiSelfHealingReport = {
  action: TuiRecoveryAction;
  auditBefore?: TuiTasksAudit;
  maintenance?: TuiTasksMaintenance;
  auditAfter?: TuiTasksAudit;
  unavailable?: string[];
};

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

function formatAuditCodes(byCode: Record<string, number>): string {
  return Object.entries(byCode)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => `${code}:${String(count)}`)
    .join(", ");
}

function auditTotals(audit: TuiTasksAudit | undefined) {
  const taskIssues = audit?.tasks.total ?? 0;
  const flowIssues = audit?.flows.total ?? 0;
  const errors = (audit?.tasks.errors ?? 0) + (audit?.flows.errors ?? 0);
  const warnings = (audit?.tasks.warnings ?? 0) + (audit?.flows.warnings ?? 0);
  return {
    taskIssues,
    flowIssues,
    total: taskIssues + flowIssues,
    errors,
    warnings,
  };
}

export function formatTaskAudit(result: TuiTasksAudit): string {
  const totals = auditTotals(result);
  const lines = [`Recovery audit: ${totals.total === 0 ? "clean" : plural(totals.total, "issue")}`];
  if (totals.taskIssues > 0) {
    const codes = formatAuditCodes(result.tasks.byCode);
    lines.push(
      `- tasks: ${String(result.tasks.errors)} errors, ${String(result.tasks.warnings)} warnings${
        codes ? ` (${codes})` : ""
      }`,
    );
  }
  if (totals.flowIssues > 0) {
    const codes = formatAuditCodes(result.flows.byCode);
    lines.push(
      `- task flows: ${String(result.flows.errors)} errors, ${String(
        result.flows.warnings,
      )} warnings${codes ? ` (${codes})` : ""}`,
    );
  }
  if (totals.total > 0) {
    lines.push("Run /recover apply to reconcile lost/stale records and prune old terminal work.");
  }
  return lines.join("\n");
}

function maintenanceActionCount(result: TuiTasksMaintenance | undefined): number {
  if (!result) {
    return 0;
  }
  return (
    result.tasks.reconciled +
    result.tasks.recovered +
    result.tasks.cleanupStamped +
    result.tasks.pruned +
    result.flows.reconciled +
    result.flows.pruned
  );
}

export function formatMaintenanceSummary(result: TuiTasksMaintenance): string {
  const total = maintenanceActionCount(result);
  const label = result.apply ? "Recovery applied" : "Recovery preview";
  const lines = [
    `${label}: ${total === 0 ? "nothing to change" : plural(total, "action")}`,
    `- tasks: ${String(result.tasks.reconciled)} reconciled, ${String(
      result.tasks.recovered,
    )} recovered, ${String(result.tasks.cleanupStamped)} cleanup-stamped, ${String(
      result.tasks.pruned,
    )} pruned`,
    `- task flows: ${String(result.flows.reconciled)} reconciled, ${String(
      result.flows.pruned,
    )} pruned`,
  ];
  if (!result.apply && total > 0) {
    lines.push("Run /recover apply to apply this maintenance.");
  }
  return lines.join("\n");
}

export function normalizeRecoveryAction(args: string): TuiRecoveryAction | null {
  const normalized = args.trim().toLowerCase();
  if (!normalized || normalized === "status" || normalized === "scan" || normalized === "audit") {
    return "status";
  }
  if (normalized === "apply" || normalized === "fix" || normalized === "repair") {
    return "apply";
  }
  return null;
}

export function formatSelfHealingReport(report: TuiSelfHealingReport): string {
  const before = auditTotals(report.auditBefore);
  const after = auditTotals(report.auditAfter ?? report.auditBefore);
  const actions = maintenanceActionCount(report.maintenance);
  const mode = report.action === "apply" ? "apply" : "scan";
  const state =
    report.action === "apply"
      ? after.total === 0
        ? "clean after repair"
        : `${plural(after.total, "issue")} remain`
      : before.total === 0 && actions === 0
        ? "clean"
        : actions > 0
          ? "repair available"
          : `${plural(before.total, "issue")} found`;
  const lines = [
    `Self-healing ${mode}: ${state}`,
    `Health: ${String(after.errors)} errors, ${String(after.warnings)} warnings`,
  ];

  if (report.action === "apply" && report.auditBefore) {
    lines.push(
      `Before: ${plural(before.total, "issue")} (${String(before.errors)} errors, ${String(
        before.warnings,
      )} warnings)`,
    );
  }

  if (report.auditBefore && report.action === "status") {
    const taskCodes = formatAuditCodes(report.auditBefore.tasks.byCode);
    const flowCodes = formatAuditCodes(report.auditBefore.flows.byCode);
    lines.push(
      `Audit: tasks ${String(report.auditBefore.tasks.total)}, task flows ${String(
        report.auditBefore.flows.total,
      )}`,
    );
    if (taskCodes) {
      lines.push(`Task codes: ${taskCodes}`);
    }
    if (flowCodes) {
      lines.push(`TaskFlow codes: ${flowCodes}`);
    }
  }

  if (report.maintenance) {
    const label = report.action === "apply" ? "Applied" : "Preview";
    lines.push(
      `${label}: ${String(report.maintenance.tasks.reconciled)} reconciled, ${String(
        report.maintenance.tasks.recovered,
      )} recovered, ${String(report.maintenance.tasks.cleanupStamped)} cleanup-stamped, ${String(
        report.maintenance.tasks.pruned,
      )} pruned, ${String(report.maintenance.flows.reconciled)} flow reconciled, ${String(
        report.maintenance.flows.pruned,
      )} flow pruned`,
    );
  }

  for (const item of report.unavailable ?? []) {
    lines.push(`Unavailable: ${item}`);
  }

  if (report.action === "status" && actions > 0) {
    lines.push("Next: /recover apply");
  } else if (report.action === "status" && before.total > 0) {
    lines.push("Next: /tasks audit for the raw issue rows");
  } else if (report.action === "apply" && after.total > 0) {
    lines.push("Next: /tasks audit for the remaining issue rows");
  } else {
    lines.push("Next: keep working; no terminal repair needed.");
  }

  return lines.join("\n");
}
