import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import { createRunningTaskRun } from "../tasks/task-executor.js";
import {
  createManagedTaskFlow,
  resetTaskFlowRegistryForTests,
} from "../tasks/task-flow-registry.js";
import {
  resetTaskRegistryDeliveryRuntimeForTests,
  resetTaskRegistryForTests,
} from "../tasks/task-registry.js";
import { withTempDir } from "../test-helpers/temp-dir.js";
import {
  goalsAddCommand,
  goalsCancelCommand,
  goalsDoneCommand,
  goalsFailCommand,
  goalsListCommand,
  goalsSetCommand,
  goalsShowCommand,
} from "./goals.js";

vi.mock("../config/config.js", () => ({
  getRuntimeConfig: vi.fn(() => ({
    session: {
      mainKey: "main",
    },
    agents: {
      list: [{ id: "main", default: true }],
    },
  })),
  loadConfig: vi.fn(() => ({})),
}));

const ORIGINAL_STATE_DIR = process.env.KOVA_STATE_DIR;

function createRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  } as unknown as RuntimeEnv;
}

async function withGoalCommandStateDir(run: (root: string) => Promise<void>): Promise<void> {
  await withTempDir({ prefix: "kova-goals-command-" }, async (root) => {
    process.env.KOVA_STATE_DIR = root;
    resetTaskRegistryDeliveryRuntimeForTests();
    resetTaskRegistryForTests({ persist: false });
    resetTaskFlowRegistryForTests({ persist: false });
    try {
      await run(root);
    } finally {
      resetTaskRegistryDeliveryRuntimeForTests();
      resetTaskRegistryForTests({ persist: false });
      resetTaskFlowRegistryForTests({ persist: false });
    }
  });
}

function parseFirstLog(runtime: RuntimeEnv): unknown {
  return JSON.parse(String(vi.mocked(runtime.log).mock.calls[0]?.[0]));
}

describe("goals commands", () => {
  afterEach(() => {
    if (ORIGINAL_STATE_DIR === undefined) {
      delete process.env.KOVA_STATE_DIR;
    } else {
      process.env.KOVA_STATE_DIR = ORIGINAL_STATE_DIR;
    }
    resetTaskRegistryDeliveryRuntimeForTests();
    resetTaskRegistryForTests({ persist: false });
    resetTaskFlowRegistryForTests({ persist: false });
  });

  it("creates a durable managed goal for the default main session", async () => {
    await withGoalCommandStateDir(async () => {
      const runtime = createRuntime();
      await goalsAddCommand(
        {
          goal: "Ship the fast terminal loop",
          step: "plan",
          json: true,
        },
        runtime,
      );

      const payload = parseFirstLog(runtime) as {
        controllerId: string;
        ownerKey: string;
        goal: string;
        currentStep: string;
        status: string;
      };
      expect(payload).toMatchObject({
        controllerId: "cli/goals",
        ownerKey: "agent:main:main",
        goal: "Ship the fast terminal loop",
        currentStep: "plan",
        status: "queued",
      });
    });
  });

  it("lists only active CLI goals by default", async () => {
    await withGoalCommandStateDir(async () => {
      const active = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "cli/goals",
        goal: "Active goal",
        status: "running",
        createdAt: 100,
        updatedAt: 100,
      });
      createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "cli/goals",
        goal: "Finished goal",
        status: "succeeded",
        createdAt: 100,
        updatedAt: 100,
        endedAt: 100,
      });
      createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "tests/other",
        goal: "Other managed flow",
        status: "running",
        createdAt: 100,
        updatedAt: 100,
      });

      const runtime = createRuntime();
      await goalsListCommand({ json: true }, runtime);

      const payload = parseFirstLog(runtime) as {
        count: number;
        goals: Array<{ flowId: string; goal: string }>;
      };
      expect(payload.count).toBe(1);
      expect(payload.goals).toEqual([
        expect.objectContaining({
          flowId: active.flowId,
          goal: "Active goal",
        }),
      ]);
    });
  });

  it("shows one goal with linked task details", async () => {
    await withGoalCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "cli/goals",
        goal: "Use subagents safely",
        status: "blocked",
        currentStep: "wait_for_child",
        createdAt: 100,
        updatedAt: 100,
      });
      createRunningTaskRun({
        runtime: "subagent",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        parentFlowId: flow.flowId,
        childSessionKey: "agent:main:child",
        runId: "run-child",
        label: "Collect evidence",
        task: "Collect evidence",
        startedAt: 100,
        lastEventAt: 100,
      });

      const runtime = createRuntime();
      await goalsShowCommand({ lookup: flow.flowId, json: false }, runtime);

      const output = vi
        .mocked(runtime.log)
        .mock.calls.map(([line]) => String(line))
        .join("\n");
      expect(output).toContain("Goal:");
      expect(output).toContain(`flowId: ${flow.flowId}`);
      expect(output).toContain("status: blocked");
      expect(output).toContain("goal: Use subagents safely");
      expect(output).toContain("currentStep: wait_for_child");
      expect(output).toContain("Linked tasks:");
      expect(output).toContain("run-child");
      expect(output).toContain("Collect evidence");
    });
  });

  it("updates active goal status and step without ending the goal", async () => {
    await withGoalCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "cli/goals",
        goal: "Improve memory UX",
        status: "queued",
        createdAt: 100,
        updatedAt: 100,
      });

      const runtime = createRuntime();
      await goalsSetCommand(
        {
          lookup: flow.flowId,
          status: "running",
          step: "curate",
          json: true,
        },
        runtime,
      );

      const payload = parseFirstLog(runtime) as {
        status: string;
        currentStep: string;
        endedAt?: number;
      };
      expect(payload.status).toBe("running");
      expect(payload.currentStep).toBe("curate");
      expect(payload.endedAt).toBeUndefined();
    });
  });

  it("finishes, fails, and cancels goals through explicit commands", async () => {
    await withGoalCommandStateDir(async () => {
      const done = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "cli/goals",
        goal: "Done",
        status: "running",
      });
      const failed = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "cli/goals",
        goal: "Failed",
        status: "running",
      });
      const cancelled = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "cli/goals",
        goal: "Cancelled",
        status: "running",
      });

      const doneRuntime = createRuntime();
      await goalsDoneCommand({ lookup: done.flowId, json: true }, doneRuntime);
      expect((parseFirstLog(doneRuntime) as { status: string }).status).toBe("succeeded");

      const failedRuntime = createRuntime();
      await goalsFailCommand(
        {
          lookup: failed.flowId,
          reason: "Judge rejected final answer",
          json: true,
        },
        failedRuntime,
      );
      expect(parseFirstLog(failedRuntime)).toMatchObject({
        status: "failed",
        blockedSummary: "Judge rejected final answer",
      });

      const cancelRuntime = createRuntime();
      await goalsCancelCommand({ lookup: cancelled.flowId, json: true }, cancelRuntime);
      expect(parseFirstLog(cancelRuntime)).toMatchObject({
        cancelled: true,
        goal: {
          status: "cancelled",
        },
      });
    });
  });

  it("rejects terminal status through set so destructive states stay explicit", async () => {
    await withGoalCommandStateDir(async () => {
      const flow = createManagedTaskFlow({
        ownerKey: "agent:main:main",
        controllerId: "cli/goals",
        goal: "Do not end implicitly",
        status: "running",
      });

      const runtime = createRuntime();
      await goalsSetCommand({ lookup: flow.flowId, status: "succeeded" }, runtime);

      expect(vi.mocked(runtime.error).mock.calls[0]?.[0]).toContain(
        'Use "goals done", "goals fail", or "goals cancel"',
      );
      expect(runtime.exit).toHaveBeenCalledWith(1);
    });
  });
});
