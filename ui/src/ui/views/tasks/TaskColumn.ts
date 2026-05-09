import { html } from "lit";
import { renderTaskCard } from "./TaskCard.ts";
import type { Task, TaskActionHandlers, TaskStatus } from "./types.ts";
import { TASK_STATUS_ICONS, TASK_STATUS_LABELS, statusClass } from "./utils.ts";

export function renderTaskColumn(params: {
  status: TaskStatus;
  tasks: Task[];
  handlers: TaskActionHandlers;
  onAddTask: (status: TaskStatus) => void;
}) {
  return html`
    <section class=${`task-column ${statusClass(params.status)}`}>
      <div class="task-column__header">
        <span class="task-column__icon">${TASK_STATUS_ICONS[params.status]}</span>
        <span>${TASK_STATUS_LABELS[params.status]}</span>
        <span class="task-column__count">${params.tasks.length}</span>
      </div>
      <div class="task-column__list">
        ${params.tasks.map((task) => renderTaskCard(task, params.handlers))}
      </div>
      <button class="task-column__add" @click=${() => params.onAddTask(params.status)}>
        + Add task
      </button>
    </section>
  `;
}
