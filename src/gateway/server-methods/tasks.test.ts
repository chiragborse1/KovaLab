import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import {
  createTaskRecord,
  resetTaskRegistryDeliveryRuntimeForTests,
  resetTaskRegistryForTests,
} from "../../tasks/task-registry.js";
import { withTempDir } from "../../test-helpers/temp-dir.js";
import { tasksHandlers } from "./tasks.js";
import type { GatewayRequestHandlers } from "./types.js";

const ORIGINAL_STATE_DIR = process.env.OPENCLAW_STATE_DIR;

type GatewayHandler = NonNullable<GatewayRequestHandlers[string]>;
type GatewayHandlerOptions = Parameters<GatewayHandler>[0];

async function withTaskState(run: () => Promise<void>): Promise<void> {
  await withTempDir({ prefix: "kova-gateway-tasks-" }, async (root) => {
    process.env.OPENCLAW_STATE_DIR = root;
    resetTaskRegistryDeliveryRuntimeForTests();
    resetTaskRegistryForTests({ persist: false });
    try {
      await run();
    } finally {
      resetTaskRegistryDeliveryRuntimeForTests();
      resetTaskRegistryForTests({ persist: false });
    }
  });
}

async function invokeTaskHandler(method: keyof typeof tasksHandlers, params: unknown) {
  const respond = vi.fn();
  const handler = tasksHandlers[method];
  if (!handler) {
    throw new Error(`Missing handler: ${String(method)}`);
  }
  await handler({
    req: { type: "req", id: "1", method: String(method) },
    params: (params ?? {}) as Record<string, unknown>,
    client: null,
    isWebchatConnect: () => false,
    respond: respond as GatewayHandlerOptions["respond"],
    context: {
      getRuntimeConfig: () => ({}) as OpenClawConfig,
    } as GatewayHandlerOptions["context"],
  });
  return respond;
}

describe("tasks gateway handlers", () => {
  afterEach(() => {
    if (ORIGINAL_STATE_DIR === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = ORIGINAL_STATE_DIR;
    }
    resetTaskRegistryDeliveryRuntimeForTests();
    resetTaskRegistryForTests({ persist: false });
  });

  it("lists durable task records through the gateway contract", async () => {
    await withTaskState(async () => {
      const task = createTaskRecord({
        runtime: "cron",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        sourceId: "job_daily",
        status: "running",
        task: "Daily briefing",
      });

      const respond = await invokeTaskHandler("tasks.list", {});

      expect(respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          count: 1,
          tasks: [
            expect.objectContaining({
              id: task.taskId,
              runtime: "cron",
              sourceId: "job_daily",
              title: "Daily briefing",
              status: "running",
            }),
          ],
          summary: expect.objectContaining({
            total: 1,
            active: 1,
          }),
        }),
        undefined,
      );
    });
  });

  it("shows a task by run id lookup", async () => {
    await withTaskState(async () => {
      const task = createTaskRecord({
        runtime: "cli",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        runId: "run_show_me",
        status: "succeeded",
        task: "Finished run",
      });

      const respond = await invokeTaskHandler("tasks.show", { lookup: "run_show_me" });

      expect(respond).toHaveBeenCalledWith(
        true,
        {
          task: expect.objectContaining({
            id: task.taskId,
            runId: "run_show_me",
            status: "succeeded",
          }),
        },
        undefined,
      );
    });
  });

  it("cancels active cli tasks", async () => {
    await withTaskState(async () => {
      const task = createTaskRecord({
        runtime: "cli",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        status: "running",
        task: "Long running task",
      });

      const respond = await invokeTaskHandler("tasks.cancel", { lookup: task.taskId });

      expect(respond).toHaveBeenCalledWith(
        true,
        {
          found: true,
          cancelled: true,
          task: expect.objectContaining({
            id: task.taskId,
            status: "cancelled",
          }),
        },
        undefined,
      );
    });
  });

  it("refuses to delete active tasks without force", async () => {
    await withTaskState(async () => {
      const task = createTaskRecord({
        runtime: "cli",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        status: "running",
        task: "Do not delete",
      });

      const respond = await invokeTaskHandler("tasks.delete", { taskId: task.taskId });

      expect(respond).toHaveBeenCalledWith(
        true,
        { deleted: false, reason: "Only terminal tasks can be deleted." },
        undefined,
      );
    });
  });

  it("updates task notification policy", async () => {
    await withTaskState(async () => {
      const task = createTaskRecord({
        runtime: "cli",
        ownerKey: "agent:main:main",
        scopeKind: "session",
        status: "running",
        task: "Notify me",
      });

      const respond = await invokeTaskHandler("tasks.notify", {
        lookup: task.taskId,
        notifyPolicy: "state_changes",
      });

      expect(respond).toHaveBeenCalledWith(
        true,
        {
          updated: true,
          task: expect.objectContaining({
            id: task.taskId,
            notifyPolicy: "state_changes",
          }),
        },
        undefined,
      );
    });
  });
});
