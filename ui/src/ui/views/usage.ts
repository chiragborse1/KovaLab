import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { filterSessionsByQuery } from "../usage-helpers.ts";
import {
  buildAggregatesFromSessions,
  buildPeakErrorHours,
  buildUsageInsightStats,
  formatCost,
  formatIsoDate,
  formatTokens,
  getZonedHour,
  setToHourEnd,
} from "./usage-metrics.ts";
import { buildDailyCsv, buildSessionsCsv, downloadTextFile } from "./usage-query.ts";
import { renderSessionDetailPanel } from "./usage-render-details.ts";
import {
  renderCostBreakdownCompact,
  renderDailyChartCompact,
  renderFilterChips,
  renderSessionsCard,
  renderUsageInsights,
} from "./usage-render-overview.ts";
import {
  SessionLogEntry,
  SessionLogRole,
  UsageColumnId,
  UsageFilterState,
  UsageProps,
  UsageSessionEntry,
  UsageTotals,
} from "./usageTypes.ts";

export type { UsageColumnId, SessionLogEntry, SessionLogRole };

function createEmptyUsageTotals(): UsageTotals {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    totalCost: 0,
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheWriteCost: 0,
    missingCostEntries: 0,
  };
}

function addUsageTotals(
  acc: UsageTotals,
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    totalCost: number;
    inputCost?: number;
    outputCost?: number;
    cacheReadCost?: number;
    cacheWriteCost?: number;
    missingCostEntries?: number;
  },
): UsageTotals {
  acc.input += usage.input;
  acc.output += usage.output;
  acc.cacheRead += usage.cacheRead;
  acc.cacheWrite += usage.cacheWrite;
  acc.totalTokens += usage.totalTokens;
  acc.totalCost += usage.totalCost;
  acc.inputCost += usage.inputCost ?? 0;
  acc.outputCost += usage.outputCost ?? 0;
  acc.cacheReadCost += usage.cacheReadCost ?? 0;
  acc.cacheWriteCost += usage.cacheWriteCost ?? 0;
  acc.missingCostEntries += usage.missingCostEntries ?? 0;
  return acc;
}

function renderUsageLoadingState(filters: UsageFilterState) {
  return html`
    <section class="usage-loading-panel">
      <div>
        <div class="usage-page-title">${t("usage.loading.title")}</div>
        <div class="usage-page-subtitle">${t("usage.page.subtitle")}</div>
      </div>
      <div class="usage-loading-controls">
        <input class="usage-date-input" type="date" .value=${filters.startDate} disabled />
        <span>${t("usage.filters.to")}</span>
        <input class="usage-date-input" type="date" .value=${filters.endDate} disabled />
      </div>
      <div class="usage-loading-grid">
        <div class="usage-skeleton-block usage-skeleton-block--wide"></div>
        <div class="usage-skeleton-block"></div>
        <div class="usage-skeleton-block"></div>
      </div>
    </section>
  `;
}

function renderUsageEmptyState(onRefresh: () => void) {
  return html`
    <section class="usage-empty-state">
      <div class="usage-empty-state__title">${t("usage.empty.title")}</div>
      <div class="usage-empty-state__subtitle">${t("usage.empty.subtitle")}</div>
      <div class="usage-empty-state__features">
        <span>${t("usage.empty.featureOverview")}</span>
        <span>${t("usage.empty.featureSessions")}</span>
        <span>${t("usage.empty.featureTimeline")}</span>
      </div>
      <button class="btn primary" @click=${onRefresh}>${t("common.refresh")}</button>
    </section>
  `;
}

function computeSessionTotals(sessions: UsageSessionEntry[]): UsageTotals {
  return sessions.reduce(
    (acc, session) => (session.usage ? addUsageTotals(acc, session.usage) : acc),
    createEmptyUsageTotals(),
  );
}

function renderUsageToolbar(props: {
  filters: UsageProps["filters"];
  display: UsageProps["display"];
  data: UsageProps["data"];
  filteredSessions: UsageSessionEntry[];
  filteredDaily: UsageProps["data"]["costDaily"];
  displayTotals: UsageTotals | null;
  queryWarnings: string[];
  totalSessions: number;
  onPreset: (days: number) => void;
  callbacks: UsageProps["callbacks"];
}) {
  const { filters, display, data, callbacks } = props;
  const filterActions = callbacks.filters;
  const displayActions = callbacks.display;
  const exportStamp = formatIsoDate(new Date());
  const hasQuery = filters.query.trim().length > 0;
  const hasDraftQuery = filters.queryDraft.trim().length > 0;

  return html`
    <section class="usage-toolbar">
      <div class="usage-toolbar__title">
        <div class="usage-page-title">${t("tabs.usage")}</div>
        <div class="usage-page-subtitle">${t("usage.page.subtitle")}</div>
      </div>
      <div class="usage-toolbar__actions">
        <div class="usage-presets">
          <button class="usage-small-button" @click=${() => props.onPreset(1)}>
            ${t("usage.presets.today")}
          </button>
          <button class="usage-small-button" @click=${() => props.onPreset(7)}>
            ${t("usage.presets.last7d")}
          </button>
          <button class="usage-small-button" @click=${() => props.onPreset(30)}>
            ${t("usage.presets.last30d")}
          </button>
        </div>
        <div class="usage-date-range">
          <input
            class="usage-date-input"
            type="date"
            .value=${filters.startDate}
            title=${t("usage.filters.startDate")}
            aria-label=${t("usage.filters.startDate")}
            @change=${(event: Event) =>
              filterActions.onStartDateChange((event.target as HTMLInputElement).value)}
          />
          <span>${t("usage.filters.to")}</span>
          <input
            class="usage-date-input"
            type="date"
            .value=${filters.endDate}
            title=${t("usage.filters.endDate")}
            aria-label=${t("usage.filters.endDate")}
            @change=${(event: Event) =>
              filterActions.onEndDateChange((event.target as HTMLInputElement).value)}
          />
        </div>
        <select
          class="usage-select"
          .value=${filters.timeZone}
          title=${t("usage.filters.timeZone")}
          aria-label=${t("usage.filters.timeZone")}
          @change=${(event: Event) =>
            filterActions.onTimeZoneChange(
              (event.target as HTMLSelectElement).value as "local" | "utc",
            )}
        >
          <option value="local">${t("usage.filters.timeZoneLocal")}</option>
          <option value="utc">${t("usage.filters.timeZoneUtc")}</option>
        </select>
        <div class="usage-segmented" role="group" aria-label=${t("usage.metrics.tokens")}>
          <button
            class=${display.chartMode === "tokens" ? "active" : ""}
            @click=${() => displayActions.onChartModeChange("tokens")}
          >
            ${t("usage.metrics.tokens")}
          </button>
          <button
            class=${display.chartMode === "cost" ? "active" : ""}
            @click=${() => displayActions.onChartModeChange("cost")}
          >
            ${t("usage.metrics.cost")}
          </button>
        </div>
        <details class="usage-export">
          <summary class="usage-small-button">${t("usage.export.label")}</summary>
          <div class="usage-export__menu">
            <button
              @click=${() =>
                downloadTextFile(
                  `kova-usage-sessions-${exportStamp}.csv`,
                  buildSessionsCsv(props.filteredSessions),
                  "text/csv",
                )}
              ?disabled=${props.filteredSessions.length === 0}
            >
              ${t("usage.export.sessionsCsv")}
            </button>
            <button
              @click=${() =>
                downloadTextFile(
                  `kova-usage-daily-${exportStamp}.csv`,
                  buildDailyCsv(props.filteredDaily),
                  "text/csv",
                )}
              ?disabled=${props.filteredDaily.length === 0}
            >
              ${t("usage.export.dailyCsv")}
            </button>
            <button
              @click=${() =>
                downloadTextFile(
                  `kova-usage-${exportStamp}.json`,
                  JSON.stringify(
                    {
                      totals: props.displayTotals,
                      sessions: props.filteredSessions,
                      daily: props.filteredDaily,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )}
              ?disabled=${props.filteredSessions.length === 0 && props.filteredDaily.length === 0}
            >
              ${t("usage.export.json")}
            </button>
          </div>
        </details>
        <button
          class="btn primary usage-refresh"
          @click=${filterActions.onRefresh}
          ?disabled=${data.loading}
        >
          ${data.loading ? t("usage.loading.badge") : t("common.refresh")}
        </button>
      </div>
      <div class="usage-search-row">
        <input
          class="usage-query-input"
          type="text"
          .value=${filters.queryDraft}
          placeholder=${t("usage.query.placeholder")}
          @input=${(event: Event) =>
            filterActions.onQueryDraftChange((event.target as HTMLInputElement).value)}
          @keydown=${(event: KeyboardEvent) => {
            if (event.key === "Enter") {
              event.preventDefault();
              filterActions.onApplyQuery();
            }
          }}
        />
        <button
          class="usage-small-button"
          @click=${filterActions.onApplyQuery}
          ?disabled=${data.loading || (!hasDraftQuery && !hasQuery)}
        >
          ${t("usage.query.apply")}
        </button>
        ${hasDraftQuery || hasQuery
          ? html`
              <button class="usage-small-button" @click=${filterActions.onClearQuery}>
                ${t("usage.filters.clear")}
              </button>
            `
          : nothing}
        <span class="usage-query-status">
          ${hasQuery
            ? t("usage.query.matching", {
                shown: String(props.filteredSessions.length),
                total: String(props.totalSessions),
              })
            : t("usage.query.inRange", { total: String(props.totalSessions) })}
        </span>
      </div>
      ${props.queryWarnings.length > 0
        ? html`<div class="callout warning usage-callout">${props.queryWarnings.join(" · ")}</div>`
        : nothing}
    </section>
  `;
}

export function renderUsage(props: UsageProps) {
  const { data, filters, display, detail, callbacks } = props;
  const filterActions = callbacks.filters;
  const detailActions = callbacks.details;
  const isTokenMode = display.chartMode === "tokens";

  if (data.loading && !data.totals) {
    return html`<div class="usage-page">${renderUsageLoadingState(filters)}</div>`;
  }

  const sortedSessions = [...data.sessions].toSorted((a, b) => {
    const valA = isTokenMode ? (a.usage?.totalTokens ?? 0) : (a.usage?.totalCost ?? 0);
    const valB = isTokenMode ? (b.usage?.totalTokens ?? 0) : (b.usage?.totalCost ?? 0);
    return valB - valA;
  });

  const dayFilteredSessions =
    filters.selectedDays.length > 0
      ? sortedSessions.filter((session) => {
          if (session.usage?.activityDates?.length) {
            return session.usage.activityDates.some((day) => filters.selectedDays.includes(day));
          }
          if (!session.updatedAt) {
            return false;
          }
          const date = new Date(session.updatedAt);
          const sessionDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0",
          )}-${String(date.getDate()).padStart(2, "0")}`;
          return filters.selectedDays.includes(sessionDate);
        })
      : sortedSessions;

  const sessionTouchesHours = (session: UsageSessionEntry, hours: number[]): boolean => {
    if (hours.length === 0) {
      return true;
    }
    const usage = session.usage;
    const start = usage?.firstActivity ?? session.updatedAt;
    const end = usage?.lastActivity ?? session.updatedAt;
    if (!start || !end) {
      return false;
    }
    const startMs = Math.min(start, end);
    const endMs = Math.max(start, end);
    let cursor = startMs;
    while (cursor <= endMs) {
      const date = new Date(cursor);
      const hour = getZonedHour(date, filters.timeZone);
      if (hours.includes(hour)) {
        return true;
      }
      const nextHour = setToHourEnd(date, filters.timeZone);
      const nextMs = Math.min(nextHour.getTime(), endMs);
      cursor = nextMs + 1;
    }
    return false;
  };

  const hourFilteredSessions =
    filters.selectedHours.length > 0
      ? dayFilteredSessions.filter((session) => sessionTouchesHours(session, filters.selectedHours))
      : dayFilteredSessions;
  const queryResult = filterSessionsByQuery(hourFilteredSessions, filters.query);
  const filteredSessions = queryResult.sessions;
  const totalSessions = sortedSessions.length;

  const primarySelectedEntry =
    filters.selectedSessions.length === 1
      ? (data.sessions.find((session) => session.key === filters.selectedSessions[0]) ??
        filteredSessions.find((session) => session.key === filters.selectedSessions[0]))
      : null;

  const computeDailyTotals = (days: string[]): UsageTotals =>
    data.costDaily
      .filter((day) => days.includes(day.date))
      .reduce((acc, day) => addUsageTotals(acc, day), createEmptyUsageTotals());

  let displayTotals: UsageTotals | null;
  let displaySessionCount: number;
  if (filters.selectedSessions.length > 0) {
    const selectedEntries = filteredSessions.filter((session) =>
      filters.selectedSessions.includes(session.key),
    );
    displayTotals = computeSessionTotals(selectedEntries);
    displaySessionCount = selectedEntries.length;
  } else if (filters.selectedDays.length > 0 && filters.selectedHours.length === 0) {
    displayTotals = computeDailyTotals(filters.selectedDays);
    displaySessionCount = filteredSessions.length;
  } else if (
    filters.selectedHours.length > 0 ||
    filters.query.trim().length > 0 ||
    filteredSessions.length !== sortedSessions.length
  ) {
    displayTotals = computeSessionTotals(filteredSessions);
    displaySessionCount = filteredSessions.length;
  } else {
    displayTotals = data.totals;
    displaySessionCount = totalSessions;
  }

  const aggregateSessions =
    filters.selectedSessions.length > 0
      ? filteredSessions.filter((session) => filters.selectedSessions.includes(session.key))
      : filteredSessions;
  const activeAggregates = buildAggregatesFromSessions(aggregateSessions, data.aggregates);
  const filteredDaily =
    filters.selectedSessions.length > 0
      ? (() => {
          const dates = new Set<string>();
          for (const session of aggregateSessions) {
            for (const date of session.usage?.activityDates ?? []) {
              dates.add(date);
            }
          }
          return dates.size > 0
            ? data.costDaily.filter((day) => dates.has(day.date))
            : data.costDaily;
        })()
      : data.costDaily;
  const insightStats = buildUsageInsightStats(aggregateSessions, displayTotals, activeAggregates);
  const isEmpty = !data.loading && !data.totals && data.sessions.length === 0;
  const hasMissingCost =
    (displayTotals?.missingCostEntries ?? 0) > 0 ||
    (displayTotals
      ? displayTotals.totalTokens > 0 &&
        displayTotals.totalCost === 0 &&
        displayTotals.input +
          displayTotals.output +
          displayTotals.cacheRead +
          displayTotals.cacheWrite >
          0
      : false);
  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    filterActions.onStartDateChange(formatIsoDate(start));
    filterActions.onEndDateChange(formatIsoDate(end));
  };

  return html`
    <div class="usage-page">
      ${renderUsageToolbar({
        filters,
        display,
        data,
        filteredSessions,
        filteredDaily,
        displayTotals,
        queryWarnings: queryResult.warnings,
        totalSessions,
        onPreset: applyPreset,
        callbacks,
      })}
      ${renderFilterChips(
        filters.selectedDays,
        filters.selectedHours,
        filters.selectedSessions,
        data.sessions,
        filterActions.onClearDays,
        filterActions.onClearHours,
        filterActions.onClearSessions,
        filterActions.onClearFilters,
      )}
      ${data.error ? html`<div class="callout danger usage-callout">${data.error}</div>` : nothing}
      ${data.sessionsLimitReached
        ? html`<div class="callout warning usage-callout">${t("usage.sessions.limitReached")}</div>`
        : nothing}
      ${isEmpty
        ? renderUsageEmptyState(filterActions.onRefresh)
        : html`
            ${renderUsageInsights(
              displayTotals,
              activeAggregates,
              insightStats,
              hasMissingCost,
              buildPeakErrorHours(aggregateSessions, filters.timeZone),
              displaySessionCount,
              totalSessions,
            )}
            <div class="usage-workspace">
              <div class="usage-workspace__main">
                <div class="usage-chart-stack">
                  ${renderDailyChartCompact(
                    filteredDaily,
                    filters.selectedDays,
                    display.chartMode,
                    display.dailyChartMode,
                    callbacks.display.onDailyChartModeChange,
                    filterActions.onSelectDay,
                  )}
                  ${displayTotals
                    ? renderCostBreakdownCompact(displayTotals, display.chartMode)
                    : nothing}
                </div>
                ${renderSessionsCard(
                  filteredSessions,
                  filters.selectedSessions,
                  filters.selectedDays,
                  isTokenMode,
                  display.sessionSort,
                  display.sessionSortDir,
                  display.recentSessions,
                  display.sessionsTab,
                  detailActions.onSelectSession,
                  callbacks.display.onSessionSortChange,
                  callbacks.display.onSessionSortDirChange,
                  callbacks.display.onSessionsTabChange,
                  display.visibleColumns,
                  totalSessions,
                  filterActions.onClearSessions,
                )}
              </div>
              <div class="usage-workspace__detail">
                ${primarySelectedEntry
                  ? renderSessionDetailPanel(
                      primarySelectedEntry,
                      detail.timeSeries,
                      detail.timeSeriesLoading,
                      detail.timeSeriesMode,
                      detailActions.onTimeSeriesModeChange,
                      detail.timeSeriesBreakdownMode,
                      detailActions.onTimeSeriesBreakdownChange,
                      detail.timeSeriesCursorStart,
                      detail.timeSeriesCursorEnd,
                      detailActions.onTimeSeriesCursorRangeChange,
                      filters.startDate,
                      filters.endDate,
                      filters.selectedDays,
                      detail.sessionLogs,
                      detail.sessionLogsLoading,
                      detail.sessionLogsExpanded,
                      detailActions.onToggleSessionLogsExpanded,
                      detail.logFilters,
                      detailActions.onLogFilterRolesChange,
                      detailActions.onLogFilterToolsChange,
                      detailActions.onLogFilterHasToolsChange,
                      detailActions.onLogFilterQueryChange,
                      detailActions.onLogFilterClear,
                      display.contextExpanded,
                      detailActions.onToggleContextExpanded,
                      filterActions.onClearSessions,
                    )
                  : html`
                      <aside class="usage-session-detail usage-session-detail--empty">
                        <div class="usage-empty-state__title">${t("usage.sessions.title")}</div>
                        <div class="usage-empty-state__subtitle">
                          ${t("usage.empty.featureTimeline")}
                        </div>
                        <div class="usage-detail-placeholder">
                          <strong>${formatTokens(displayTotals?.totalTokens ?? 0)}</strong>
                          <span>${formatCost(displayTotals?.totalCost ?? 0)}</span>
                        </div>
                      </aside>
                    `}
              </div>
            </div>
          `}
    </div>
  `;
}
