import { html } from "lit";
import { renderTaskColumn } from "./TaskColumn.ts";
import type { Task, TaskActionHandlers, TaskStatus } from "./types.ts";
import { TASK_STATUS_ORDER } from "./utils.ts";

export function renderTaskBoard(params: {
  tasks: Task[];
  handlers: TaskActionHandlers;
  onAddTask: (status: TaskStatus) => void;
}) {
  const byStatus = new Map<TaskStatus, Task[]>();
  for (const status of TASK_STATUS_ORDER) {
    byStatus.set(status, []);
  }
  for (const task of params.tasks) {
    byStatus.get(task.status)?.push(task);
  }
  return html`
    <div class="task-board">
      ${TASK_STATUS_ORDER.map((status) =>
        renderTaskColumn({
          status,
          tasks: byStatus.get(status) ?? [],
          handlers: params.handlers,
          onAddTask: params.onAddTask,
        }),
      )}
    </div>
  `;
}
