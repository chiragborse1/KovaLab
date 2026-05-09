import { html, nothing } from "lit";
import type { AgentsListResult, ModelCatalogEntry, SessionsListResult } from "../../types.ts";
import { renderCronBuilder } from "./CronBuilder.ts";
import type { CronDraft, NewTaskDraft, TaskRunMode } from "./types.ts";

function agentOptions(
  agents: AgentsListResult | null,
): Array<{ id: string; label: string; model: string }> {
  if (!agents?.agents.length) {
    return [{ id: "main", label: "main", model: "openrouter/auto" }];
  }
  return agents.agents.map((agent) => ({
    id: agent.id,
    label: agent.name ?? agent.identity?.name ?? agent.id,
    model: agent.model?.primary ?? "agent default",
  }));
}

function modelOptions(models: ModelCatalogEntry[]): string[] {
  const values = models.map((model) => model.id).filter(Boolean);
  return values.length > 0 ? values : ["gpt-5.5", "openrouter/auto"];
}

export function renderNewTaskDrawer(params: {
  draft: NewTaskDraft;
  agentsList: AgentsListResult | null;
  sessionsResult: SessionsListResult | null;
  modelCatalog: ModelCatalogEntry[];
  onClose: () => void;
  onSave: () => void;
  onDraft: (patch: Partial<NewTaskDraft>) => void;
  onCron: (cron: CronDraft) => void;
  onAddUrl: () => void;
  onRemoveUrl: (url: string) => void;
}) {
  const draft = params.draft;
  const agents = agentOptions(params.agentsList);
  const models = modelOptions(params.modelCatalog);
  const set = params.onDraft;
  const inputValue = (event: InputEvent) => (event.currentTarget as HTMLInputElement).value;
  const textValue = (event: InputEvent) => (event.currentTarget as HTMLTextAreaElement).value;
  const selectValue = (event: Event) => (event.currentTarget as HTMLSelectElement).value;
  return html`
    <div class="tasks-drawer-backdrop" @click=${params.onClose}>
      <aside
        class="tasks-drawer tasks-drawer--new"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <div class="tasks-drawer__header">
          <h2>New Task</h2>
          <button class="tasks-icon-btn" @click=${params.onClose} aria-label="Close">×</button>
        </div>
        <div class="tasks-drawer__body">
          <label class="tasks-field">
            <span>Title</span>
            <input
              class="tasks-input"
              required
              placeholder="What should Kova do?"
              .value=${draft.title}
              @input=${(event: InputEvent) => set({ title: inputValue(event) })}
            />
          </label>

          <label class="tasks-field">
            <span>Assign to Agent</span>
            <select
              class="tasks-input"
              .value=${draft.agent}
              @change=${(event: Event) => set({ agent: selectValue(event) })}
            >
              ${agents.map(
                (agent) => html`<option value=${agent.id}>${agent.label} · ${agent.model}</option>`,
              )}
            </select>
          </label>

          <div class="tasks-field">
            <span>Run</span>
            <div class="tasks-segmented">
              ${(["now", "scheduled", "recurring"] as TaskRunMode[]).map(
                (mode) => html`
                  <button
                    class=${`tasks-segment ${draft.runMode === mode ? "is-active" : ""}`}
                    type="button"
                    @click=${() => set({ runMode: mode })}
                  >
                    ${mode === "now" ? "Now" : mode === "scheduled" ? "Scheduled" : "Recurring"}
                  </button>
                `,
              )}
            </div>
          </div>

          ${draft.runMode === "scheduled"
            ? html`
                <label class="tasks-field">
                  <span>Date and time</span>
                  <input
                    class="tasks-input"
                    type="datetime-local"
                    .value=${draft.scheduledFor}
                    @input=${(event: InputEvent) => set({ scheduledFor: inputValue(event) })}
                  />
                </label>
              `
            : nothing}
          ${draft.runMode === "recurring"
            ? renderCronBuilder({ cron: draft.cron, onChange: params.onCron })
            : nothing}

          <details class="tasks-details">
            <summary>Attach context</summary>
            <label class="tasks-field">
              <span>Paste URLs</span>
              <div class="tasks-url-row">
                <input
                  class="tasks-input"
                  placeholder="https://..."
                  .value=${draft.urlDraft}
                  @input=${(event: InputEvent) => set({ urlDraft: inputValue(event) })}
                  @keydown=${(event: KeyboardEvent) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      params.onAddUrl();
                    }
                  }}
                />
                <button class="btn btn--sm" @click=${params.onAddUrl} type="button">Add</button>
              </div>
              <div class="tasks-chip-row">
                ${draft.urls.map(
                  (url) => html`
                    <button
                      class="tasks-url-chip"
                      @click=${() => params.onRemoveUrl(url)}
                      type="button"
                    >
                      ${url} ×
                    </button>
                  `,
                )}
              </div>
            </label>
            <label class="tasks-field">
              <span>Reference a session</span>
              <select
                class="tasks-input"
                .value=${draft.sessionRef}
                @change=${(event: Event) => set({ sessionRef: selectValue(event) })}
              >
                <option value="">No session</option>
                ${(params.sessionsResult?.sessions ?? [])
                  .slice(0, 20)
                  .map((session) => html`<option value=${session.key}>${session.key}</option>`)}
              </select>
            </label>
            <label class="tasks-field">
              <span>Notes / instructions</span>
              <textarea
                class="tasks-input tasks-textarea"
                placeholder="Any additional context or instructions for the agent"
                .value=${draft.notes}
                @input=${(event: InputEvent) => set({ notes: textValue(event) })}
              ></textarea>
            </label>
          </details>

          <details class="tasks-details">
            <summary>Then...</summary>
            <div class="tasks-radio-group">
              ${(
                [
                  ["none", "Do nothing"],
                  ["notification", "Send notification"],
                  ["chain", "Trigger another task"],
                ] as const
              ).map(
                ([value, label]) => html`
                  <label>
                    <input
                      type="radio"
                      name="task-on-complete"
                      .checked=${draft.onComplete === value}
                      @change=${() => set({ onComplete: value })}
                    />
                    ${label}
                  </label>
                `,
              )}
            </div>
            ${draft.onComplete === "chain"
              ? html`
                  <label class="tasks-field">
                    <span>Next task title</span>
                    <input
                      class="tasks-input"
                      .value=${draft.chainedTaskTitle}
                      @input=${(event: InputEvent) => set({ chainedTaskTitle: inputValue(event) })}
                    />
                  </label>
                `
              : nothing}
          </details>

          <details class="tasks-details">
            <summary>Model Override</summary>
            <label class="tasks-toggle-row">
              <input
                type="checkbox"
                .checked=${draft.useDefaultModel}
                @change=${(event: Event) =>
                  set({ useDefaultModel: (event.currentTarget as HTMLInputElement).checked })}
              />
              Use agent default model
            </label>
            ${draft.useDefaultModel
              ? nothing
              : html`
                  <label class="tasks-field">
                    <span>Model</span>
                    <select
                      class="tasks-input"
                      .value=${draft.modelOverride}
                      @change=${(event: Event) => set({ modelOverride: selectValue(event) })}
                    >
                      ${models.map((model) => html`<option value=${model}>${model}</option>`)}
                    </select>
                  </label>
                `}
          </details>
        </div>
        <div class="tasks-drawer__footer">
          <button class="btn" @click=${params.onClose}>Cancel</button>
          <button class="btn primary" ?disabled=${!draft.title.trim()} @click=${params.onSave}>
            ${draft.runMode === "now" ? "Run Now" : "Schedule Task"}
          </button>
        </div>
      </aside>
    </div>
  `;
}
