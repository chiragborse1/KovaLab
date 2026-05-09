import { html } from "lit";
import type { Task, TaskActionHandlers } from "./types.ts";
import {
  formatCurrency,
  formatDuration,
  sortValue,
  sourceClass,
  statusClass,
  TASK_STATUS_LABELS,
} from "./utils.ts";

export type TaskSortKey =
  | "status"
  | "title"
  | "source"
  | "agent"
  | "model"
  | "duration"
  | "cost"
  | "created";

export interface TaskSortState {
  key: TaskSortKey;
  direction: "asc" | "desc";
}

function nextSort(current: TaskSortState, key: TaskSortKey): TaskSortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}

function renderHeader(
  label: string,
  key: TaskSortKey,
  sort: TaskSortState,
  onSort: (sort: TaskSortState) => void,
) {
  return html`
    <button class="task-table__sort" @click=${() => onSort(nextSort(sort, key))}>
      ${label} ${sort.key === key ? html`<span>${sort.direction === "asc" ? "↑" : "↓"}</span>` : ""}
    </button>
  `;
}

export function renderTaskListView(params: {
  tasks: Task[];
  handlers: TaskActionHandlers;
  sort: TaskSortState;
  onSort: (sort: TaskSortState) => void;
}) {
  const sorted = [...params.tasks].sort((a, b) => {
    const av = sortValue(a, params.sort.key);
    const bv = sortValue(b, params.sort.key);
    const result =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return params.sort.direction === "asc" ? result : -result;
  });
  const stop = (event: Event) => event.stopPropagation();
  return html`
    <div class="task-table-wrap">
      <table class="task-table">
        <thead>
          <tr>
            <th>${renderHeader("Status", "status", params.sort, params.onSort)}</th>
            <th>${renderHeader("Title", "title", params.sort, params.onSort)}</th>
            <th>${renderHeader("Source", "source", params.sort, params.onSort)}</th>
            <th>${renderHeader("Agent", "agent", params.sort, params.onSort)}</th>
            <th>${renderHeader("Model", "model", params.sort, params.onSort)}</th>
            <th>${renderHeader("Duration", "duration", params.sort, params.onSort)}</th>
            <th>${renderHeader("Cost", "cost", params.sort, params.onSort)}</th>
            <th>${renderHeader("Created / Scheduled", "created", params.sort, params.onSort)}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(
            (task) => html`
              <tr @click=${() => params.handlers.onOpen(task)}>
                <td>
                  <span class=${`task-status-dot ${statusClass(task.status)}`}></span>
                  <span class="task-table__status">${TASK_STATUS_LABELS[task.status]}</span>
                </td>
                <td class="task-table__title">${task.title}</td>
                <td>
                  <span class=${`task-source-badge ${sourceClass(task.source)}`}
                    >${task.source}</span
                  >
                </td>
                <td>${task.agent}</td>
                <td><span class="task-model-pill">${task.model}</span></td>
                <td>${formatDuration(task.duration)}</td>
                <td>${formatCurrency(task.cost)}</td>
                <td>${task.scheduledFor ?? task.createdAt}</td>
                <td>
                  <details class="task-actions-menu" @click=${stop}>
                    <summary aria-label="Task actions">⋯</summary>
                    <div class="task-actions-menu__content">
                      <button class="btn btn--sm" @click=${() => params.handlers.onOpen(task)}>
                        View
                      </button>
                      <button class="btn btn--sm" @click=${() => params.handlers.onRetry(task.id)}>
                        Retry
                      </button>
                      <button class="btn btn--sm" @click=${() => params.handlers.onCancel(task.id)}>
                        Cancel
                      </button>
                      <button
                        class="btn btn--sm danger"
                        @click=${() => params.handlers.onDelete(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </details>
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}
