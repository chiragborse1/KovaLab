import { html, nothing } from "lit";
import type { Task, TaskActionHandlers, TaskDetailTab } from "./types.ts";
import {
  formatCurrency,
  formatDuration,
  sourceClass,
  statusClass,
  TASK_STATUS_LABELS,
} from "./utils.ts";

function meta(label: string, value: unknown) {
  return html`
    <div class="task-detail-meta">
      <span>${label}</span>
      <strong>${value || "—"}</strong>
    </div>
  `;
}

export function renderTaskDetailPanel(params: {
  task: Task;
  tab: TaskDetailTab;
  editingTitle: boolean;
  titleDraft: string;
  handlers: TaskActionHandlers;
  onClose: () => void;
  onTab: (tab: TaskDetailTab) => void;
  onEditTitle: () => void;
  onTitleInput: (value: string) => void;
  onTitleCommit: () => void;
  onCopyOutput: () => void;
}) {
  const task = params.task;
  return html`
    <div class="tasks-drawer-backdrop" @click=${params.onClose}>
      <aside
        class="tasks-drawer tasks-drawer--detail"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <div class="tasks-drawer__header">
          <div class="task-detail-title-wrap">
            ${params.editingTitle
              ? html`
                  <input
                    class="tasks-input task-detail-title-input"
                    .value=${params.titleDraft}
                    @input=${(event: InputEvent) =>
                      params.onTitleInput((event.currentTarget as HTMLInputElement).value)}
                    @keydown=${(event: KeyboardEvent) => {
                      if (event.key === "Enter") params.onTitleCommit();
                    }}
                    @blur=${params.onTitleCommit}
                  />
                `
              : html`
                  <button class="task-detail-title" @click=${params.onEditTitle}>
                    ${task.title}
                  </button>
                `}
            <span class=${`task-status-badge ${statusClass(task.status)}`}>
              ${TASK_STATUS_LABELS[task.status]}
            </span>
          </div>
          <button class="tasks-icon-btn" @click=${params.onClose} aria-label="Close">×</button>
        </div>

        <div class="task-detail-tabs">
          ${(["overview", "output", "timeline"] as const).map(
            (tab) => html`
              <button
                class=${`task-detail-tab ${params.tab === tab ? "is-active" : ""}`}
                @click=${() => params.onTab(tab)}
              >
                ${tab[0].toUpperCase()}${tab.slice(1)}
              </button>
            `,
          )}
        </div>

        <div class="task-detail-body">
          ${params.tab === "overview"
            ? html`
                <div class="task-detail-grid">
                  ${meta("Agent", task.agent)} ${meta("Model", task.model)}
                  ${meta(
                    "Source",
                    html`<span class=${`task-source-badge ${sourceClass(task.source)}`}
                      >${task.source}</span
                    >`,
                  )}
                  ${meta("Status", TASK_STATUS_LABELS[task.status])}
                  ${meta("Created", task.createdAt)} ${meta("Started", task.startedAt)}
                  ${meta("Completed / Failed", task.completedAt)}
                  ${meta("Duration", formatDuration(task.duration))}
                  ${meta("Total Cost", formatCurrency(task.cost))}
                  ${meta("Tokens used", task.tokensUsed?.toLocaleString())}
                </div>
                ${task.status === "failed"
                  ? html`
                      <div class="task-callout task-callout--danger">
                        <strong>${task.error ?? "Task failed"}</strong>
                        <button
                          class="btn btn--sm"
                          @click=${() => params.handlers.onRetry(task.id)}
                        >
                          Retry
                        </button>
                      </div>
                    `
                  : nothing}
                ${task.status === "needs_approval"
                  ? html`
                      <div class="task-callout task-callout--approval">
                        <strong>${task.approvalRequest ?? "Approval required"}</strong>
                        <div class="row">
                          <button
                            class="btn btn--sm task-approve-btn"
                            @click=${() => params.handlers.onApprove(task.id)}
                          >
                            Approve
                          </button>
                          <button
                            class="btn btn--sm task-reject-btn"
                            @click=${() => params.handlers.onReject(task.id)}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    `
                  : nothing}
                ${task.status === "running"
                  ? html`
                      <div class="task-live-strip">
                        <span>${formatDuration(task.duration)} elapsed</span>
                        <span>${(task.tokensUsed ?? 0).toLocaleString()} tokens</span>
                      </div>
                    `
                  : nothing}
              `
            : nothing}
          ${params.tab === "output"
            ? html`
                <div class="task-output-head">
                  <span>Agent output stream</span>
                  <button class="btn btn--sm" @click=${params.onCopyOutput}>Copy</button>
                </div>
                <pre class="task-output-log">${task.output ?? "No output captured yet."}</pre>
              `
            : nothing}
          ${params.tab === "timeline"
            ? html`
                <div class="task-timeline">
                  ${(task.timeline ?? []).map(
                    (event) => html`
                      <div class="task-timeline__event">
                        <span class="task-timeline__dot"></span>
                        <div>
                          <strong
                            >${event.type === "tool_call"
                              ? `🔧 ${event.label}`
                              : event.label}</strong
                          >
                          <span>${event.timestamp}</span>
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>
      </aside>
    </div>
  `;
}
