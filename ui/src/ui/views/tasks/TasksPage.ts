import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AgentsListResult, ModelCatalogEntry, SessionsListResult } from "../../types.ts";
import {
  createInitialTasks,
  createTaskFromDraft,
  TASK_TEMPLATES,
  tickMockTasks,
} from "./mockData.ts";
import { renderNewTaskDrawer } from "./NewTaskDrawer.ts";
import { renderTaskBoard } from "./TaskBoard.ts";
import { renderTaskDetailPanel } from "./TaskDetailPanel.ts";
import { renderTaskEmptyState } from "./TaskEmptyState.ts";
import { renderTaskListView, type TaskSortState } from "./TaskListView.ts";
import { renderTemplatePicker } from "./TemplatePicker.ts";
import type {
  NewTaskDraft,
  Task,
  TaskActionHandlers,
  TaskDetailTab,
  TaskStatus,
  TasksPageProps,
  TaskTemplate,
  TaskViewMode,
} from "./types.ts";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, formatCurrency, statusClass } from "./utils.ts";

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
  @property({ attribute: false }) agentsList: AgentsListResult | null = null;
  @property({ attribute: false }) sessionsResult: SessionsListResult | null = null;
  @property({ attribute: false }) modelCatalog: ModelCatalogEntry[] = [];
  @property({ attribute: false }) onNavigateToCron?: () => void;

  @state() private tasks: Task[] = createInitialTasks();
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

  private pollId: number | undefined;
  private toastId: number | undefined;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.pollId = window.setInterval(() => {
      this.tasks = tickMockTasks(this.tasks, Date.now());
    }, 3000);
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

  private saveTask = (): void => {
    if (!this.draft.title.trim()) {
      return;
    }
    const model = this.draft.useDefaultModel
      ? defaultModelForAgent(this.agentsList, this.draft.agent)
      : this.draft.modelOverride || "gpt-5.5";
    const task = createTaskFromDraft(this.draft, model);
    this.tasks = [task, ...this.tasks];
    this.newTaskOpen = false;
    this.showToast(
      this.draft.runMode === "now"
        ? "Task created"
        : `Task scheduled${this.draft.scheduledFor ? ` for ${this.draft.scheduledFor}` : ""}`,
    );
  };

  private openTask = (task: Task): void => {
    this.selectedTaskId = task.id;
    this.detailTab = "overview";
    this.titleDraft = task.title;
    this.editingTitle = false;
  };

  private closeTask = (): void => {
    this.selectedTaskId = null;
    this.editingTitle = false;
  };

  private updateTask = (taskId: string, updater: (task: Task) => Task): void => {
    this.tasks = this.tasks.map((task) => (task.id === taskId ? updater(task) : task));
  };

  private retryTask = (taskId: string): void => {
    const startedAtMs = Date.now();
    this.updateTask(taskId, (task) => ({
      ...task,
      status: "running",
      error: undefined,
      duration: 0,
      startedAt: "just now",
      startedAtMs,
      completedAt: undefined,
      completedAtMs: undefined,
      output: `${task.output ?? ""}\nRetry started.`,
      timeline: [
        ...(task.timeline ?? []),
        {
          timestamp: "just now",
          timestampMs: startedAtMs,
          type: "started",
          label: "Retry started",
        },
      ],
    }));
    this.showToast("Task retry started");
  };

  private approveTask = (taskId: string): void => {
    const startedAtMs = Date.now();
    this.updateTask(taskId, (task) => ({
      ...task,
      status: "running",
      startedAt: "just now",
      startedAtMs,
      output: `${task.output ?? ""}\nApproval granted. Continuing execution.`,
      timeline: [
        ...(task.timeline ?? []),
        {
          timestamp: "just now",
          timestampMs: startedAtMs,
          type: "started",
          label: "Approval granted",
        },
      ],
    }));
    this.showToast("Task approved");
  };

  private rejectTask = (taskId: string): void => {
    const completedAtMs = Date.now();
    this.updateTask(taskId, (task) => ({
      ...task,
      status: "failed",
      error: "Approval rejected",
      completedAt: "failed just now",
      completedAtMs,
      output: `${task.output ?? ""}\nApproval rejected by user.`,
      timeline: [
        ...(task.timeline ?? []),
        {
          timestamp: "just now",
          timestampMs: completedAtMs,
          type: "failed",
          label: "Approval rejected",
        },
      ],
    }));
    this.showToast("Task rejected");
  };

  private cancelTask = (taskId: string): void => {
    const completedAtMs = Date.now();
    this.updateTask(taskId, (task) => ({
      ...task,
      status: "failed",
      error: "Task cancelled",
      completedAt: "cancelled just now",
      completedAtMs,
      output: `${task.output ?? ""}\nTask cancelled.`,
    }));
    this.showToast("Task cancelled");
  };

  private deleteTask = (taskId: string): void => {
    this.tasks = this.tasks.filter((task) => task.id !== taskId);
    if (this.selectedTaskId === taskId) {
      this.selectedTaskId = null;
    }
    this.showToast("Task deleted");
  };

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
        <div class="tasks-header__main">
          <div>
            <h1>Tasks</h1>
            <p>Execution queue and agent job tracker</p>
          </div>
          <div class="tasks-header__actions">
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
            <button class="btn primary" @click=${() => this.openNewTask()}>+ New Task</button>
          </div>
        </div>
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
        ${this.tasks.length === 0
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
          <span
            >${formatCurrency(this.tasks.reduce((sum, task) => sum + (task.cost ?? 0), 0))} total
            mock cost</span
          >
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
      .agentsList=${props.agentsList}
      .sessionsResult=${props.sessionsResult}
      .modelCatalog=${props.modelCatalog}
      .onNavigateToCron=${props.onNavigateToCron}
    ></kova-tasks-page>
  `;
}
