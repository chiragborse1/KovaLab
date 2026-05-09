import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AgentsListResult, ModelCatalogEntry, SessionsListResult } from "../../types.ts";
import { mapGatewayTask, tickGatewayTasks } from "./gatewayData.ts";
import { renderNewTaskDrawer } from "./NewTaskDrawer.ts";
import { renderTaskBoard } from "./TaskBoard.ts";
import { renderTaskDetailPanel } from "./TaskDetailPanel.ts";
import { renderTaskEmptyState } from "./TaskEmptyState.ts";
import { renderTaskListView, type TaskSortState } from "./TaskListView.ts";
import { renderTemplatePicker } from "./TemplatePicker.ts";
import { TASK_TEMPLATES } from "./templates.ts";
import type {
  NewTaskDraft,
  Task,
  TaskActionHandlers,
  TaskDetailTab,
  TasksListResult,
  TaskRunView,
  TaskStatus,
  TasksPageProps,
  TaskTemplate,
  TaskViewMode,
} from "./types.ts";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, cronExpression } from "./utils.ts";

type TaskFilter = "all" | TaskStatus;

function createDraft(agent = "main"): NewTaskDraft {
  return {
    title: "",
    agent,
    runMode: "now",
    scheduledFor: "",
    cron: {
      preset: "daily",
      minute: "0",
      hour: "9",
      day: "*",
      month: "*",
      weekday: "*",
    },
    urlDraft: "",
    urls: [],
    sessionRef: "",
    notes: "",
    onComplete: "none",
    chainedTaskTitle: "",
    useDefaultModel: true,
    modelOverride: "gpt-5.5",
  };
}

function defaultAgentId(agents: AgentsListResult | null): string {
  return agents?.defaultId || agents?.agents[0]?.id || "main";
}

function defaultModelForAgent(agents: AgentsListResult | null, agentId: string): string {
  const agent = agents?.agents.find((entry) => entry.id === agentId);
  return agent?.model?.primary ?? "openrouter/auto";
}

@customElement("kova-tasks-page")
class KovaTasksPage extends LitElement {
  @property({ attribute: false }) client: TasksPageProps["client"] = null;
  @property({ attribute: false }) sessionKey: string | null | undefined = null;
  @property({ attribute: false }) agentsList: AgentsListResult | null = null;
  @property({ attribute: false }) sessionsResult: SessionsListResult | null = null;
  @property({ attribute: false }) modelCatalog: ModelCatalogEntry[] = [];
  @property({ attribute: false }) onNavigateToCron?: () => void;

  @state() private tasks: Task[] = [];
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private activeFilter: TaskFilter = "all";
  @state() private viewMode: TaskViewMode = "board";
  @state() private newTaskOpen = false;
  @state() private templatePickerOpen = false;
  @state() private selectedTaskId: string | null = null;
  @state() private detailTab: TaskDetailTab = "overview";
  @state() private draft: NewTaskDraft = createDraft();
  @state() private sort: TaskSortState = { key: "created", direction: "desc" };
  @state() private toast: string | null = null;
  @state() private editingTitle = false;
  @state() private titleDraft = "";
  @state() private supersededTaskIds = new Set<string>();

  private pollId: number | undefined;
  private toastId: number | undefined;
  private inFlightLoad: Promise<void> | null = null;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this.loadTasks();
    this.pollId = window.setInterval(() => {
      this.tasks = tickGatewayTasks(this.tasks, Date.now());
      void this.loadTasks({ silent: true });
    }, 3000);
  }

  override updated(changed: PropertyValues<this>): void {
    if (changed.has("client") && this.client) {
      void this.loadTasks();
    }
  }

  override disconnectedCallback(): void {
    if (this.pollId !== undefined) {
      window.clearInterval(this.pollId);
      this.pollId = undefined;
    }
    if (this.toastId !== undefined) {
      window.clearTimeout(this.toastId);
      this.toastId = undefined;
    }
    super.disconnectedCallback();
  }

  private showToast = (message: string): void => {
    this.toast = message;
    if (this.toastId !== undefined) {
      window.clearTimeout(this.toastId);
    }
    this.toastId = window.setTimeout(() => {
      this.toast = null;
      this.toastId = undefined;
    }, 2600);
  };

  private async loadTasks(options: { silent?: boolean } = {}): Promise<void> {
    if (!this.client) {
      this.error = "Gateway client is not connected.";
      this.tasks = [];
      return;
    }
    if (this.inFlightLoad) {
      return this.inFlightLoad;
    }
    if (!options.silent) {
      this.loading = true;
    }
    this.inFlightLoad = this.client
      .request<TasksListResult>("tasks.list", { limit: 200 })
      .then((result) => {
        this.tasks = result.tasks
          .filter((task) => !this.supersededTaskIds.has(task.id))
          .map((task) => mapGatewayTask(task));
        this.error = null;
      })
      .catch((err: unknown) => {
        this.error = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        if (!options.silent) {
          this.loading = false;
        }
        this.inFlightLoad = null;
      });
    return this.inFlightLoad;
  }

  private openNewTask = (status?: TaskStatus): void => {
    this.draft = {
      ...createDraft(defaultAgentId(this.agentsList)),
      runMode: status === "queued" ? "scheduled" : "now",
      initialStatus: status,
    };
    this.newTaskOpen = true;
  };

  private openTemplatePicker = (): void => {
    this.templatePickerOpen = true;
  };

  private useTemplate = (template: TaskTemplate): void => {
    this.templatePickerOpen = false;
    this.draft = {
      ...createDraft(defaultAgentId(this.agentsList)),
      title: template.defaultTitle,
      notes: template.defaultNotes,
    };
    this.newTaskOpen = true;
  };

  private composeTaskMessage(): string {
    const parts = [this.draft.title.trim()];
    if (this.draft.notes.trim()) {
      parts.push(`Context:\n${this.draft.notes.trim()}`);
    }
    if (this.draft.urls.length > 0) {
      parts.push(`URLs:\n${this.draft.urls.map((url) => `- ${url}`).join("\n")}`);
    }
    if (this.draft.sessionRef.trim()) {
      parts.push(`Reference session: ${this.draft.sessionRef.trim()}`);
    }
    return parts.join("\n\n");
  }

  private async saveTask(): Promise<void> {
    if (!this.draft.title.trim()) {
      return;
    }
    if (!this.client) {
      this.showToast("Gateway is not connected");
      return;
    }
    const model = this.draft.useDefaultModel
      ? defaultModelForAgent(this.agentsList, this.draft.agent)
      : this.draft.modelOverride || "gpt-5.5";
    const message = this.composeTaskMessage();
    try {
      if (this.draft.runMode === "now") {
        await this.client.request("agent", {
          message,
          agentId: this.draft.agent,
          sessionKey: this.sessionKey || `agent:${this.draft.agent}:main`,
          ...(this.draft.useDefaultModel ? {} : { model }),
          idempotencyKey: `tasks-ui:${crypto.randomUUID()}`,
        });
        this.showToast("Task started");
      } else {
        const scheduledAt =
          this.draft.runMode === "scheduled" ? Date.parse(this.draft.scheduledFor) : undefined;
        if (this.draft.runMode === "scheduled" && !Number.isFinite(scheduledAt)) {
          this.showToast("Choose a valid scheduled time");
          return;
        }
        const schedule =
          this.draft.runMode === "scheduled"
            ? { kind: "at" as const, at: new Date(scheduledAt as number).toISOString() }
            : { kind: "cron" as const, expr: cronExpression(this.draft.cron) };
        await this.client.request("cron.add", {
          name: this.draft.title.trim(),
          description: this.draft.notes.trim() || undefined,
          agentId: this.draft.agent,
          enabled: true,
          deleteAfterRun: this.draft.runMode === "scheduled",
          schedule,
          sessionTarget: "isolated",
          wakeMode: "now",
          payload: {
            kind: "agentTurn",
            message,
            ...(this.draft.useDefaultModel ? {} : { model }),
          },
        });
        this.showToast(
          this.draft.runMode === "scheduled"
            ? "Task scheduled through Cron"
            : "Recurring task scheduled through Cron",
        );
      }
      this.newTaskOpen = false;
      await this.loadTasks({ silent: true });
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : String(err));
    }
  }

  private openTask = (task: Task): void => {
    this.selectedTaskId = task.id;
    this.detailTab = "overview";
    this.titleDraft = task.title;
    this.editingTitle = false;
    void this.loadTaskDetail(task.id);
  };

  private async loadTaskDetail(taskId: string): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      const result = await this.client.request<{ task: TaskRunView }>("tasks.show", {
        lookup: taskId,
      });
      const mapped = mapGatewayTask(result.task);
      this.updateTask(taskId, () => mapped);
      if (this.selectedTaskId === taskId) {
        this.titleDraft = mapped.title;
      }
    } catch {
      // Keep the list view copy if detail refresh races with pruning/deletion.
    }
  }

  private closeTask = (): void => {
    this.selectedTaskId = null;
    this.editingTitle = false;
  };

  private updateTask = (taskId: string, updater: (task: Task) => Task): void => {
    this.tasks = this.tasks.map((task) => (task.id === taskId ? updater(task) : task));
  };

  private retryTask = (taskId: string): void => {
    void this.retryTaskAsync(taskId);
  };

  private async retryTaskAsync(taskId: string): Promise<void> {
    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task || !this.client) {
      return;
    }
    try {
      if (task.runtime === "cron" && task.sourceId) {
        await this.client.request("cron.run", { id: task.sourceId, mode: "force" });
      } else {
        await this.client.request("agent", {
          message: task.title,
          agentId: task.agent,
          sessionKey: task.sessionKey || this.sessionKey || `agent:${task.agent}:main`,
          idempotencyKey: `tasks-ui-retry:${task.id}:${crypto.randomUUID()}`,
        });
      }
      this.supersededTaskIds = new Set([...this.supersededTaskIds, task.id]);
      if (this.selectedTaskId === task.id) {
        this.selectedTaskId = null;
      }
      this.showToast("Task retry started");
      await this.loadTasks({ silent: true });
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : String(err));
    }
  }

  private approveTask = (taskId: string): void => {
    void taskId;
    this.showToast("Use the approvals panel to resolve approval requests");
  };

  private rejectTask = (taskId: string): void => {
    void taskId;
    this.showToast("Use the approvals panel to reject approval requests");
  };

  private cancelTask = (taskId: string): void => {
    void this.cancelTaskAsync(taskId);
  };

  private async cancelTaskAsync(taskId: string): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      const result = await this.client.request<{ cancelled: boolean; reason?: string }>(
        "tasks.cancel",
        { lookup: taskId },
      );
      this.showToast(result.cancelled ? "Task cancelled" : (result.reason ?? "Task not cancelled"));
      await this.loadTasks({ silent: true });
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : String(err));
    }
  }

  private deleteTask = (taskId: string): void => {
    void this.deleteTaskAsync(taskId);
  };

  private async deleteTaskAsync(taskId: string): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      const result = await this.client.request<{ deleted: boolean; reason?: string }>(
        "tasks.delete",
        { taskId },
      );
      if (result.deleted && this.selectedTaskId === taskId) {
        this.selectedTaskId = null;
      }
      this.showToast(result.deleted ? "Task deleted" : (result.reason ?? "Task not deleted"));
      await this.loadTasks({ silent: true });
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : String(err));
    }
  }

  private addUrl = (): void => {
    const url = this.draft.urlDraft.trim();
    if (!url || this.draft.urls.includes(url)) {
      return;
    }
    this.draft = { ...this.draft, urls: [...this.draft.urls, url], urlDraft: "" };
  };

  private removeUrl = (url: string): void => {
    this.draft = { ...this.draft, urls: this.draft.urls.filter((entry) => entry !== url) };
  };

  private commitTitle = (): void => {
    const title = this.titleDraft.trim();
    if (this.selectedTaskId && title) {
      this.updateTask(this.selectedTaskId, (task) => ({ ...task, title }));
      this.showToast("Title changed locally for this view");
    }
    this.editingTitle = false;
  };

  private copyOutput = (): void => {
    const task = this.selectedTask;
    if (!task?.output) {
      return;
    }
    void navigator.clipboard?.writeText(task.output);
    this.showToast("Output copied");
  };

  private get selectedTask(): Task | null {
    return this.tasks.find((task) => task.id === this.selectedTaskId) ?? null;
  }

  private filteredTasks(): Task[] {
    if (this.activeFilter === "all") {
      return this.tasks;
    }
    return this.tasks.filter((task) => task.status === this.activeFilter);
  }

  private statusCount(filter: TaskFilter): number {
    return filter === "all"
      ? this.tasks.length
      : this.tasks.filter((task) => task.status === filter).length;
  }

  private renderHeader() {
    const filters: Array<{ id: TaskFilter; label: string }> = [
      { id: "all", label: "All" },
      ...TASK_STATUS_ORDER.map((status) => ({ id: status, label: TASK_STATUS_LABELS[status] })),
    ];
    return html`
      <section class="tasks-header">
        <div class="tasks-header__main tasks-header__main--compact">
          <div class="tasks-filter-row">
            ${filters.map(
              (filter) => html`
                <button
                  class=${`tasks-filter-pill ${this.activeFilter === filter.id ? "is-active" : ""}`}
                  @click=${() => (this.activeFilter = filter.id)}
                >
                  ${filter.label}
                  <span>${this.statusCount(filter.id)}</span>
                </button>
              `,
            )}
          </div>
          <div class="tasks-header__actions">
            ${this.loading ? html`<span class="tasks-header__status">Loading…</span>` : nothing}
            <div class="tasks-view-toggle" aria-label="View mode">
              <button
                class=${this.viewMode === "board" ? "is-active" : ""}
                @click=${() => (this.viewMode = "board")}
                title="Board view"
              >
                ▦
              </button>
              <button
                class=${this.viewMode === "list" ? "is-active" : ""}
                @click=${() => (this.viewMode = "list")}
                title="List view"
              >
                ☰
              </button>
            </div>
            <button class="btn" @click=${this.openTemplatePicker}>Templates</button>
            <button class="btn primary" @click=${() => this.openNewTask()}>+ New Task</button>
          </div>
        </div>
      </section>
    `;
  }

  override render() {
    const handlers: TaskActionHandlers = {
      onOpen: this.openTask,
      onRetry: this.retryTask,
      onApprove: this.approveTask,
      onReject: this.rejectTask,
      onCancel: this.cancelTask,
      onDelete: this.deleteTask,
    };
    const visibleTasks = this.filteredTasks();
    const selectedTask = this.selectedTask;

    return html`
      <div class="tasks-page">
        ${this.renderHeader()}
        ${this.error ? html`<div class="tasks-error">${this.error}</div>` : nothing}
        ${this.loading && this.tasks.length === 0
          ? html`<div class="tasks-loading">Loading task ledger…</div>`
          : this.tasks.length === 0
            ? renderTaskEmptyState({
                onCreate: () => this.openNewTask(),
                onTemplates: this.openTemplatePicker,
                onImportCron: () => this.onNavigateToCron?.(),
              })
            : this.viewMode === "board"
              ? renderTaskBoard({
                  tasks: visibleTasks,
                  handlers,
                  onAddTask: this.openNewTask,
                })
              : renderTaskListView({
                  tasks: visibleTasks,
                  handlers,
                  sort: this.sort,
                  onSort: (sort) => (this.sort = sort),
                })}

        <div class="tasks-metrics-strip">
          <span>${this.tasks.length} tracked tasks</span>
          <span>${this.statusCount("running")} running</span>
          <span>${this.statusCount("failed")} needs attention</span>
        </div>

        ${this.newTaskOpen
          ? renderNewTaskDrawer({
              draft: this.draft,
              agentsList: this.agentsList,
              sessionsResult: this.sessionsResult,
              modelCatalog: this.modelCatalog,
              onClose: () => (this.newTaskOpen = false),
              onSave: this.saveTask,
              onDraft: (patch) => (this.draft = { ...this.draft, ...patch }),
              onCron: (cron) => (this.draft = { ...this.draft, cron }),
              onAddUrl: this.addUrl,
              onRemoveUrl: this.removeUrl,
            })
          : nothing}
        ${selectedTask
          ? renderTaskDetailPanel({
              task: selectedTask,
              tab: this.detailTab,
              editingTitle: this.editingTitle,
              titleDraft: this.titleDraft,
              handlers,
              onClose: this.closeTask,
              onTab: (tab) => (this.detailTab = tab),
              onEditTitle: () => {
                this.titleDraft = selectedTask.title;
                this.editingTitle = true;
              },
              onTitleInput: (value) => (this.titleDraft = value),
              onTitleCommit: this.commitTitle,
              onCopyOutput: this.copyOutput,
            })
          : nothing}
        ${this.templatePickerOpen
          ? renderTemplatePicker({
              templates: TASK_TEMPLATES,
              onUse: this.useTemplate,
              onClose: () => (this.templatePickerOpen = false),
            })
          : nothing}
        ${this.toast ? html`<div class="tasks-toast">${this.toast}</div>` : nothing}
      </div>
    `;
  }
}

export function renderTasksPage(props: TasksPageProps) {
  return html`
    <kova-tasks-page
      .client=${props.client}
      .sessionKey=${props.sessionKey}
      .agentsList=${props.agentsList}
      .sessionsResult=${props.sessionsResult}
      .modelCatalog=${props.modelCatalog}
      .onNavigateToCron=${props.onNavigateToCron}
    ></kova-tasks-page>
  `;
}
