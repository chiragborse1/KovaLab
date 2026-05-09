import {
  deleteTaskRecordById,
  getTaskRegistrySummary,
  listTaskRecords,
  resolveTaskForLookupToken,
  updateTaskNotifyPolicyById,
} from "../../tasks/runtime-internal.js";
import {
  mapTaskRunAggregateSummary,
  mapTaskRunDetail,
  mapTaskRunView,
} from "../../tasks/task-domain-views.js";
import { isTerminalTaskStatus } from "../../tasks/task-executor-policy.js";
import { cancelDetachedTaskRunById } from "../../tasks/task-executor.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateTasksCancelParams,
  validateTasksDeleteParams,
  validateTasksListParams,
  validateTasksNotifyParams,
  validateTasksShowParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const tasksHandlers: GatewayRequestHandlers = {
  "tasks.list": ({ params, respond }) => {
    if (!validateTasksListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid tasks.list params: ${formatValidationErrors(validateTasksListParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      status?: string;
      runtime?: string;
      limit?: number;
    };
    const status = p.status && p.status !== "all" ? p.status : undefined;
    const runtime = p.runtime && p.runtime !== "all" ? p.runtime : undefined;
    const limit = p.limit ?? 200;
    const tasks = listTaskRecords()
      .filter((task) => (status ? task.status === status : true))
      .filter((task) => (runtime ? task.runtime === runtime : true))
      .slice(0, limit)
      .map((task) => mapTaskRunView(task));
    respond(
      true,
      {
        tasks,
        summary: mapTaskRunAggregateSummary(getTaskRegistrySummary()),
        count: tasks.length,
      },
      undefined,
    );
  },

  "tasks.show": ({ params, respond }) => {
    if (!validateTasksShowParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid tasks.show params: ${formatValidationErrors(validateTasksShowParams.errors)}`,
        ),
      );
      return;
    }
    const task = resolveTaskForLookupToken((params as { lookup: string }).lookup);
    if (!task) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Task not found."));
      return;
    }
    respond(true, { task: mapTaskRunDetail(task) }, undefined);
  },

  "tasks.cancel": async ({ params, respond, context }) => {
    if (!validateTasksCancelParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid tasks.cancel params: ${formatValidationErrors(validateTasksCancelParams.errors)}`,
        ),
      );
      return;
    }
    const task = resolveTaskForLookupToken((params as { lookup: string }).lookup);
    if (!task) {
      respond(true, { found: false, cancelled: false, reason: "Task not found." }, undefined);
      return;
    }
    const result = await cancelDetachedTaskRunById({
      cfg: context.getRuntimeConfig(),
      taskId: task.taskId,
    });
    respond(
      true,
      {
        found: result.found,
        cancelled: result.cancelled,
        ...(result.reason ? { reason: result.reason } : {}),
        ...(result.task ? { task: mapTaskRunDetail(result.task) } : {}),
      },
      undefined,
    );
  },

  "tasks.delete": ({ params, respond }) => {
    if (!validateTasksDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid tasks.delete params: ${formatValidationErrors(validateTasksDeleteParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as { taskId: string; force?: boolean };
    const task = resolveTaskForLookupToken(p.taskId);
    if (!task) {
      respond(true, { deleted: false, reason: "Task not found." }, undefined);
      return;
    }
    if (!p.force && !isTerminalTaskStatus(task.status)) {
      respond(true, { deleted: false, reason: "Only terminal tasks can be deleted." }, undefined);
      return;
    }
    respond(true, { deleted: deleteTaskRecordById(task.taskId) }, undefined);
  },

  "tasks.notify": ({ params, respond }) => {
    if (!validateTasksNotifyParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid tasks.notify params: ${formatValidationErrors(validateTasksNotifyParams.errors)}`,
        ),
      );
      return;
    }
    const p = params as {
      lookup: string;
      notifyPolicy: "done_only" | "state_changes" | "silent";
    };
    const task = resolveTaskForLookupToken(p.lookup);
    if (!task) {
      respond(true, { updated: false, reason: "Task not found." }, undefined);
      return;
    }
    const updated = updateTaskNotifyPolicyById({
      taskId: task.taskId,
      notifyPolicy: p.notifyPolicy,
    });
    respond(
      true,
      {
        updated: Boolean(updated),
        ...(updated ? { task: mapTaskRunDetail(updated) } : { reason: "Task not found." }),
      },
      undefined,
    );
  },
};
