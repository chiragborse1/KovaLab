import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { icons } from "../../icons.ts";
import { normalizeOptionalString } from "../../string-coerce.ts";
import type { GatewaySessionRow } from "../../types.ts";
import { renderSessionBulkBar } from "./SessionBulkBar.ts";
import { renderSessionDetailPanel } from "./SessionDetailPanel.ts";
import { renderSessionFilters } from "./SessionFilters.ts";
import { renderSessionGroupHeader } from "./SessionGroupHeader.ts";
import { renderSessionRowCard } from "./SessionRowCard.ts";
import { filterRows, groupSessions, rowToSession, sortRows, SOURCE_ORDER } from "./sessionUtils.ts";
import { sessionStyles } from "./styles.ts";
import type {
  Session,
  SessionConversationMessage,
  SessionDetailTab,
  SessionFilterSource,
  SessionFilterTime,
  SessionSource,
  SessionsProps,
} from "./types.ts";

const PAGE_SIZES = [10, 25, 50] as const;

function defaultProps(): SessionsProps {
  return {
    client: null,
    connected: false,
    loading: false,
    result: null,
    error: null,
    activeMinutes: "",
    limit: "120",
    includeGlobal: false,
    includeUnknown: false,
    basePath: "",
    searchQuery: "",
    agentIdentityById: {},
    sortColumn: "updated",
    sortDir: "desc",
    page: 0,
    pageSize: 25,
    selectedKeys: new Set<string>(),
    expandedCheckpointKey: null,
    checkpointItemsByKey: {},
    checkpointLoadingKey: null,
    checkpointBusyKey: null,
    checkpointErrorByKey: {},
    onFiltersChange: () => undefined,
    onSearchChange: () => undefined,
    onSortChange: () => undefined,
    onPageChange: () => undefined,
    onPageSizeChange: () => undefined,
    onRefresh: () => undefined,
    onPatch: () => undefined,
    onToggleSelect: () => undefined,
    onSelectPage: () => undefined,
    onDeselectPage: () => undefined,
    onDeselectAll: () => undefined,
    onDeleteSelected: () => undefined,
    onToggleCheckpointDetails: () => undefined,
    onBranchFromCheckpoint: () => undefined,
    onRestoreCheckpoint: () => undefined,
  };
}

function pageSlice<T>(rows: T[], page: number, pageSize: number): T[] {
  return rows.slice(page * pageSize, page * pageSize + pageSize);
}

function isInTimeFilter(session: Session, filter: SessionFilterTime): boolean {
  if (filter === "all") {
    return true;
  }
  if (!session.updatedAtMs) {
    return false;
  }
  const age = Date.now() - session.updatedAtMs;
  if (filter === "today") {
    return age >= 0 && age <= 24 * 60 * 60 * 1000;
  }
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}

function countBySource(sessions: Session[]): Record<SessionSource, number> {
  return SOURCE_ORDER.reduce<Record<SessionSource, number>>(
    (acc, source) => {
      acc[source] = sessions.filter((session) => session.source === source).length;
      return acc;
    },
    { direct: 0, telegram: 0, discord: 0, cron: 0, other: 0 },
  );
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(extractContentText).filter(Boolean).join("\n");
  }
  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;
    if (typeof record.text === "string") {
      return record.text;
    }
    if (typeof record.content === "string") {
      return record.content;
    }
    if (record.input || record.output) {
      const input = record.input ? extractContentText(record.input) : "";
      const output = record.output ? extractContentText(record.output) : "";
      return [input, output].filter(Boolean).join("\n");
    }
  }
  return "";
}

function normalizeHistoryMessage(raw: unknown): SessionConversationMessage {
  if (!raw || typeof raw !== "object") {
    return { role: "unknown", text: String(raw ?? "") };
  }
  const record = raw as Record<string, unknown>;
  const rawRole = typeof record.role === "string" ? record.role : "unknown";
  const role: SessionConversationMessage["role"] =
    rawRole === "user" || rawRole === "assistant" || rawRole === "system" || rawRole === "tool"
      ? rawRole
      : "unknown";
  const toolName =
    typeof record.name === "string"
      ? record.name
      : typeof record.toolName === "string"
        ? record.toolName
        : undefined;
  const text = extractContentText(record.content ?? record.text ?? record.message ?? raw);
  return {
    role,
    toolName,
    text: text || "(empty message)",
  };
}

@customElement("kova-sessions-page")
class KovaSessionsPage extends LitElement {
  @property({ attribute: false }) props: SessionsProps = defaultProps();

  @state() private sourceFilter: SessionFilterSource = "all";
  @state() private timeFilter: SessionFilterTime = "all";
  @state() private collapsedSources = new Set<SessionSource>();
  @state() private detailKey: string | null = null;
  @state() private detailTab: SessionDetailTab = "overview";
  @state() private editingLabelKey: string | null = null;
  @state() private labelDraft = "";
  @state() private bulkLabelOpen = false;
  @state() private bulkLabelDraft = "";
  @state() private bulkDeleteOpen = false;
  @state() private conversationLoadingKey: string | null = null;
  @state() private conversationErrorByKey: Record<string, string> = {};
  @state() private conversationByKey: Record<string, SessionConversationMessage[]> = {};

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("props") && this.detailKey) {
      const exists = this.props.result?.sessions.some((row) => row.key === this.detailKey) ?? false;
      if (!exists) {
        this.detailKey = null;
      }
    }
  }

  private rawRows(): GatewaySessionRow[] {
    return this.props.result?.sessions ?? [];
  }

  private sourceFilteredRows(): Session[] {
    const filteredRows = filterRows(
      this.rawRows(),
      this.props.searchQuery,
      this.props.agentIdentityById,
    );
    const sorted = sortRows(filteredRows, this.props.sortColumn, this.props.sortDir);
    return sorted
      .map(rowToSession)
      .filter((session) => this.sourceFilter === "all" || session.source === this.sourceFilter)
      .filter((session) => isInTimeFilter(session, this.timeFilter));
  }

  private selectedSession(): Session | null {
    if (!this.detailKey) {
      return null;
    }
    const row = this.rawRows().find((entry) => entry.key === this.detailKey);
    return row ? rowToSession(row) : null;
  }

  private setCollapsed(source: SessionSource): void {
    const next = new Set(this.collapsedSources);
    if (next.has(source)) {
      next.delete(source);
    } else {
      next.add(source);
    }
    this.collapsedSources = next;
  }

  private setActiveOnly(activeOnly: boolean): void {
    this.props.onFiltersChange({
      activeMinutes: activeOnly ? this.props.activeMinutes || "60" : "",
      limit: this.props.limit || "120",
      includeGlobal: this.props.includeGlobal,
      includeUnknown: this.props.includeUnknown,
    });
  }

  private openDetail(session: Session): void {
    this.detailKey = session.key;
    this.detailTab = "overview";
  }

  private beginLabelEdit(session: Session): void {
    this.editingLabelKey = session.key;
    this.labelDraft = session.label ?? "";
  }

  private saveLabel(sessionKey = this.editingLabelKey): void {
    if (!sessionKey) {
      return;
    }
    const label = normalizeOptionalString(this.labelDraft) ?? null;
    this.props.onPatch(sessionKey, { label });
    this.editingLabelKey = null;
    this.labelDraft = "";
  }

  private async copyKey(key: string): Promise<void> {
    await navigator.clipboard?.writeText(key);
  }

  private exportSelected(): void {
    const keys = [...this.props.selectedKeys];
    const blob = new Blob([`${keys.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kova-session-keys.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private applyBulkLabel(): void {
    const label = normalizeOptionalString(this.bulkLabelDraft) ?? null;
    for (const key of this.props.selectedKeys) {
      this.props.onPatch(key, { label });
    }
    this.bulkLabelOpen = false;
    this.bulkLabelDraft = "";
  }

  private deleteSession(key: string): void {
    if (!window.confirm("Delete this session? This cannot be undone.")) {
      return;
    }
    void this.props.onDeleteSession?.(key);
  }

  private async loadConversation(sessionKey: string, force = false): Promise<void> {
    if (!force && this.conversationByKey[sessionKey]) {
      return;
    }
    if (!this.props.client || this.props.connected === false) {
      this.conversationErrorByKey = {
        ...this.conversationErrorByKey,
        [sessionKey]: "Gateway is not connected.",
      };
      return;
    }
    this.conversationLoadingKey = sessionKey;
    this.conversationErrorByKey = { ...this.conversationErrorByKey, [sessionKey]: "" };
    try {
      const res = await this.props.client.request<{ messages?: unknown[] }>("chat.history", {
        sessionKey,
        limit: 200,
      });
      this.conversationByKey = {
        ...this.conversationByKey,
        [sessionKey]: Array.isArray(res.messages) ? res.messages.map(normalizeHistoryMessage) : [],
      };
    } catch (error) {
      this.conversationErrorByKey = {
        ...this.conversationErrorByKey,
        [sessionKey]: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (this.conversationLoadingKey === sessionKey) {
        this.conversationLoadingKey = null;
      }
    }
  }

  private selectTab(tab: SessionDetailTab, session: Session): void {
    this.detailTab = tab;
    if (tab === "conversation") {
      void this.loadConversation(session.key);
    }
    if (tab === "checkpoints") {
      const hasItems = (this.props.checkpointItemsByKey[session.key] ?? []).length > 0;
      const isLoading = this.props.checkpointLoadingKey === session.key;
      if (!hasItems && !isLoading && this.props.expandedCheckpointKey !== session.key) {
        this.props.onToggleCheckpointDetails(session.key);
      }
    }
  }

  private clearFilters(): void {
    this.sourceFilter = "all";
    this.timeFilter = "all";
    this.props.onSearchChange("");
    this.setActiveOnly(false);
  }

  override render() {
    const rawSessions = this.rawRows().map(rowToSession);
    const sourceCounts = countBySource(rawSessions);
    const sessions = this.sourceFilteredRows();
    const totalRows = sessions.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / this.props.pageSize));
    const page = Math.min(this.props.page, totalPages - 1);
    const paginated = pageSlice(sessions, page, this.props.pageSize);
    const groups = groupSessions(paginated, this.collapsedSources);
    const selectedOnPage = paginated.filter((session) => this.props.selectedKeys.has(session.key));
    const allPageSelected = paginated.length > 0 && selectedOnPage.length === paginated.length;
    const somePageSelected = selectedOnPage.length > 0 && !allPageSelected;
    const activeCount = rawSessions.filter((session) => session.status === "active").length;
    const selected = this.selectedSession();
    const filtersActive =
      this.sourceFilter !== "all" ||
      this.timeFilter !== "all" ||
      Boolean(this.props.searchQuery) ||
      Boolean(this.props.activeMinutes);

    return html`
      ${sessionStyles}
      <section class="sessions-page">
        <div class="sessions-header">
          <div>
            <h1 class="sessions-title">Sessions</h1>
            <div class="sessions-subtitle">
              ${activeCount} active session${activeCount === 1 ? "" : "s"} · Store:
              ${this.props.result?.path ?? "multiple"} · Limit: ${this.props.limit || "120"}
            </div>
          </div>
          <div class="sessions-search">
            ${icons.search}
            <input
              type="text"
              placeholder="Filter by key, agent, label, source..."
              .value=${this.props.searchQuery}
              @input=${(event: Event) =>
                this.props.onSearchChange((event.target as HTMLInputElement).value)}
            />
          </div>
          <button class="btn" ?disabled=${this.props.loading} @click=${this.props.onRefresh}>
            ${this.props.loading ? "Loading" : "Refresh"}
          </button>
        </div>

        ${renderSessionFilters({
          source: this.sourceFilter,
          time: this.timeFilter,
          activeOnly: Boolean(this.props.activeMinutes),
          counts: sourceCounts,
          onSource: (source) => {
            this.sourceFilter = source;
            this.props.onPageChange(0);
          },
          onTime: (time) => {
            this.timeFilter = time;
            this.props.onPageChange(0);
          },
          onActiveOnly: (activeOnly) => this.setActiveOnly(activeOnly),
        })}
        ${this.props.error ? html`<div class="callout danger">${this.props.error}</div>` : nothing}

        <div class="sessions-filter-bar">
          <label class="sessions-checkbox-pill">
            <input
              type="checkbox"
              .checked=${allPageSelected}
              .indeterminate=${somePageSelected}
              @change=${() => {
                if (allPageSelected) {
                  this.props.onDeselectPage(paginated.map((session) => session.key));
                } else {
                  this.props.onSelectPage(paginated.map((session) => session.key));
                }
              }}
            />
            <span>Select page</span>
          </label>
          <div class="sessions-filter-group">
            <button
              class=${`sessions-pill ${this.props.sortColumn === "updated" ? "is-active" : ""}`}
              @click=${() =>
                this.props.onSortChange(
                  "updated",
                  this.props.sortColumn === "updated" && this.props.sortDir === "desc"
                    ? "asc"
                    : "desc",
                )}
            >
              Updated ${this.props.sortColumn === "updated" ? this.props.sortDir : ""}
            </button>
            <button
              class=${`sessions-pill ${this.props.sortColumn === "tokens" ? "is-active" : ""}`}
              @click=${() =>
                this.props.onSortChange(
                  "tokens",
                  this.props.sortColumn === "tokens" && this.props.sortDir === "desc"
                    ? "asc"
                    : "desc",
                )}
            >
              Tokens ${this.props.sortColumn === "tokens" ? this.props.sortDir : ""}
            </button>
          </div>
        </div>

        ${this.props.loading
          ? html`
              <div class="sessions-list">
                ${Array.from({ length: 5 }, () => html`<div class="sessions-skeleton-row"></div>`)}
              </div>
            `
          : totalRows === 0
            ? html`
                <div class="sessions-empty">
                  ${filtersActive ? icons.search : icons.messageSquare}
                  <strong>${filtersActive ? "No sessions found" : "No sessions yet"}</strong>
                  <span>
                    ${filtersActive
                      ? "Try adjusting your filters or check that the gateway is connected."
                      : "Sessions are created when you chat with an agent or receive a message via Telegram, Discord, or another channel."}
                  </span>
                  <div class="row" style="gap: 8px;">
                    ${filtersActive
                      ? html`<button class="btn" @click=${() => this.clearFilters()}>
                          Clear filters
                        </button>`
                      : html`<button
                          class="btn primary"
                          @click=${() => this.props.onNavigateToChat?.("agent:main:main")}
                        >
                          Open Chat
                        </button>`}
                    <button class="btn" @click=${this.props.onRefresh}>Refresh</button>
                  </div>
                </div>
              `
            : html`
                <div class="sessions-list">
                  ${groups.map(
                    (group) => html`
                      <section class="session-group">
                        ${renderSessionGroupHeader({
                          source: group.source,
                          label: group.label,
                          count: group.sessions.length,
                          collapsed: group.collapsed,
                          onToggle: () => this.setCollapsed(group.source),
                        })}
                        ${group.collapsed
                          ? nothing
                          : group.sessions.map((session) =>
                              renderSessionRowCard({
                                session,
                                props: this.props,
                                selected: this.props.selectedKeys.has(session.key),
                                editingLabel: this.editingLabelKey === session.key,
                                labelDraft: this.labelDraft,
                                onOpen: () => this.openDetail(session),
                                onEditLabel: () => this.beginLabelEdit(session),
                                onLabelDraft: (value) => {
                                  this.labelDraft = value;
                                },
                                onSaveLabel: () => this.saveLabel(session.key),
                                onCopy: () => void this.copyKey(session.key),
                                onDelete: () => this.deleteSession(session.key),
                              }),
                            )}
                      </section>
                    `,
                  )}
                </div>
              `}
        ${renderSessionBulkBar({
          count: this.props.selectedKeys.size,
          labelOpen: this.bulkLabelOpen,
          labelDraft: this.bulkLabelDraft,
          deleteOpen: this.bulkDeleteOpen,
          onClear: this.props.onDeselectAll,
          onToggleLabel: () => {
            this.bulkLabelOpen = !this.bulkLabelOpen;
            this.bulkDeleteOpen = false;
          },
          onLabelDraft: (value) => {
            this.bulkLabelDraft = value;
          },
          onApplyLabel: () => this.applyBulkLabel(),
          onExport: () => this.exportSelected(),
          onAskDelete: () => {
            this.bulkDeleteOpen = true;
            this.bulkLabelOpen = false;
          },
          onCancelDelete: () => {
            this.bulkDeleteOpen = false;
          },
          onConfirmDelete: () => {
            this.bulkDeleteOpen = false;
            this.props.onDeleteSelected();
          },
        })}
        ${totalRows > 0
          ? html`
              <div class="sessions-pagination">
                <select
                  class="sessions-filter-select"
                  style="width: 140px; height: 34px; padding: 0 10px;"
                  .value=${String(this.props.pageSize)}
                  @change=${(event: Event) =>
                    this.props.onPageSizeChange(Number((event.target as HTMLSelectElement).value))}
                >
                  ${PAGE_SIZES.map((size) => html`<option value=${size}>${size} per page</option>`)}
                </select>
                <div class="sessions-pagination-center">
                  <button
                    class="btn"
                    ?disabled=${page <= 0}
                    @click=${() => this.props.onPageChange(page - 1)}
                  >
                    ← Previous
                  </button>
                  <span>Page ${page + 1} of ${totalPages}</span>
                  <button
                    class="btn"
                    ?disabled=${page >= totalPages - 1}
                    @click=${() => this.props.onPageChange(page + 1)}
                  >
                    Next →
                  </button>
                </div>
                <span>
                  ${page * this.props.pageSize + 1}-${Math.min(
                    (page + 1) * this.props.pageSize,
                    totalRows,
                  )}
                  of ${totalRows} sessions
                </span>
              </div>
            `
          : nothing}
        ${selected
          ? renderSessionDetailPanel({
              session: selected,
              props: this.props,
              tab: this.detailTab,
              labelEditing: this.editingLabelKey === selected.key,
              labelDraft: this.labelDraft,
              conversationLoading: this.conversationLoadingKey === selected.key,
              conversationError: this.conversationErrorByKey[selected.key] || null,
              conversationMessages: this.conversationByKey[selected.key] ?? null,
              onClose: () => {
                this.detailKey = null;
              },
              onTab: (tab) => this.selectTab(tab, selected),
              onEditLabel: () => this.beginLabelEdit(selected),
              onLabelDraft: (value) => {
                this.labelDraft = value;
              },
              onSaveLabel: () => this.saveLabel(selected.key),
              onCopy: () => void this.copyKey(selected.key),
              onDelete: () => this.deleteSession(selected.key),
              onRetryConversation: () => void this.loadConversation(selected.key, true),
            })
          : nothing}
      </section>
    `;
  }
}

export function renderSessions(props: SessionsProps) {
  return html`<kova-sessions-page .props=${props}></kova-sessions-page>`;
}
