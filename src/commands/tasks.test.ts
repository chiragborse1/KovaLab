import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import {
  createManagedTaskFlow,
  resetTaskFlowRegistryForTests,
} from "../tasks/task-flow-registry.js";
import {
  createTaskRecord,
  markTaskTerminalById,
  resetTaskRegistryDeliveryRuntimeForTests,
  resetTaskRegistryForTests,
} from "../tasks/task-registry.js";
import { withTempDir } from "../test-helpers/temp-dir.js";
import { tasksAuditCommand, tasksMaintenanceCommand, tasksReportCommand } from "./tasks.js";

const ORIGINAL_STATE_DIR = process.env.KOVA_STATE_DIR;

function createRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  } as unknown as RuntimeEnv;
}

async function withTaskCommandStateDir(run: () => Promise<void>): Promise<void> {
  await withTempDir({ prefix: "kova-tasks-command-" }, async (root) => {
    process.env.KOVA_STATE_DIR = root;
    resetTaskRegistryDeliveryRuntimeForTests();
    resetTaskRegistryForTests({ persist: false });
    resetTaskFlowRegistryForTests({ persist: false });
    try {
      await run();
    } finally {
      resetTaskRegistryDeliveryRuntimeForTests();
      resetTaskRegistryForTests({ persist: false });
      resetTaskFlowRegistryForTests({ persist: false });
    }
  });
}

describe("tasks commands", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (ORIGINAL_STATE_DIR === undefined) {
      delete process.env.KOVA_STATE_DIR;
    } else {
      process.env.KOVA_STATE_DIR = ORIGINAL_STATE_DIR;
    }
    resetTaskRegistryDeliveryRuntimeForTests();
    resetTaskRegistryForTests({ persist: false });
    resetTaskFlowRegistryForTests({ persist: false });
  });

  it("keeps audit JSON stable and sorts combined findings before limiting", async () => {
    await withTaskCommandStateDir(async () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now - 40 * 60_000);
      createTaskRecord({
        runtime: "cli",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        runId: "task-stale-queued",
        status: "running",
        task: "Inspect issue backlog",
      });
      vi.setSystemTime(now);
      createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/tasks-command",
        goal: "Inspect issue backlog",
        status: "waiting",
        createdAt: now - 40 * 60_000,
        updatedAt: now - 40 * 60_000,
      });

      const runtime = createRuntime();
      await tasksAuditCommand({ json: true }, runtime);

      const payload = JSON.parse(String(vi.mocked(runtime.log).mock.calls[0]?.[0])) as {
        summary: {
          total: number;
          errors: number;
          warnings: number;
          byCode: Record<string, number>;
          taskFlows: { total: number; byCode: Record<string, number> };
          combined: { total: number; errors: number; warnings: number };
        };
      };

      expect(payload.summary.byCode.stale_running).toBe(1);
      expect(payload.summary.taskFlows.byCode.stale_waiting).toBe(1);
      expect(payload.summary.taskFlows.byCode.missing_linked_tasks).toBe(1);
      expect(payload.summary.combined.total).toBe(3);

      const runningFlow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/tasks-command",
        goal: "Running flow",
        status: "running",
        createdAt: now - 45 * 60_000,
        updatedAt: now - 45 * 60_000,
      });

      const limitedRuntime = createRuntime();
      await tasksAuditCommand({ json: true, limit: 1 }, limitedRuntime);

      const limitedPayload = JSON.parse(
        String(vi.mocked(limitedRuntime.log).mock.calls[0]?.[0]),
      ) as {
        findings: Array<{ kind: string; code: string; token?: string }>;
      };

      expect(limitedPayload.findings).toHaveLength(1);
      expect(limitedPayload.findings[0]).toMatchObject({
        kind: "task_flow",
        code: "stale_running",
        token: runningFlow.flowId,
      });
    });
  });

  it("keeps tasks maintenance JSON additive for TaskFlow state", async () => {
    await withTaskCommandStateDir(async () => {
      const now = Date.now();
      createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/tasks-command",
        goal: "Old terminal flow",
        status: "succeeded",
        createdAt: now - 8 * 24 * 60 * 60_000,
        updatedAt: now - 8 * 24 * 60 * 60_000,
        endedAt: now - 8 * 24 * 60 * 60_000,
      });

      const runtime = createRuntime();
      await tasksMaintenanceCommand({ json: true, apply: false }, runtime);

      const payload = JSON.parse(String(vi.mocked(runtime.log).mock.calls[0]?.[0])) as {
        mode: string;
        maintenance: { taskFlows: { pruned: number } };
        auditBefore: {
          byCode: Record<string, number>;
          taskFlows: { byCode: Record<string, number> };
        };
        auditAfter: {
          byCode: Record<string, number>;
          taskFlows: { byCode: Record<string, number> };
        };
      };

      expect(payload.mode).toBe("preview");
      expect(payload.maintenance.taskFlows.pruned).toBe(1);
      expect(payload.auditBefore.byCode).toBeDefined();
      expect(payload.auditBefore.taskFlows.byCode.stale_running).toBe(0);
      expect(payload.auditAfter.byCode).toBeDefined();
      expect(payload.auditAfter.taskFlows.byCode.stale_running).toBe(0);
    });
  });

  it("builds a JSON automation report from task and TaskFlow state", async () => {
    await withTaskCommandStateDir(async () => {
      const now = Date.now();
      const failed = createTaskRecord({
        runtime: "cron",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        runId: "cron-run-1",
        status: "running",
        startedAt: now - 65_000,
        task: "Daily automation report",
      });
      markTaskTerminalById({
        taskId: failed.taskId,
        status: "failed",
        endedAt: now,
        error: "delivery failed",
        terminalSummary: "Could not deliver report",
      });
      createTaskRecord({
        runtime: "cli",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        runId: "cli-run-1",
        status: "running",
        task: "Inspect issue backlog",
      });
      createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/tasks-command",
        goal: "Run weekly automation",
        status: "waiting",
      });

      const runtime = createRuntime();
      await tasksReportCommand({ json: true, limit: 5 }, runtime);

      const payload = JSON.parse(String(vi.mocked(runtime.log).mock.calls[0]?.[0])) as {
        tasks: {
          total: number;
          active: number;
          failures: number;
          byRuntime: Record<string, number>;
          byStatus: Record<string, number>;
          completedDurationMs: { count: number; maxMs: number | null };
        };
        taskFlows: { total: number; active: number; byStatus: Record<string, number> };
        audit: { total: number };
        recentIssues: Array<{ taskId: string; runId?: string; status: string }>;
      };

      expect(payload.tasks.total).toBe(2);
      expect(payload.tasks.active).toBe(1);
      expect(payload.tasks.failures).toBe(1);
      expect(payload.tasks.byRuntime.cron).toBe(1);
      expect(payload.tasks.byStatus.failed).toBe(1);
      expect(payload.tasks.completedDurationMs).toMatchObject({
        count: 1,
        maxMs: 65_000,
      });
      expect(payload.taskFlows.total).toBe(1);
      expect(payload.taskFlows.active).toBe(1);
      expect(payload.taskFlows.byStatus.waiting).toBe(1);
      expect(payload.audit.total).toBeGreaterThanOrEqual(0);
      expect(payload.recentIssues).toEqual([
        expect.objectContaining({
          taskId: failed.taskId,
          runId: "cron-run-1",
          status: "failed",
        }),
      ]);
    });
  });

  it("prints an automation report with active and issue sections", async () => {
    await withTaskCommandStateDir(async () => {
      const failed = createTaskRecord({
        runtime: "cron",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        runId: "cron-run-1",
        status: "failed",
        task: "Daily automation report",
        terminalSummary: "Could not deliver report",
      });
      markTaskTerminalById({
        taskId: failed.taskId,
        status: "failed",
        endedAt: Date.now(),
        terminalSummary: "Could not deliver report",
      });
      createTaskRecord({
        runtime: "cron",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        runId: "cron-run-2",
        status: "running",
        task: "Weekly automation report",
      });

      const runtime = createRuntime();
      await tasksReportCommand({ runtime: "cron" }, runtime);

      const output = vi
        .mocked(runtime.log)
        .mock.calls.map((call) => String(call[0]))
        .join("\n");
      expect(output).toContain("Background automation report");
      expect(output).toContain("Active tasks (1)");
      expect(output).toContain("Recent task issues (1)");
      expect(output).toContain("cron-run-1");
    });
  });
});
