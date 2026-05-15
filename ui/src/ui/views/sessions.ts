import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp, formatTokens, parseSessionKeyParts } from "../format.ts";
import { icons } from "../icons.ts";
import { pathForTab } from "../navigation.ts";
import { normalizeLowercaseStringOrEmpty, normalizeOptionalString } from "../string-coerce.ts";
import { normalizeThinkLevel } from "../thinking.ts";
import type {
  AgentIdentityResult,
  GatewaySessionRow,
  GatewayThinkingLevelOption,
  SessionCompactionCheckpoint,
  SessionsListResult,
} from "../types.ts";

export type SessionsProps = {
  loading: boolean;
  result: SessionsListResult | null;
  error: string | null;
  activeMinutes: string;
  limit: string;
  includeGlobal: boolean;
  includeUnknown: boolean;
  basePath: string;
  searchQuery: string;
  agentIdentityById: Record<string, AgentIdentityResult>;
  sortColumn: "key" | "kind" | "updated" | "tokens";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
  selectedKeys: Set<string>;
  expandedCheckpointKey: string | null;
  checkpointItemsByKey: Record<string, SessionCompactionCheckpoint[]>;
  checkpointLoadingKey: string | null;
  checkpointBusyKey: string | null;
  checkpointErrorByKey: Record<string, string>;
  onFiltersChange: (next: {
    activeMinutes: string;
    limit: string;
    includeGlobal: boolean;
    includeUnknown: boolean;
  }) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (column: "key" | "kind" | "updated" | "tokens", dir: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRefresh: () => void;
  onPatch: (
    key: string,
    patch: {
      label?: string | null;
      thinkingLevel?: string | null;
      fastMode?: boolean | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    },
  ) => void;
  onToggleSelect: (key: string) => void;
  onSelectPage: (keys: string[]) => void;
  onDeselectPage: (keys: string[]) => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onNavigateToChat?: (sessionKey: string) => void;
  onToggleCheckpointDetails: (sessionKey: string) => void;
  onBranchFromCheckpoint: (sessionKey: string, checkpointId: string) => void | Promise<void>;
  onRestoreCheckpoint: (sessionKey: string, checkpointId: string) => void | Promise<void>;
};

type SessionSource = "direct" | "telegram" | "discord" | "cron" | "global" | "other";
type SessionHealth = "active" | "idle" | "stale" | "unknown";

type SessionView = {
  row: GatewaySessionRow;
  title: string;
  keyLabel: string;
  keyTitle: string;
  source: SessionSource;
  sourceLabel: string;
  health: SessionHealth;
  statusLabel: string;
  updatedLabel: string;
  agentLabel: string;
  modelLabel: string;
  tokenLabel: string;
  tokenPercent: number | null;
  hasOverrides: boolean;
  canOpenChat: boolean;
};

type SessionsDisplay = {
  rawRows: GatewaySessionRow[];
  filteredRows: GatewaySessionRow[];
  sortedRows: GatewaySessionRow[];
  paginatedRows: GatewaySessionRow[];
  views: SessionView[];
  totalPages: number;
  page: number;
  activeCount: number;
  staleCount: number;
  checkpointCount: number;
  overrideCount: number;
};

const DEFAULT_THINK_LEVELS = ["off", "minimal", "low", "medium", "high"] as const;
const VERBOSE_LEVELS = [
  { value: "", label: "inherit" },
  { value: "off", label: "off (explicit)" },
  { value: "on", label: "on" },
  { value: "full", label: "full" },
] as const;
const FAST_LEVELS = [
  { value: "", label: "inherit" },
  { value: "on", label: "on" },
  { value: "off", label: "off" },
] as const;
const REASONING_LEVELS = ["", "off", "on", "stream"] as const;
const PAGE_SIZES = [10, 25, 50, 100] as const;

function getAgentIdentity(
  agentIdentityById: Record<string, AgentIdentityResult>,
  agentId: string,
): AgentIdentityResult | null {
  return Object.prototype.hasOwnProperty.call(agentIdentityById, agentId)
    ? (agentIdentityById[agentId] ?? null)
    : null;
}

function normalizeThinkingOptionValue(raw: string): string {
  return normalizeThinkLevel(raw) ?? normalizeLowercaseStringOrEmpty(raw);
}

function resolveThinkLevelOptions(
  row: GatewaySessionRow,
): readonly { value: string; label: string }[] {
  const defaultLabel = row.thinkingDefault ? `Default (${row.thinkingDefault})` : "inherit";
  const options: readonly GatewayThinkingLevelOption[] = row.thinkingLevels?.length
    ? row.thinkingLevels
    : (row.thinkingOptions?.length ? row.thinkingOptions : DEFAULT_THINK_LEVELS).map((label) => ({
        id: normalizeThinkingOptionValue(label),
        label,
      }));
  return [
    { value: "", label: defaultLabel },
    ...options.map((option) => ({
      value: normalizeThinkingOptionValue(option.id),
      label: option.label,
    })),
  ];
}

function withCurrentOption(options: readonly string[], current: string): string[] {
  if (!current) {
    return [...options];
  }
  return options.includes(current) ? [...options] : [...options, current];
}

function withCurrentLabeledOption(
  options: readonly { value: string; label: string }[],
  current: string,
): Array<{ value: string; label: string }> {
  if (!current) {
    return [...options];
  }
  return options.some((option) => option.value === current)
    ? [...options]
    : [...options, { value: current, label: `${current} (custom)` }];
}

function resolveThinkLevelPatchValue(value: string): string | null {
  return value || null;
}

function filterRows(
  rows: GatewaySessionRow[],
  query: string,
  agentIdentityById: Record<string, AgentIdentityResult>,
): GatewaySessionRow[] {
  const q = normalizeLowercaseStringOrEmpty(query);
  if (!q) {
    return rows;
  }
  return rows.filter((row) => {
    const key = normalizeLowercaseStringOrEmpty(row.key);
    const label = normalizeLowercaseStringOrEmpty(row.label);
    const kind = normalizeLowercaseStringOrEmpty(row.kind);
    const displayName = normalizeLowercaseStringOrEmpty(row.displayName);
    const source = resolveSessionSource(row);
    if (
      key.includes(q) ||
      label.includes(q) ||
      kind.includes(q) ||
      displayName.includes(q) ||
      source.includes(q)
    ) {
      return true;
    }
    const keyParts = parseSessionKeyParts(row.key);
    const identityName = keyParts
      ? normalizeLowercaseStringOrEmpty(getAgentIdentity(agentIdentityById, keyParts.agentId)?.name)
      : "";
    return identityName.includes(q);
  });
}

function sortRows(
  rows: GatewaySessionRow[],
  column: "key" | "kind" | "updated" | "tokens",
  dir: "asc" | "desc",
): GatewaySessionRow[] {
  const cmp = dir === "asc" ? 1 : -1;
  return [...rows].toSorted((a, b) => {
    let diff = 0;
    switch (column) {
      case "key":
        diff = (a.key ?? "").localeCompare(b.key ?? "");
        break;
      case "kind":
        diff = (a.kind ?? "").localeCompare(b.kind ?? "");
        break;
      case "updated":
        diff = (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
        break;
      case "tokens":
        diff =
          (a.totalTokens ?? a.inputTokens ?? a.outputTokens ?? 0) -
          (b.totalTokens ?? b.inputTokens ?? b.outputTokens ?? 0);
        break;
    }
    return diff * cmp;
  });
}

function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  return rows.slice(page * pageSize, page * pageSize + pageSize);
}

function resolveSessionDisplay(props: SessionsProps): SessionsDisplay {
  const rawRows = props.result?.sessions ?? [];
  const filteredRows = filterRows(rawRows, props.searchQuery, props.agentIdentityById);
  const sortedRows = sortRows(filteredRows, props.sortColumn, props.sortDir);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / props.pageSize));
  const page = Math.min(props.page, totalPages - 1);
  const paginatedRows = paginateRows(sortedRows, page, props.pageSize);
  const views = paginatedRows.map((row) => resolveSessionView(row, props));
  const allViews = rawRows.map((row) => resolveSessionView(row, props));
  return {
    rawRows,
    filteredRows,
    sortedRows,
    paginatedRows,
    views,
    totalPages,
    page,
    activeCount: allViews.filter((view) => view.health === "active").length,
    staleCount: allViews.filter((view) => view.health === "stale").length,
    checkpointCount: rawRows.reduce((sum, row) => sum + (row.compactionCheckpointCount ?? 0), 0),
    overrideCount: allViews.filter((view) => view.hasOverrides).length,
  };
}

function resolveSessionView(row: GatewaySessionRow, props: SessionsProps): SessionView {
  const source = resolveSessionSource(row);
  const keyParts = parseSessionKeyParts(row.key);
  const agentIdentity = keyParts
    ? getAgentIdentity(props.agentIdentityById, keyParts.agentId)
    : null;
  const identityEmoji = normalizeOptionalString(agentIdentity?.emoji) ?? "";
  const identityName = normalizeOptionalString(agentIdentity?.name) ?? "";
  const friendlyKeyLabel =
    identityName && keyParts
      ? `${identityEmoji ? `${identityEmoji} ` : ""}${identityName} (${keyParts.channel})`
      : null;
  const hasOverrides = Boolean(
    row.thinkingLevel || row.fastMode != null || row.verboseLevel || row.reasoningLevel,
  );
  const health = resolveSessionHealth(row);
  return {
    row,
    title:
      normalizeOptionalString(row.label) ??
      normalizeOptionalString(row.displayName) ??
      friendlyKeyLabel ??
      deriveSessionTitle(row.key, source),
    keyLabel: friendlyKeyLabel ?? row.key,
    keyTitle: friendlyKeyLabel ?? row.key,
    source,
    sourceLabel: sourceLabel(source),
    health,
    statusLabel: row.status ?? health,
    updatedLabel: row.updatedAt ? formatRelativeTimestamp(row.updatedAt) : t("common.na"),
    agentLabel: resolveAgentLabel(row, agentIdentity),
    modelLabel: resolveModelLabel(row),
    tokenLabel: formatTokenLabel(row),
    tokenPercent: resolveTokenPercent(row),
    hasOverrides,
    canOpenChat: row.kind !== "global",
  };
}

function resolveSessionSource(row: GatewaySessionRow): SessionSource {
  const key = normalizeLowercaseStringOrEmpty(row.key);
  const surface = normalizeLowercaseStringOrEmpty(row.surface);
  if (row.kind === "global") {
    return "global";
  }
  if (key.includes("telegram") || surface.includes("telegram")) {
    return "telegram";
  }
  if (key.includes("discord") || surface.includes("discord")) {
    return "discord";
  }
  if (key.includes("cron") || surface.includes("cron")) {
    return "cron";
  }
  if (row.kind === "direct") {
    return "direct";
  }
  return "other";
}

function sourceLabel(source: SessionSource): string {
  switch (source) {
    case "telegram":
      return "Telegram";
    case "discord":
      return "Discord";
    case "cron":
      return "Cron";
    case "global":
      return "Global";
    case "direct":
      return "Direct";
    case "other":
      return "Other";
  }
  return "Other";
}

function sourceIcon(source: SessionSource): TemplateResult {
  switch (source) {
    case "telegram":
      return icons.send;
    case "discord":
      return icons.messageSquare;
    case "cron":
      return icons.scrollText;
    case "global":
      return icons.globe;
    case "direct":
      return icons.terminal;
    case "other":
      return icons.circle;
  }
  return icons.circle;
}

function deriveSessionTitle(key: string, source: SessionSource): string {
  const normalized = key.trim();
  const lower = normalized.toLowerCase();
  if (normalized === "agent:main:main" || normalized === "main") {
    return "Main Session";
  }
  if (source === "telegram") {
    const id = normalized.split(":").at(-1);
    return id ? `Telegram · @${id}` : "Telegram Session";
  }
  if (source === "discord") {
    return "Discord Session";
  }
  if (source === "cron") {
    return lower.includes("dream") ? "Memory Dreaming" : "Cron Session";
  }
  if (lower.includes("dreaming-narrative-rem")) {
    return "Memory Dream · rem";
  }
  if (lower.includes("dreaming-narrative-light")) {
    return "Memory Dream · light";
  }
  if (lower.includes("tui-")) {
    return "TUI Session";
  }
  const last = normalized.split(":").findLast(Boolean) ?? normalized;
  return last.length > 44 ? `${last.slice(0, 43)}…` : last;
}

function resolveSessionHealth(row: GatewaySessionRow): SessionHealth {
  if (!row.updatedAt) {
    return "unknown";
  }
  const age = Date.now() - row.updatedAt;
  if (!Number.isFinite(age) || age < 0) {
    return "unknown";
  }
  if (age < 60 * 60 * 1000) {
    return "active";
  }
  if (age < 24 * 60 * 60 * 1000) {
    return "idle";
  }
  return "stale";
}

function resolveAgentLabel(row: GatewaySessionRow, identity: AgentIdentityResult | null): string {
  const keyParts = parseSessionKeyParts(row.key);
  const agentId = keyParts?.agentId ?? "main";
  const identityName = normalizeOptionalString(identity?.name);
  return identityName ? `${identityName} · ${agentId}` : agentId;
}

function resolveModelLabel(row: GatewaySessionRow): string {
  if (row.modelProvider && row.model) {
    return `${row.modelProvider}/${row.model}`;
  }
  return row.model ?? row.modelProvider ?? "model inherit";
}

function formatTokenLabel(row: GatewaySessionRow): string {
  if (row.totalTokens == null) {
    return t("common.na");
  }
  if (row.contextTokens) {
    return `${formatTokens(row.totalTokens)} / ${formatTokens(row.contextTokens)}`;
  }
  return formatTokens(row.totalTokens);
}

function resolveTokenPercent(row: GatewaySessionRow): number | null {
  if (!row.totalTokens || !row.contextTokens || row.contextTokens <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, (row.totalTokens / row.contextTokens) * 100));
}

function tokenTone(percent: number | null): "ok" | "warn" | "danger" | "muted" {
  if (percent == null) {
    return "muted";
  }
  if (percent >= 80) {
    return "danger";
  }
  if (percent >= 50) {
    return "warn";
  }
  return "ok";
}

function formatCheckpointReason(reason: SessionCompactionCheckpoint["reason"]): string {
  switch (reason) {
    case "manual":
      return "manual";
    case "auto-threshold":
      return "auto-threshold";
    case "overflow-retry":
      return "overflow retry";
    case "timeout-retry":
      return "timeout retry";
    default:
      return reason;
  }
}

function formatCheckpointDelta(checkpoint: SessionCompactionCheckpoint): string {
  if (
    typeof checkpoint.tokensBefore === "number" &&
    typeof checkpoint.tokensAfter === "number" &&
    Number.isFinite(checkpoint.tokensBefore) &&
    Number.isFinite(checkpoint.tokensAfter)
  ) {
    return `${checkpoint.tokensBefore.toLocaleString()} → ${checkpoint.tokensAfter.toLocaleString()} tokens`;
  }
  if (typeof checkpoint.tokensBefore === "number" && Number.isFinite(checkpoint.tokensBefore)) {
    return `${checkpoint.tokensBefore.toLocaleString()} tokens before`;
  }
  return "token delta unavailable";
}

export function renderSessions(props: SessionsProps) {
  const display = resolveSessionDisplay(props);
  const pageKeys = display.paginatedRows.map((row) => row.key);
  const pageSelected = pageKeys.length > 0 && pageKeys.every((key) => props.selectedKeys.has(key));
  const pagePartiallySelected =
    pageKeys.some((key) => props.selectedKeys.has(key)) && !pageSelected;

  return html`
    <div class="sessions-console">
      ${renderSessionsCommandCenter(props, display)}
      ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}
      ${renderSessionsToolbar(props, display, pageSelected, pagePartiallySelected)}
      ${props.selectedKeys.size > 0 ? renderBulkBar(props) : nothing}
      ${renderSessionList(props, display)} ${renderPagination(props, display)}
    </div>
  `;
}

function renderSessionsCommandCenter(props: SessionsProps, display: SessionsDisplay) {
  return html`
    <section class="card sessions-command-center">
      <div class="sessions-command-center__head">
        <div>
          <div class="card-title">Sessions</div>
          <div class="card-sub">
            ${props.result
              ? `${display.rawRows.length} loaded · Store: ${props.result.path}`
              : "Conversation buckets, routing keys, token pressure, and per-session overrides."}
          </div>
        </div>
        <button class="btn primary" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>
      <div class="sessions-metric-grid">
        ${renderSessionMetric("Loaded", String(display.rawRows.length), "from gateway")}
        ${renderSessionMetric("Active", String(display.activeCount), "under 1 hour", "ok")}
        ${renderSessionMetric("Stale", String(display.staleCount), "over 24 hours")}
        ${renderSessionMetric("Overrides", String(display.overrideCount), "custom runtime prefs")}
        ${renderSessionMetric("Checkpoints", String(display.checkpointCount), "compaction saves")}
      </div>
    </section>
  `;
}

function renderSessionMetric(
  label: string,
  value: string,
  note: string,
  tone: "ok" | "warn" | "danger" | null = null,
) {
  return html`
    <div class="sessions-metric ${tone ? `is-${tone}` : ""}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </div>
  `;
}

function renderSessionsToolbar(
  props: SessionsProps,
  display: SessionsDisplay,
  pageSelected: boolean,
  pagePartiallySelected: boolean,
) {
  return html`
    <section class="card sessions-toolbar">
      <div class="sessions-toolbar__search">
        <span class="sessions-search-icon">${icons.search}</span>
        <input
          type="text"
          placeholder="Filter by key, agent, label, source..."
          .value=${props.searchQuery}
          @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="sessions-toolbar__filters">
        <label class="sessions-toggle">
          <input
            type="checkbox"
            .checked=${props.activeMinutes.trim() !== ""}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: (e.target as HTMLInputElement).checked ? "120" : "",
                limit: props.limit,
                includeGlobal: props.includeGlobal,
                includeUnknown: props.includeUnknown,
              })}
          />
          <span>Active only</span>
        </label>
        <label class="sessions-toggle">
          <input
            type="checkbox"
            .checked=${props.includeGlobal}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: props.limit,
                includeGlobal: (e.target as HTMLInputElement).checked,
                includeUnknown: props.includeUnknown,
              })}
          />
          <span>Global</span>
        </label>
        <label class="sessions-toggle">
          <input
            type="checkbox"
            .checked=${props.includeUnknown}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: props.limit,
                includeGlobal: props.includeGlobal,
                includeUnknown: (e.target as HTMLInputElement).checked,
              })}
          />
          <span>Unknown</span>
        </label>
      </div>
      <div class="sessions-toolbar__sort">
        ${renderSortButton(props, "updated", "Updated")}
        ${renderSortButton(props, "tokens", "Tokens")} ${renderSortButton(props, "key", "Key")}
        ${renderSortButton(props, "kind", "Kind")}
      </div>
      <label class="sessions-select-page">
        <input
          type="checkbox"
          .checked=${pageSelected}
          .indeterminate=${pagePartiallySelected}
          ?disabled=${display.paginatedRows.length === 0}
          @change=${() => {
            if (pageSelected) {
              props.onDeselectPage(display.paginatedRows.map((row) => row.key));
            } else {
              props.onSelectPage(display.paginatedRows.map((row) => row.key));
            }
          }}
          aria-label="Select all sessions on page"
        />
      </label>
    </section>
  `;
}

function renderSortButton(
  props: SessionsProps,
  column: "key" | "kind" | "updated" | "tokens",
  label: string,
) {
  const active = props.sortColumn === column;
  const nextDir = active && props.sortDir === "asc" ? ("desc" as const) : ("asc" as const);
  return html`
    <button
      class="sessions-sort ${active ? "active" : ""}"
      @click=${() => props.onSortChange(column, active ? nextDir : "desc")}
    >
      <span>${label}</span>
      <span class="sessions-sort__icon">${icons.arrowUpDown}</span>
    </button>
  `;
}

function renderBulkBar(props: SessionsProps) {
  return html`
    <section class="sessions-bulk-bar">
      <strong>${props.selectedKeys.size} selected</strong>
      <button class="btn btn--sm" @click=${props.onDeselectAll}>${t("common.unselect")}</button>
      <button
        class="btn btn--sm danger"
        ?disabled=${props.loading}
        @click=${props.onDeleteSelected}
      >
        ${icons.trash} Delete selected
      </button>
    </section>
  `;
}

function renderSessionList(props: SessionsProps, display: SessionsDisplay) {
  if (props.loading && display.rawRows.length === 0) {
    return html`
      <section class="card sessions-empty">
        <strong>Loading sessions</strong>
        <span>Reading active session state from the gateway.</span>
      </section>
    `;
  }
  if (display.views.length === 0) {
    return html`
      <section class="card sessions-empty">
        <strong>No sessions found</strong>
        <span>
          ${display.rawRows.length === 0
            ? "Start a chat or receive a channel message to create the first session."
            : "Try adjusting search or session filters."}
        </span>
      </section>
    `;
  }
  return html`
    <section class="sessions-list">
      ${display.views.map((view) => renderSessionCard(view, props))}
    </section>
  `;
}

function renderSessionCard(view: SessionView, props: SessionsProps) {
  const row = view.row;
  const checkpointCount = row.compactionCheckpointCount ?? 0;
  const isExpanded = props.expandedCheckpointKey === row.key;
  const selected = props.selectedKeys.has(row.key);
  const chatUrl = view.canOpenChat
    ? `${pathForTab("chat", props.basePath)}?session=${encodeURIComponent(row.key)}`
    : null;
  return html`
    <article class="sessions-card ${selected ? "is-selected" : ""}">
      <div class="sessions-card__select">
        <input
          type="checkbox"
          .checked=${selected}
          @change=${() => props.onToggleSelect(row.key)}
          aria-label="Select session"
        />
      </div>
      <div class="sessions-card__source sessions-source--${view.source}">
        <span>${sourceIcon(view.source)}</span>
        <small>${view.sourceLabel}</small>
      </div>
      <div class="sessions-card__main">
        <div class="sessions-card__topline">
          <span class="sessions-health-dot sessions-health-dot--${view.health}"></span>
          <div class="session-key-cell" title=${view.keyTitle}>
            ${chatUrl
              ? html`<a
                  href=${chatUrl}
                  class="session-link sessions-card__title"
                  @click=${(e: MouseEvent) => {
                    if (
                      e.defaultPrevented ||
                      e.button !== 0 ||
                      e.metaKey ||
                      e.ctrlKey ||
                      e.shiftKey ||
                      e.altKey
                    ) {
                      return;
                    }
                    if (props.onNavigateToChat) {
                      e.preventDefault();
                      props.onNavigateToChat(row.key);
                    }
                  }}
                  >${view.title}</a
                >`
              : html`<span class="sessions-card__title">${view.title}</span>`}
          </div>
        </div>
        <div class="sessions-card__key mono" title=${row.key}>${row.key}</div>
        <div class="sessions-card__badges">
          <span class="sessions-badge sessions-badge--${view.source}">${view.sourceLabel}</span>
          <span class="sessions-badge">${row.kind}</span>
          <span class="sessions-badge">${view.agentLabel}</span>
          ${view.hasOverrides
            ? html`<span class="sessions-badge is-warn">overrides</span>`
            : nothing}
          ${checkpointCount > 0
            ? html`<span class="sessions-badge">${checkpointCount} checkpoints</span>`
            : nothing}
        </div>
      </div>
      <div class="sessions-card__side">
        ${renderTokenMeter(view)}
        <div class="sessions-card__updated">${view.updatedLabel}</div>
        <div class="sessions-card__actions">
          ${chatUrl
            ? html`
                <button
                  class="btn btn--sm"
                  @click=${() => props.onNavigateToChat?.(row.key)}
                  title="Open in chat"
                >
                  ${icons.messageSquare}
                </button>
              `
            : nothing}
          <button
            class="btn btn--sm"
            title="Copy session key"
            @click=${() => void navigator.clipboard?.writeText(row.key)}
          >
            ${icons.copy}
          </button>
        </div>
      </div>
      <details class="sessions-card__details">
        <summary>Session controls</summary>
        ${renderSessionControls(view, props)}
      </details>
    </article>
    ${isExpanded ? renderCheckpointPanel(row, props) : nothing}
  `;
}

function renderTokenMeter(view: SessionView) {
  const tone = tokenTone(view.tokenPercent);
  return html`
    <div class="sessions-token sessions-token--${tone}">
      <div class="sessions-token__label">${view.tokenLabel}</div>
      ${view.tokenPercent == null
        ? nothing
        : html`
            <div class="sessions-token__bar">
              <span style=${`width: ${view.tokenPercent.toFixed(2)}%;`}></span>
            </div>
            <div class="sessions-token__percent">${Math.round(view.tokenPercent)}%</div>
          `}
    </div>
  `;
}

function renderSessionControls(view: SessionView, props: SessionsProps) {
  const row = view.row;
  const rawThinking = row.thinkingLevel ?? "";
  const thinking = rawThinking ? normalizeThinkingOptionValue(rawThinking) : "";
  const thinkLevels = withCurrentLabeledOption(resolveThinkLevelOptions(row), thinking);
  const fastMode = row.fastMode === true ? "on" : row.fastMode === false ? "off" : "";
  const fastLevels = withCurrentLabeledOption(FAST_LEVELS, fastMode);
  const verbose = row.verboseLevel ?? "";
  const verboseLevels = withCurrentLabeledOption(VERBOSE_LEVELS, verbose);
  const reasoning = row.reasoningLevel ?? "";
  const reasoningLevels = withCurrentOption(REASONING_LEVELS, reasoning);
  const checkpointCount = row.compactionCheckpointCount ?? 0;

  return html`
    <div class="sessions-detail-grid">
      ${renderSessionMeta("Key", row.key, true)} ${renderSessionMeta("Agent", view.agentLabel)}
      ${renderSessionMeta("Model", view.modelLabel)}
      ${renderSessionMeta("Status", view.statusLabel)}
      ${renderSessionMeta("Updated", view.updatedLabel)}
      ${renderSessionMeta("Tokens", view.tokenLabel)}
    </div>
    <div class="sessions-control-grid">
      <label class="field">
        <span>Label</span>
        <input
          .value=${row.label ?? ""}
          ?disabled=${props.loading}
          placeholder="Optional label"
          @change=${(e: Event) => {
            const value = normalizeOptionalString((e.target as HTMLInputElement).value) ?? null;
            props.onPatch(row.key, { label: value });
          }}
        />
      </label>
      ${renderSelectControl(
        "Thinking",
        thinking,
        thinkLevels,
        props.loading,
        (value) => props.onPatch(row.key, { thinkingLevel: resolveThinkLevelPatchValue(value) }),
        "thinking",
      )}
      ${renderSelectControl(
        "Fast",
        fastMode,
        fastLevels,
        props.loading,
        (value) => props.onPatch(row.key, { fastMode: value === "" ? null : value === "on" }),
        "fast",
      )}
      ${renderSelectControl(
        "Verbose",
        verbose,
        verboseLevels,
        props.loading,
        (value) => props.onPatch(row.key, { verboseLevel: value || null }),
        "verbose",
      )}
      ${renderSelectControl(
        "Reasoning",
        reasoning,
        reasoningLevels.map((value) => ({ value, label: value || "inherit" })),
        props.loading,
        (value) => props.onPatch(row.key, { reasoningLevel: value || null }),
        "reasoning",
      )}
    </div>
    <div class="sessions-compaction-row">
      <div>
        <strong>Compaction</strong>
        <span>
          ${checkpointCount > 0
            ? `${checkpointCount} checkpoint${checkpointCount === 1 ? "" : "s"}`
            : "No checkpoints recorded"}
        </span>
      </div>
      <button
        class="btn btn--sm"
        ?disabled=${props.checkpointLoadingKey === row.key}
        @click=${() => props.onToggleCheckpointDetails(row.key)}
      >
        ${props.expandedCheckpointKey === row.key ? "Hide checkpoints" : "Show checkpoints"}
      </button>
    </div>
  `;
}

function renderSessionMeta(label: string, value: string, mono = false) {
  return html`
    <div class="sessions-meta-row">
      <span>${label}</span>
      <strong class=${mono ? "mono" : ""}>${value}</strong>
    </div>
  `;
}

function renderSelectControl(
  label: string,
  value: string,
  options: readonly { value: string; label: string }[],
  disabled: boolean,
  onChange: (value: string) => void,
  controlId: string,
) {
  return html`
    <label class="field">
      <span>${label}</span>
      <select
        data-session-control=${controlId}
        ?disabled=${disabled}
        @change=${(e: Event) => onChange((e.target as HTMLSelectElement).value)}
      >
        ${options.map(
          (option) =>
            html`<option value=${option.value} ?selected=${value === option.value}>
              ${option.label}
            </option>`,
        )}
      </select>
    </label>
  `;
}

function renderCheckpointPanel(row: GatewaySessionRow, props: SessionsProps) {
  const checkpointItems = props.checkpointItemsByKey[row.key] ?? [];
  const checkpointError = props.checkpointErrorByKey[row.key];
  return html`
    <section class="card sessions-checkpoints">
      <div class="sessions-section-head">
        <div>
          <div class="card-title">Checkpoints</div>
          <div class="card-sub">${row.key}</div>
        </div>
      </div>
      ${props.checkpointLoadingKey === row.key
        ? html`<div class="muted">Loading checkpoints…</div>`
        : checkpointError
          ? html`<div class="callout danger">${checkpointError}</div>`
          : checkpointItems.length === 0
            ? html`<div class="muted">No compaction checkpoints recorded for this session.</div>`
            : html`
                <div class="sessions-checkpoint-list">
                  ${checkpointItems.map((checkpoint) => renderCheckpoint(row, checkpoint, props))}
                </div>
              `}
    </section>
  `;
}

function renderCheckpoint(
  row: GatewaySessionRow,
  checkpoint: SessionCompactionCheckpoint,
  props: SessionsProps,
) {
  return html`
    <article class="sessions-checkpoint">
      <div class="sessions-checkpoint__head">
        <strong>
          ${formatCheckpointReason(checkpoint.reason)} ·
          ${formatRelativeTimestamp(checkpoint.createdAt)}
        </strong>
        <span>${formatCheckpointDelta(checkpoint)}</span>
      </div>
      ${checkpoint.summary
        ? html`<div class="sessions-checkpoint__summary">${checkpoint.summary}</div>`
        : html`<div class="muted">No summary captured.</div>`}
      <div class="sessions-checkpoint__actions">
        <button
          class="btn btn--sm"
          ?disabled=${props.checkpointBusyKey === checkpoint.checkpointId}
          @click=${() => props.onBranchFromCheckpoint(row.key, checkpoint.checkpointId)}
        >
          Branch from checkpoint
        </button>
        <button
          class="btn btn--sm"
          ?disabled=${props.checkpointBusyKey === checkpoint.checkpointId}
          @click=${() => props.onRestoreCheckpoint(row.key, checkpoint.checkpointId)}
        >
          Restore
        </button>
      </div>
    </article>
  `;
}

function renderPagination(props: SessionsProps, display: SessionsDisplay) {
  if (display.sortedRows.length === 0) {
    return nothing;
  }
  const start = display.page * props.pageSize + 1;
  const end = Math.min((display.page + 1) * props.pageSize, display.sortedRows.length);
  return html`
    <section class="sessions-pagination">
      <label>
        <span>Per page</span>
        <select
          .value=${String(props.pageSize)}
          @change=${(e: Event) =>
            props.onPageSizeChange(Number((e.target as HTMLSelectElement).value))}
        >
          ${PAGE_SIZES.map((size) => html`<option value=${size}>${size}</option>`)}
        </select>
      </label>
      <div class="sessions-pagination__controls">
        <button
          class="btn btn--sm"
          ?disabled=${display.page <= 0}
          @click=${() => props.onPageChange(display.page - 1)}
        >
          Previous
        </button>
        <span>Page ${display.page + 1} of ${display.totalPages}</span>
        <button
          class="btn btn--sm"
          ?disabled=${display.page >= display.totalPages - 1}
          @click=${() => props.onPageChange(display.page + 1)}
        >
          Next
        </button>
      </div>
      <div class="sessions-pagination__count">
        ${start}-${end} of ${display.sortedRows.length} sessions
      </div>
    </section>
  `;
}
