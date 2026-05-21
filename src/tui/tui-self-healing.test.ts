import { describe, expect, it } from "vitest";
import {
  formatSelfHealingReport,
  normalizeRecoveryAction,
  type TuiSelfHealingReport,
} from "./tui-self-healing.js";

const dirtyAudit = {
  tasks: {
    total: 1,
    warnings: 1,
    errors: 0,
    byCode: {
      stale_queued: 0,
      stale_running: 0,
      lost: 0,
      delivery_failed: 0,
      missing_cleanup: 1,
      inconsistent_timestamps: 0,
    },
  },
  flows: {
    total: 1,
    warnings: 0,
    errors: 1,
    byCode: {
      restore_failed: 0,
      stale_running: 1,
      stale_waiting: 0,
      stale_blocked: 0,
      cancel_stuck: 0,
      missing_linked_tasks: 0,
      blocked_task_missing: 0,
      inconsistent_timestamps: 0,
    },
  },
};

const cleanAudit = {
  tasks: {
    total: 0,
    warnings: 0,
    errors: 0,
    byCode: {
      stale_queued: 0,
      stale_running: 0,
      lost: 0,
      delivery_failed: 0,
      missing_cleanup: 0,
      inconsistent_timestamps: 0,
    },
  },
  flows: {
    total: 0,
    warnings: 0,
    errors: 0,
    byCode: {
      restore_failed: 0,
      stale_running: 0,
      stale_waiting: 0,
      stale_blocked: 0,
      cancel_stuck: 0,
      missing_linked_tasks: 0,
      blocked_task_missing: 0,
      inconsistent_timestamps: 0,
    },
  },
};

const maintenance = {
  apply: false,
  tasks: {
    reconciled: 0,
    recovered: 0,
    cleanupStamped: 1,
    pruned: 0,
  },
  flows: {
    reconciled: 1,
    pruned: 0,
  },
};

describe("tui self-healing formatter", () => {
  it("formats a status scan with available repair actions", () => {
    const report: TuiSelfHealingReport = {
      action: "status",
      auditBefore: dirtyAudit,
      maintenance,
      auditAfter: dirtyAudit,
    };

    const output = formatSelfHealingReport(report);

    expect(output).toContain("Self-healing scan: repair available");
    expect(output).toContain("Task codes: missing_cleanup:1");
    expect(output).toContain("TaskFlow codes: stale_running:1");
    expect(output).toContain("Next: /recover apply");
  });

  it("formats an apply pass with before and after health", () => {
    const output = formatSelfHealingReport({
      action: "apply",
      auditBefore: dirtyAudit,
      maintenance: { ...maintenance, apply: true },
      auditAfter: cleanAudit,
    });

    expect(output).toContain("Self-healing apply: clean after repair");
    expect(output).toContain("Before: 2 issues");
    expect(output).toContain("Next: keep working; no terminal repair needed.");
  });

  it("accepts canonical and friendly recovery actions", () => {
    expect(normalizeRecoveryAction("")).toBe("status");
    expect(normalizeRecoveryAction("scan")).toBe("status");
    expect(normalizeRecoveryAction("repair")).toBe("apply");
    expect(normalizeRecoveryAction("wat")).toBeNull();
  });
});
