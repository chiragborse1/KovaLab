import { html, nothing } from "lit";
import type { Task, TaskActionHandlers } from "./types.ts";
import { formatCurrency, sourceClass, statusClass, taskTimeLabel } from "./utils.ts";

export function renderTaskCard(task: Task, handlers: TaskActionHandlers) {
  const stop = (event: Event) => event.stopPropagation();
  return html`
    <article class=${`task-card ${statusClass(task.status)}`} @click=${() => handlers.onOpen(task)}>
      <div class="task-card__top">
        <div class="task-card__title" title=${task.title}>${task.title}</div>
        <span class=${`task-source-badge ${sourceClass(task.source)}`}>${task.source}</span>
      </div>
      <div class="task-card__meta">${task.agent}</div>
      <div class="task-card__chips">
        <span class="task-model-pill">${task.model}</span>
        <span class="task-time">${taskTimeLabel(task)}</span>
      </div>
      ${task.status === "queued"
        ? nothing
        : html`<span class="task-cost-chip">${formatCurrency(task.cost)}</span>`}
      ${task.status === "failed"
        ? html`
            <div class="task-card__footer" @click=${stop}>
              <button class="btn btn--sm task-retry-btn" @click=${() => handlers.onRetry(task.id)}>
                Retry
              </button>
            </div>
          `
        : nothing}
      ${task.status === "needs_approval"
        ? html`
            <div class="task-card__footer" @click=${stop}>
              <button
                class="btn btn--sm task-approve-btn"
                @click=${() => handlers.onApprove(task.id)}
              >
                ✓ Approve
              </button>
              <button
                class="btn btn--sm task-reject-btn"
                @click=${() => handlers.onReject(task.id)}
              >
                ✗ Reject
              </button>
            </div>
          `
        : nothing}
      ${task.status === "running" ? html`<div class="task-progress-bar"></div>` : nothing}
    </article>
  `;
}
