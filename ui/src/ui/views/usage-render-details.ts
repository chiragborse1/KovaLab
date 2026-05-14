import { html, nothing, svg } from "lit";
import { formatDurationCompact } from "../../../../src/infra/format-time/format-duration.ts";
import { t } from "../../i18n/index.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import { parseToolSummary } from "../usage-helpers.ts";
import { charsToTokens, formatCost, formatTokens } from "./usage-metrics.ts";
import {
  SessionLogEntry,
  SessionLogRole,
  TimeSeriesPoint,
  UsageSessionEntry,
} from "./usageTypes.ts";

const CHART_BAR_WIDTH_RATIO = 0.75;
const CHART_MAX_BAR_WIDTH = 8;

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function normalizeLogTimestamp(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
}

function filterLogsByRange(
  logs: SessionLogEntry[],
  rangeStart: number,
  rangeEnd: number,
): SessionLogEntry[] {
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  return logs.filter((log) => {
    if (log.timestamp <= 0) {
      return true;
    }
    const ts = normalizeLogTimestamp(log.timestamp);
    return ts >= lo && ts <= hi;
  });
}

function formatTimestamp(ts?: number): string {
  if (!ts) {
    return t("usage.common.emptyValue");
  }
  return new Date(ts).toLocaleString();
}

function renderSessionSummary(
  session: UsageSessionEntry,
  filteredUsage?: UsageSessionEntry["usage"],
  filteredLogs?: SessionLogEntry[],
) {
  const usage = filteredUsage || session.usage;
  if (!usage) {
    return html`<div class="usage-empty-block">${t("usage.details.noUsageData")}</div>`;
  }

  const toolCounts = new Map<string, number>();
  if (filteredLogs) {
    for (const log of filteredLogs) {
      const { tools } = parseToolSummary(log.content);
      for (const [name, count] of tools) {
        toolCounts.set(name, (toolCounts.get(name) ?? 0) + count);
      }
    }
  }
  const toolCallCount = filteredLogs
    ? [...toolCounts.values()].reduce((sum, count) => sum + count, 0)
    : (usage.toolUsage?.totalCalls ?? 0);
  const uniqueToolCount = filteredLogs ? toolCounts.size : (usage.toolUsage?.uniqueTools ?? 0);

  const badges = [
    session.channel ? `${t("usage.filters.channel")}:${session.channel}` : "",
    session.agentId ? `${t("usage.filters.agent")}:${session.agentId}` : "",
    session.modelProvider || session.providerOverride
      ? `${t("usage.filters.provider")}:${session.modelProvider ?? session.providerOverride}`
      : "",
    session.model ? `${t("usage.filters.model")}:${session.model}` : "",
  ].filter(Boolean);

  return html`
    ${badges.length > 0
      ? html`<div class="usage-detail-badges">
          ${badges.map((badge) => html`<span>${badge}</span>`)}
        </div>`
      : nothing}
    <div class="usage-detail-metrics">
      <div>
        <span>${t("usage.metrics.tokens")}</span>
        <strong>${formatTokens(usage.totalTokens ?? 0)}</strong>
        <small>${formatCost(usage.totalCost ?? 0)}</small>
      </div>
      <div>
        <span>${t("usage.overview.messages")}</span>
        <strong>${usage.messageCounts?.total ?? 0}</strong>
        <small>
          ${usage.messageCounts?.user ?? 0}
          ${normalizeLowercaseStringOrEmpty(t("usage.overview.user"))} ·
          ${usage.messageCounts?.assistant ?? 0}
          ${normalizeLowercaseStringOrEmpty(t("usage.overview.assistant"))}
        </small>
      </div>
      <div>
        <span>${t("usage.overview.toolCalls")}</span>
        <strong>${toolCallCount}</strong>
        <small>${uniqueToolCount} ${t("usage.overview.toolsUsed")}</small>
      </div>
      <div>
        <span>${t("usage.details.duration")}</span>
        <strong>
          ${formatDurationCompact(usage.durationMs, { spaced: true }) ??
          t("usage.common.emptyValue")}
        </strong>
        <small
          >${formatTimestamp(usage.firstActivity)} → ${formatTimestamp(usage.lastActivity)}</small
        >
      </div>
    </div>
  `;
}

function computeFilteredUsage(
  baseUsage: NonNullable<UsageSessionEntry["usage"]>,
  points: TimeSeriesPoint[],
  rangeStart: number,
  rangeEnd: number,
): UsageSessionEntry["usage"] | undefined {
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  const filtered = points.filter((point) => point.timestamp >= lo && point.timestamp <= hi);
  if (filtered.length === 0) {
    return undefined;
  }

  let totalTokens = 0;
  let totalCost = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;

  for (const point of filtered) {
    totalTokens += point.totalTokens || 0;
    totalCost += point.cost || 0;
    totalInput += point.input || 0;
    totalOutput += point.output || 0;
    totalCacheRead += point.cacheRead || 0;
    totalCacheWrite += point.cacheWrite || 0;
    if (point.output > 0) {
      assistantMessages++;
    }
    if (point.input > 0) {
      userMessages++;
    }
  }

  return {
    ...baseUsage,
    totalTokens,
    totalCost,
    input: totalInput,
    output: totalOutput,
    cacheRead: totalCacheRead,
    cacheWrite: totalCacheWrite,
    durationMs: filtered[filtered.length - 1].timestamp - filtered[0].timestamp,
    firstActivity: filtered[0].timestamp,
    lastActivity: filtered[filtered.length - 1].timestamp,
    messageCounts: {
      total: filtered.length,
      user: userMessages,
      assistant: assistantMessages,
      toolCalls: 0,
      toolResults: 0,
      errors: 0,
    },
  };
}

function renderTimeSeriesCompact(
  timeSeries: { points: TimeSeriesPoint[] } | null,
  loading: boolean,
  mode: "cumulative" | "per-turn",
  onModeChange: (mode: "cumulative" | "per-turn") => void,
  breakdownMode: "total" | "by-type",
  onBreakdownChange: (mode: "total" | "by-type") => void,
  startDate?: string,
  endDate?: string,
  selectedDays?: string[],
  cursorStart?: number | null,
  cursorEnd?: number | null,
  onCursorRangeChange?: (start: number | null, end: number | null) => void,
) {
  void cursorStart;
  void cursorEnd;
  void onCursorRangeChange;

  if (loading) {
    return html`
      <section class="usage-detail-section">
        <div class="usage-section-heading">
          <span>${t("usage.details.usageOverTime")}</span>
          <small>${t("usage.loading.badge")}</small>
        </div>
        <div class="usage-empty-block">${t("usage.loading.badge")}</div>
      </section>
    `;
  }
  if (!timeSeries || timeSeries.points.length < 2) {
    return html`
      <section class="usage-detail-section">
        <div class="usage-section-heading">
          <span>${t("usage.details.usageOverTime")}</span>
          <small>${t("usage.details.noTimeline")}</small>
        </div>
        <div class="usage-empty-block">${t("usage.details.noTimeline")}</div>
      </section>
    `;
  }

  let points = timeSeries.points;
  if (startDate || endDate || selectedDays?.length) {
    const startTs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
    const endTs = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Infinity;
    points = points.filter((point) => {
      if (point.timestamp < startTs || point.timestamp > endTs) {
        return false;
      }
      if (selectedDays?.length) {
        const date = new Date(point.timestamp);
        const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0",
        )}-${String(date.getDate()).padStart(2, "0")}`;
        return selectedDays.includes(ymd);
      }
      return true;
    });
  }
  if (points.length < 2) {
    return html`
      <section class="usage-detail-section">
        <div class="usage-section-heading">
          <span>${t("usage.details.usageOverTime")}</span>
          <small>${t("usage.details.noDataInRange")}</small>
        </div>
        <div class="usage-empty-block">${t("usage.details.noDataInRange")}</div>
      </section>
    `;
  }

  let cumulativeTokens = 0;
  let cumulativeCost = 0;
  points = points.map((point) => {
    cumulativeTokens += point.totalTokens;
    cumulativeCost += point.cost;
    return { ...point, cumulativeTokens, cumulativeCost };
  });

  const width = 520;
  const height = 160;
  const padding = { top: 18, right: 16, bottom: 24, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const byType = mode === "per-turn" && breakdownMode === "by-type";
  const values = points.map((point) =>
    mode === "cumulative"
      ? point.cumulativeTokens
      : byType
        ? point.input + point.output + point.cacheRead + point.cacheWrite
        : point.totalTokens,
  );
  const maxValue = Math.max(...values, 1);
  const slot = chartWidth / points.length;
  const barWidth = Math.min(CHART_MAX_BAR_WIDTH, Math.max(1, slot * CHART_BAR_WIDTH_RATIO));

  return html`
    <section class="usage-detail-section">
      <div class="usage-section-heading usage-section-heading--controls">
        <span>${t("usage.details.usageOverTime")}</span>
        <small>${points.length} ${t("usage.overview.messagesAbbrev")}</small>
        <div class="usage-segmented">
          <button
            class=${mode === "per-turn" ? "active" : ""}
            @click=${() => onModeChange("per-turn")}
          >
            ${t("usage.details.perTurn")}
          </button>
          <button
            class=${mode === "cumulative" ? "active" : ""}
            @click=${() => onModeChange("cumulative")}
          >
            ${t("usage.details.cumulative")}
          </button>
          ${mode === "per-turn"
            ? html`
                <button
                  class=${breakdownMode === "by-type" ? "active" : ""}
                  @click=${() =>
                    onBreakdownChange(breakdownMode === "by-type" ? "total" : "by-type")}
                >
                  ${breakdownMode === "by-type" ? t("usage.daily.total") : t("usage.daily.byType")}
                </button>
              `
            : nothing}
        </div>
      </div>
      <div class="usage-timeseries">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <line
            x1=${padding.left}
            y1=${padding.top + chartHeight}
            x2=${padding.left + chartWidth}
            y2=${padding.top + chartHeight}
            class="usage-wave-axis"
          ></line>
          ${points.map((point, index) => {
            const x = padding.left + index * slot + (slot - barWidth) / 2;
            const value = values[index];
            const barHeight = Math.max(2, (value / maxValue) * chartHeight);
            let yCursor = padding.top + chartHeight;
            if (!byType) {
              return svg`
                <rect
                  x=${x}
                  y=${yCursor - barHeight}
                  width=${barWidth}
                  height=${barHeight}
                  class="usage-timeseries-bar"
                >
                  <title>${new Date(point.timestamp).toLocaleString()} · ${formatTokens(value)}</title>
                </rect>
              `;
            }
            const segments = [
              { value: point.output, cls: "output" },
              { value: point.input, cls: "input" },
              { value: point.cacheWrite, cls: "cache-write" },
              { value: point.cacheRead, cls: "cache-read" },
            ];
            const total = value || 1;
            return svg`
              ${segments.map((segment) => {
                if (segment.value <= 0) {
                  return nothing;
                }
                const h = barHeight * (segment.value / total);
                yCursor -= h;
                return svg`
                  <rect
                    x=${x}
                    y=${yCursor}
                    width=${barWidth}
                    height=${h}
                    class="usage-timeseries-bar usage-timeseries-bar--${segment.cls}"
                  >
                    <title>${new Date(point.timestamp).toLocaleString()} · ${formatTokens(
                      segment.value,
                    )}</title>
                  </rect>
                `;
              })}
            `;
          })}
        </svg>
      </div>
      <div class="usage-timeseries-summary">
        <span>${formatTokens(cumulativeTokens)}</span>
        <span>${formatCost(cumulativeCost)}</span>
        <span>
          ${new Date(points[0].timestamp).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          →
          ${new Date(points[points.length - 1].timestamp).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </section>
  `;
}

function renderContextPanel(
  contextWeight: UsageSessionEntry["contextWeight"],
  usage: UsageSessionEntry["usage"],
  expanded: boolean,
  onToggleExpanded: () => void,
) {
  if (!contextWeight) {
    return html`
      <section class="usage-detail-section">
        <div class="usage-section-heading">
          <span>${t("usage.details.systemPromptBreakdown")}</span>
          <small>${t("usage.details.noContextData")}</small>
        </div>
        <div class="usage-empty-block">${t("usage.details.noContextData")}</div>
      </section>
    `;
  }

  const systemTokens = charsToTokens(contextWeight.systemPrompt.chars);
  const skillsTokens = charsToTokens(contextWeight.skills.promptChars);
  const toolsTokens = charsToTokens(
    contextWeight.tools.listChars + contextWeight.tools.schemaChars,
  );
  const filesTokens = charsToTokens(
    contextWeight.injectedWorkspaceFiles.reduce((sum, file) => sum + file.injectedChars, 0),
  );
  const totalContextTokens = systemTokens + skillsTokens + toolsTokens + filesTokens;
  const inputTokens = usage ? usage.input + usage.cacheRead : 0;
  const contextPct =
    inputTokens > 0
      ? `~${Math.min((totalContextTokens / inputTokens) * 100, 100).toFixed(0)}%`
      : "";
  const groups = [
    { label: t("usage.details.systemShort"), value: systemTokens, cls: "system" },
    { label: t("usage.details.skills"), value: skillsTokens, cls: "skills" },
    { label: t("usage.details.tools"), value: toolsTokens, cls: "tools" },
    { label: t("usage.details.files"), value: filesTokens, cls: "files" },
  ];
  const details = [
    ...contextWeight.skills.entries.map((entry) => ({
      type: t("usage.details.skills"),
      name: entry.name,
      tokens: charsToTokens(entry.blockChars),
    })),
    ...contextWeight.tools.entries.map((entry) => ({
      type: t("usage.details.tools"),
      name: entry.name,
      tokens: charsToTokens(entry.summaryChars + entry.schemaChars),
    })),
    ...contextWeight.injectedWorkspaceFiles.map((entry) => ({
      type: t("usage.details.files"),
      name: entry.name,
      tokens: charsToTokens(entry.injectedChars),
    })),
  ].toSorted((a, b) => b.tokens - a.tokens);
  const visibleDetails = expanded ? details : details.slice(0, 6);

  return html`
    <section class="usage-detail-section">
      <div class="usage-section-heading usage-section-heading--controls">
        <span>${t("usage.details.systemPromptBreakdown")}</span>
        <small>
          ~${formatTokens(totalContextTokens)}
          ${contextPct ? ` · ${contextPct} ${t("usage.details.ofInput")}` : ""}
        </small>
        ${details.length > 6
          ? html`
              <button class="usage-small-button" @click=${onToggleExpanded}>
                ${expanded ? t("usage.details.collapse") : t("usage.details.expandAll")}
              </button>
            `
          : nothing}
      </div>
      <div class="usage-context-bar">
        ${groups.map(
          (group) => html`
            <i
              class="usage-context-segment usage-context-segment--${group.cls}"
              style="width: ${pct(group.value, totalContextTokens).toFixed(2)}%"
              title="${group.label}: ~${formatTokens(group.value)}"
            ></i>
          `,
        )}
      </div>
      <div class="usage-context-legend">
        ${groups.map(
          (group) => html`
            <span>
              <i class="usage-context-dot usage-context-dot--${group.cls}"></i>
              ${group.label}
              <strong>~${formatTokens(group.value)}</strong>
            </span>
          `,
        )}
      </div>
      ${visibleDetails.length > 0
        ? html`
            <div class="usage-context-list">
              ${visibleDetails.map(
                (entry) => html`
                  <div>
                    <span>${entry.type}</span>
                    <strong>${entry.name}</strong>
                    <small>~${formatTokens(entry.tokens)}</small>
                  </div>
                `,
              )}
            </div>
          `
        : nothing}
    </section>
  `;
}

function renderSessionLogsCompact(
  logs: SessionLogEntry[] | null,
  loading: boolean,
  expandedAll: boolean,
  onToggleExpandedAll: () => void,
  filters: {
    roles: SessionLogRole[];
    tools: string[];
    hasTools: boolean;
    query: string;
  },
  onFilterRolesChange: (next: SessionLogRole[]) => void,
  onFilterToolsChange: (next: string[]) => void,
  onFilterHasToolsChange: (next: boolean) => void,
  onFilterQueryChange: (next: string) => void,
  onFilterClear: () => void,
  cursorStart?: number | null,
  cursorEnd?: number | null,
) {
  void onFilterToolsChange;

  if (loading) {
    return html`
      <section class="usage-detail-section">
        <div class="usage-section-heading">
          <span>${t("usage.details.conversation")}</span>
          <small>${t("usage.loading.badge")}</small>
        </div>
        <div class="usage-empty-block">${t("usage.loading.badge")}</div>
      </section>
    `;
  }
  if (!logs?.length) {
    return html`
      <section class="usage-detail-section">
        <div class="usage-section-heading">
          <span>${t("usage.details.conversation")}</span>
          <small>${t("usage.details.noMessages")}</small>
        </div>
        <div class="usage-empty-block">${t("usage.details.noMessages")}</div>
      </section>
    `;
  }

  const roleSelected = new Set(filters.roles);
  const query = normalizeLowercaseStringOrEmpty(filters.query);
  const baseLogs =
    cursorStart != null && cursorEnd != null
      ? filterLogsByRange(logs, cursorStart, cursorEnd)
      : logs;
  const entries = baseLogs
    .map((log) => {
      const toolInfo = parseToolSummary(log.content);
      const cleanContent = toolInfo.cleanContent || log.content;
      return { log, toolInfo, cleanContent };
    })
    .filter((entry) => {
      if (filters.roles.length > 0 && !filters.roles.includes(entry.log.role)) {
        return false;
      }
      if (filters.hasTools && entry.toolInfo.tools.length === 0) {
        return false;
      }
      if (filters.tools.length > 0) {
        const tools = entry.toolInfo.tools.map(([name]) => name);
        if (!tools.some((name) => filters.tools.includes(name))) {
          return false;
        }
      }
      if (query && !normalizeLowercaseStringOrEmpty(entry.cleanContent).includes(query)) {
        return false;
      }
      return true;
    });
  const hasFilters =
    filters.roles.length > 0 || filters.hasTools || filters.tools.length > 0 || query;
  const roles: SessionLogRole[] = ["user", "assistant", "tool", "toolResult"];

  return html`
    <section class="usage-detail-section">
      <div class="usage-section-heading usage-section-heading--controls">
        <span>${t("usage.details.conversation")}</span>
        <small
          >${entries.length} ${normalizeLowercaseStringOrEmpty(t("usage.overview.messages"))}</small
        >
        <button class="usage-small-button" @click=${onToggleExpandedAll}>
          ${expandedAll ? t("usage.details.collapseAll") : t("usage.details.expandAll")}
        </button>
      </div>
      <div class="usage-log-toolbar">
        <div class="usage-role-pills">
          ${roles.map(
            (role) => html`
              <button
                class=${roleSelected.has(role) ? "active" : ""}
                @click=${() => {
                  const next = roleSelected.has(role)
                    ? filters.roles.filter((entry) => entry !== role)
                    : [...filters.roles, role];
                  onFilterRolesChange(next);
                }}
              >
                ${role}
              </button>
            `,
          )}
          <button
            class=${filters.hasTools ? "active" : ""}
            @click=${() => onFilterHasToolsChange(!filters.hasTools)}
          >
            ${t("usage.details.hasTools")}
          </button>
        </div>
        <input
          type="text"
          placeholder=${t("usage.details.searchConversation")}
          .value=${filters.query}
          @input=${(event: Event) => onFilterQueryChange((event.target as HTMLInputElement).value)}
        />
        ${hasFilters
          ? html`
              <button class="usage-small-button" @click=${onFilterClear}>
                ${t("usage.filters.clear")}
              </button>
            `
          : nothing}
      </div>
      <div class="usage-log-list">
        ${entries.length === 0
          ? html`<div class="usage-empty-block">${t("usage.details.noMessagesMatch")}</div>`
          : entries.slice(0, expandedAll ? entries.length : 8).map((entry) => {
              const roleLabel =
                entry.log.role === "user"
                  ? t("usage.details.you")
                  : entry.log.role === "assistant"
                    ? t("usage.overview.assistant")
                    : t("usage.details.tool");
              return html`
                <article class="usage-log-entry usage-log-entry--${entry.log.role}">
                  <header>
                    <strong>${roleLabel}</strong>
                    <span>${new Date(entry.log.timestamp).toLocaleString()}</span>
                    ${entry.log.tokens
                      ? html`<span>${formatTokens(entry.log.tokens)}</span>`
                      : nothing}
                  </header>
                  <p>${entry.cleanContent}</p>
                  ${entry.toolInfo.tools.length > 0
                    ? html`
                        <div class="usage-log-tools">
                          ${entry.toolInfo.tools.map(
                            ([name, count]) => html`<span>${name} × ${count}</span>`,
                          )}
                        </div>
                      `
                    : nothing}
                </article>
              `;
            })}
        ${!expandedAll && entries.length > 8
          ? html`
              <button class="usage-log-more" @click=${onToggleExpandedAll}>
                ${t("usage.sessions.more", { count: String(entries.length - 8) })}
              </button>
            `
          : nothing}
      </div>
    </section>
  `;
}

function renderSessionDetailPanel(
  session: UsageSessionEntry,
  timeSeries: { points: TimeSeriesPoint[] } | null,
  timeSeriesLoading: boolean,
  timeSeriesMode: "cumulative" | "per-turn",
  onTimeSeriesModeChange: (mode: "cumulative" | "per-turn") => void,
  timeSeriesBreakdownMode: "total" | "by-type",
  onTimeSeriesBreakdownChange: (mode: "total" | "by-type") => void,
  timeSeriesCursorStart: number | null,
  timeSeriesCursorEnd: number | null,
  onTimeSeriesCursorRangeChange: (start: number | null, end: number | null) => void,
  startDate: string,
  endDate: string,
  selectedDays: string[],
  sessionLogs: SessionLogEntry[] | null,
  sessionLogsLoading: boolean,
  sessionLogsExpanded: boolean,
  onToggleSessionLogsExpanded: () => void,
  logFilters: {
    roles: SessionLogRole[];
    tools: string[];
    hasTools: boolean;
    query: string;
  },
  onLogFilterRolesChange: (next: SessionLogRole[]) => void,
  onLogFilterToolsChange: (next: string[]) => void,
  onLogFilterHasToolsChange: (next: boolean) => void,
  onLogFilterQueryChange: (next: string) => void,
  onLogFilterClear: () => void,
  contextExpanded: boolean,
  onToggleContextExpanded: () => void,
  onClose: () => void,
) {
  const label = session.label || session.key;
  const filteredUsage =
    timeSeriesCursorStart !== null &&
    timeSeriesCursorEnd !== null &&
    timeSeries?.points &&
    session.usage
      ? computeFilteredUsage(
          session.usage,
          timeSeries.points,
          timeSeriesCursorStart,
          timeSeriesCursorEnd,
        )
      : undefined;
  const filteredLogs =
    timeSeriesCursorStart !== null && timeSeriesCursorEnd !== null && sessionLogs
      ? filterLogsByRange(sessionLogs, timeSeriesCursorStart, timeSeriesCursorEnd)
      : undefined;

  return html`
    <aside class="usage-session-detail">
      <div class="usage-session-detail__header">
        <div>
          <div class="usage-session-detail__eyebrow">
            ${t("usage.sessions.selected", { count: "1" })}
          </div>
          <h3>${label}</h3>
          <p>${session.key}</p>
        </div>
        <button class="usage-small-button" @click=${onClose} title=${t("usage.details.close")}>
          ×
        </button>
      </div>
      ${renderSessionSummary(session, filteredUsage, filteredLogs)}
      ${renderTimeSeriesCompact(
        timeSeries,
        timeSeriesLoading,
        timeSeriesMode,
        onTimeSeriesModeChange,
        timeSeriesBreakdownMode,
        onTimeSeriesBreakdownChange,
        startDate,
        endDate,
        selectedDays,
        timeSeriesCursorStart,
        timeSeriesCursorEnd,
        onTimeSeriesCursorRangeChange,
      )}
      <div class="usage-detail-grid">
        ${renderSessionLogsCompact(
          sessionLogs,
          sessionLogsLoading,
          sessionLogsExpanded,
          onToggleSessionLogsExpanded,
          logFilters,
          onLogFilterRolesChange,
          onLogFilterToolsChange,
          onLogFilterHasToolsChange,
          onLogFilterQueryChange,
          onLogFilterClear,
          timeSeriesCursorStart,
          timeSeriesCursorEnd,
        )}
        ${renderContextPanel(
          session.contextWeight,
          session.usage,
          contextExpanded,
          onToggleContextExpanded,
        )}
      </div>
    </aside>
  `;
}

export {
  computeFilteredUsage,
  renderContextPanel,
  renderSessionDetailPanel,
  renderSessionLogsCompact,
  renderSessionSummary,
  renderTimeSeriesCompact,
  CHART_BAR_WIDTH_RATIO,
  CHART_MAX_BAR_WIDTH,
};
