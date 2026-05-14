import { html, nothing, svg } from "lit";
import { formatDurationCompact } from "../../../../src/infra/format-time/format-duration.ts";
import { t } from "../../i18n/index.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import {
  formatCost,
  formatDayLabel,
  formatFullDate,
  formatTokens,
  UsageInsightStats,
} from "./usage-metrics.ts";
import {
  UsageAggregates,
  UsageColumnId,
  UsageSessionEntry,
  UsageTotals,
  CostDailyEntry,
} from "./usageTypes.ts";

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function compactLabel(value: string | undefined | null): string {
  const label = value?.trim();
  return label || t("usage.common.unknown");
}

function renderFilterChips(
  selectedDays: string[],
  selectedHours: number[],
  selectedSessions: string[],
  sessions: UsageSessionEntry[],
  onClearDays: () => void,
  onClearHours: () => void,
  onClearSessions: () => void,
  onClearFilters: () => void,
) {
  const hasFilters =
    selectedDays.length > 0 || selectedHours.length > 0 || selectedSessions.length > 0;
  if (!hasFilters) {
    return nothing;
  }

  const selectedSession =
    selectedSessions.length === 1 ? sessions.find((s) => s.key === selectedSessions[0]) : null;
  const sessionLabel = selectedSession
    ? (selectedSession.label || selectedSession.key).slice(0, 24)
    : t("usage.filters.sessionsCount", { count: String(selectedSessions.length) });

  return html`
    <div class="usage-active-filters">
      ${selectedDays.length > 0
        ? html`
            <button class="usage-filter-chip" @click=${onClearDays}>
              ${t("usage.filters.days")}:
              ${selectedDays.length === 1
                ? selectedDays[0]
                : t("usage.filters.daysCount", { count: String(selectedDays.length) })}
              <span>×</span>
            </button>
          `
        : nothing}
      ${selectedHours.length > 0
        ? html`
            <button class="usage-filter-chip" @click=${onClearHours}>
              ${t("usage.filters.hours")}:
              ${selectedHours.length === 1
                ? `${selectedHours[0]}:00`
                : t("usage.filters.hoursCount", { count: String(selectedHours.length) })}
              <span>×</span>
            </button>
          `
        : nothing}
      ${selectedSessions.length > 0
        ? html`
            <button class="usage-filter-chip" @click=${onClearSessions}>
              ${t("usage.filters.session")}: ${sessionLabel}${sessionLabel.length === 24 ? "…" : ""}
              <span>×</span>
            </button>
          `
        : nothing}
      <button class="usage-filter-clear" @click=${onClearFilters}>
        ${t("usage.filters.clearAll")}
      </button>
    </div>
  `;
}

function renderMetric(params: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const cls = ["usage-metric", params.tone ? `usage-metric--${params.tone}` : ""]
    .filter(Boolean)
    .join(" ");
  return html`
    <div class=${cls}>
      <div class="usage-metric__label">${params.label}</div>
      <div class="usage-metric__value">${params.value}</div>
      ${params.sub ? html`<div class="usage-metric__sub">${params.sub}</div>` : nothing}
    </div>
  `;
}

function renderInsightList(
  title: string,
  items: Array<{ label: string; value: string; sub?: string }>,
  emptyLabel: string,
) {
  return html`
    <div class="usage-insight">
      <div class="usage-insight__title">${title}</div>
      ${items.length === 0
        ? html`<div class="usage-insight__empty">${emptyLabel}</div>`
        : html`
            <div class="usage-insight__rows">
              ${items.map(
                (item) => html`
                  <div class="usage-insight__row">
                    <span>${item.label}</span>
                    <span>
                      <strong>${item.value}</strong>
                      ${item.sub ? html`<small>${item.sub}</small>` : nothing}
                    </span>
                  </div>
                `,
              )}
            </div>
          `}
    </div>
  `;
}

function renderPeakErrorList(
  title: string,
  items: Array<{ label: string; value: string; sub?: string }>,
  emptyLabel: string,
) {
  return renderInsightList(title, items, emptyLabel);
}

type SplinePoint = {
  x: number;
  y: number;
};

function buildAreaSplinePaths(points: SplinePoint[], baselineY: number) {
  if (points.length === 0) {
    return { line: "", area: "" };
  }
  if (points.length === 1) {
    const point = points[0];
    const line = `M ${point.x - 5} ${point.y} C ${point.x - 2} ${point.y}, ${point.x + 2} ${
      point.y
    }, ${point.x + 5} ${point.y}`;
    const area = `M ${point.x - 5} ${baselineY} L ${point.x - 5} ${point.y} C ${
      point.x - 2
    } ${point.y}, ${point.x + 2} ${point.y}, ${point.x + 5} ${point.y} L ${
      point.x + 5
    } ${baselineY} Z`;
    return { line, area };
  }

  let line = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index++) {
    const prev = points[index - 1];
    const point = points[index];
    const midX = (prev.x + point.x) / 2;
    line += ` C ${midX} ${prev.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const area = `M ${first.x} ${baselineY} L ${first.x} ${first.y} ${line.replace(
    /^M [^C]+/,
    "",
  )} L ${last.x} ${baselineY} Z`;
  return { line, area };
}

function renderUsageInsights(
  totals: UsageTotals | null,
  aggregates: UsageAggregates,
  stats: UsageInsightStats,
  showCostHint: boolean,
  errorHours: Array<{ label: string; value: string; sub?: string }>,
  sessionCount: number,
  totalSessions: number,
) {
  if (!totals) {
    return nothing;
  }

  const avgTokens = aggregates.messages.total
    ? Math.round(totals.totalTokens / aggregates.messages.total)
    : 0;
  const avgCost = aggregates.messages.total ? totals.totalCost / aggregates.messages.total : 0;
  const cacheBase = totals.input + totals.cacheRead + totals.cacheWrite;
  const cacheHitRate = cacheBase > 0 ? totals.cacheRead / cacheBase : 0;
  const cacheHitLabel =
    cacheBase > 0 ? `${(cacheHitRate * 100).toFixed(1)}%` : t("usage.common.emptyValue");
  const errorRatePct = stats.errorRate * 100;
  const throughputLabel =
    stats.throughputTokensPerMin !== undefined
      ? `${formatTokens(Math.round(stats.throughputTokensPerMin))} ${t("usage.overview.tokensPerMinute")}`
      : t("usage.common.emptyValue");
  const avgDurationLabel =
    stats.durationCount > 0
      ? (formatDurationCompact(stats.avgDurationMs, { spaced: true }) ??
        t("usage.common.emptyValue"))
      : t("usage.common.emptyValue");

  const topModels = aggregates.byModel.slice(0, 5).map((entry) => ({
    label: compactLabel(entry.model),
    value: formatCost(entry.totals.totalCost),
    sub: formatTokens(entry.totals.totalTokens),
  }));
  const topProviders = aggregates.byProvider.slice(0, 5).map((entry) => ({
    label: compactLabel(entry.provider),
    value: formatCost(entry.totals.totalCost),
    sub: formatTokens(entry.totals.totalTokens),
  }));
  const topTools = aggregates.tools.tools.slice(0, 5).map((tool) => ({
    label: tool.name,
    value: String(tool.count),
    sub: t("usage.overview.calls"),
  }));
  const topAgents = aggregates.byAgent.slice(0, 5).map((entry) => ({
    label: compactLabel(entry.agentId),
    value: formatCost(entry.totals.totalCost),
    sub: formatTokens(entry.totals.totalTokens),
  }));
  const topChannels = aggregates.byChannel.slice(0, 5).map((entry) => ({
    label: compactLabel(entry.channel),
    value: formatCost(entry.totals.totalCost),
    sub: formatTokens(entry.totals.totalTokens),
  }));

  return html`
    <section class="usage-overview">
      <div class="usage-metric-strip">
        ${renderMetric({
          label: t("usage.metrics.cost"),
          value: formatCost(totals.totalCost),
          sub: showCostHint ? t("usage.overview.avgCostHintMissing") : t("usage.breakdown.total"),
          tone: showCostHint ? "warn" : undefined,
        })}
        ${renderMetric({
          label: t("usage.metrics.tokens"),
          value: formatTokens(totals.totalTokens),
          sub: `${formatTokens(totals.input)} ${normalizeLowercaseStringOrEmpty(
            t("usage.breakdown.input"),
          )} · ${formatTokens(totals.output)} ${normalizeLowercaseStringOrEmpty(
            t("usage.breakdown.output"),
          )}`,
        })}
        ${renderMetric({
          label: t("usage.overview.messages"),
          value: aggregates.messages.total,
          sub: `${aggregates.messages.user} ${normalizeLowercaseStringOrEmpty(
            t("usage.overview.user"),
          )} · ${aggregates.messages.assistant} ${normalizeLowercaseStringOrEmpty(
            t("usage.overview.assistant"),
          )}`,
        })}
        ${renderMetric({
          label: t("usage.overview.sessions"),
          value: sessionCount,
          sub: t("usage.overview.sessionsInRange", { count: String(totalSessions) }),
        })}
        ${renderMetric({
          label: t("usage.overview.cacheHitRate"),
          value: cacheHitLabel,
          sub: `${formatTokens(totals.cacheRead)} ${t("usage.overview.cached")} · ${formatTokens(
            cacheBase,
          )} ${t("usage.overview.prompt")}`,
          tone: cacheHitRate > 0.55 ? "good" : cacheHitRate > 0.2 ? "warn" : "bad",
        })}
        ${renderMetric({
          label: t("usage.overview.errorRate"),
          value: `${errorRatePct.toFixed(2)}%`,
          sub: `${aggregates.messages.errors} ${normalizeLowercaseStringOrEmpty(
            t("usage.overview.errors"),
          )} · ${avgDurationLabel} ${t("usage.overview.avgSession")}`,
          tone: errorRatePct > 5 ? "bad" : errorRatePct > 1 ? "warn" : "good",
        })}
      </div>
      <div class="usage-analytics-grid">
        ${renderInsightList(
          t("usage.overview.topModels"),
          topModels,
          t("usage.overview.noModelData"),
        )}
        ${renderInsightList(
          t("usage.overview.topProviders"),
          topProviders,
          t("usage.overview.noProviderData"),
        )}
        ${renderInsightList(
          t("usage.overview.topTools"),
          topTools,
          t("usage.overview.noToolCalls"),
        )}
        ${renderInsightList(
          t("usage.overview.topAgents"),
          topAgents,
          t("usage.overview.noAgentData"),
        )}
        ${renderInsightList(
          t("usage.overview.topChannels"),
          topChannels,
          t("usage.overview.noChannelData"),
        )}
        ${renderInsightList(
          t("usage.overview.peakErrorHours"),
          errorHours,
          t("usage.overview.noErrorData"),
        )}
      </div>
      <div class="usage-overview-footnote">
        <span>${t("usage.overview.avgTokens")}: ${formatTokens(avgTokens)}</span>
        <span>${t("usage.overview.avgCost")}: ${formatCost(avgCost, 4)}</span>
        <span>${t("usage.overview.throughput")}: ${throughputLabel}</span>
      </div>
    </section>
  `;
}

function renderDailyChartCompact(
  daily: CostDailyEntry[],
  selectedDays: string[],
  chartMode: "tokens" | "cost",
  dailyChartMode: "total" | "by-type",
  onDailyChartModeChange: (mode: "total" | "by-type") => void,
  onSelectDay: (day: string, shiftKey: boolean) => void,
) {
  void dailyChartMode;
  void onDailyChartModeChange;

  if (!daily.length) {
    return html`
      <section class="usage-wave">
        <div class="usage-section-heading">
          <span>${t("usage.daily.title")}</span>
          <small>${t("usage.empty.noData")}</small>
        </div>
        <div class="usage-empty-block">${t("usage.empty.noData")}</div>
      </section>
    `;
  }

  const isTokenMode = chartMode === "tokens";
  const values = daily.map((entry) => (isTokenMode ? entry.totalTokens : entry.totalCost));
  const maxValue = Math.max(...values, isTokenMode ? 1 : 0.0001);
  const width = 720;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 28, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const pointX = (index: number) =>
    daily.length === 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (daily.length - 1)) * chartWidth;
  const pointY = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight;
  const points = values.map((value, index) => `${pointX(index)},${pointY(value)}`).join(" ");
  const areaPoints = `${padding.left},${padding.top + chartHeight} ${points} ${
    padding.left + chartWidth
  },${padding.top + chartHeight}`;
  const barWidth = Math.max(4, Math.min(18, chartWidth / daily.length - 4));

  return html`
    <section class="usage-wave">
      <div class="usage-section-heading">
        <span>${isTokenMode ? t("usage.daily.tokensTitle") : t("usage.daily.costTitle")}</span>
        <small>${daily.length} ${normalizeLowercaseStringOrEmpty(t("usage.filters.days"))}</small>
      </div>
      <div class="usage-wave-chart" role="img" aria-label=${t("usage.daily.title")}>
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <line
            x1=${padding.left}
            y1=${padding.top + chartHeight}
            x2=${padding.left + chartWidth}
            y2=${padding.top + chartHeight}
            class="usage-wave-axis"
          ></line>
          <line
            x1=${padding.left}
            y1=${padding.top}
            x2=${padding.left}
            y2=${padding.top + chartHeight}
            class="usage-wave-axis"
          ></line>
          ${daily.map((entry, index) => {
            const value = values[index];
            const x = pointX(index) - barWidth / 2;
            const y = pointY(value);
            const h = Math.max(2, padding.top + chartHeight - y);
            const selected = selectedDays.includes(entry.date);
            const label = isTokenMode ? formatTokens(value) : formatCost(value);
            return svg`
              <rect
                x=${x}
                y=${y}
                width=${barWidth}
                height=${h}
                class=${selected ? "usage-wave-bar usage-wave-bar--selected" : "usage-wave-bar"}
              >
                <title>${formatFullDate(entry.date)} · ${label}</title>
              </rect>
            `;
          })}
          <polygon points=${areaPoints} class="usage-wave-area"></polygon>
          <polyline points=${points} class="usage-wave-line"></polyline>
          ${daily.map((entry, index) => {
            const x = pointX(index);
            const y = pointY(values[index]);
            const selected = selectedDays.includes(entry.date);
            return svg`
              <circle
                cx=${x}
                cy=${y}
                r=${selected ? 5 : 3}
                class=${selected ? "usage-wave-dot usage-wave-dot--selected" : "usage-wave-dot"}
              >
                <title>${formatFullDate(entry.date)} · ${
                  isTokenMode ? formatTokens(values[index]) : formatCost(values[index])
                }</title>
              </circle>
            `;
          })}
        </svg>
        <div class="usage-wave-hit-grid">
          ${daily.map(
            (entry, index) => html`
              <button
                class=${selectedDays.includes(entry.date)
                  ? "usage-wave-hit usage-wave-hit--selected"
                  : "usage-wave-hit"}
                style="left: ${(index / daily.length) * 100}%; width: ${100 / daily.length}%"
                title="${formatFullDate(entry.date)} · ${isTokenMode
                  ? formatTokens(values[index])
                  : formatCost(values[index])}"
                @click=${(event: MouseEvent) => onSelectDay(entry.date, event.shiftKey)}
              ></button>
            `,
          )}
        </div>
      </div>
      <div class="usage-wave-labels">
        <span>${formatDayLabel(daily[0].date)}</span>
        <span>${isTokenMode ? formatTokens(maxValue) : formatCost(maxValue)}</span>
        <span>${formatDayLabel(daily[daily.length - 1].date)}</span>
      </div>
    </section>
  `;
}

function renderCostBreakdownCompact(totals: UsageTotals, mode: "tokens" | "cost") {
  const isTokenMode = mode === "tokens";
  const total = isTokenMode ? totals.totalTokens : totals.totalCost;
  const segments = [
    {
      key: "output",
      label: t("usage.breakdown.output"),
      value: isTokenMode ? totals.output : (totals.outputCost ?? 0),
    },
    {
      key: "input",
      label: t("usage.breakdown.input"),
      value: isTokenMode ? totals.input : (totals.inputCost ?? 0),
    },
    {
      key: "cache-write",
      label: t("usage.breakdown.cacheWrite"),
      value: isTokenMode ? totals.cacheWrite : (totals.cacheWriteCost ?? 0),
    },
    {
      key: "cache-read",
      label: t("usage.breakdown.cacheRead"),
      value: isTokenMode ? totals.cacheRead : (totals.cacheReadCost ?? 0),
    },
  ];
  const splineWidth = 520;
  const splineHeight = 150;
  const splinePadding = { top: 16, right: 18, bottom: 28, left: 26 };
  const splineChartWidth = splineWidth - splinePadding.left - splinePadding.right;
  const splineChartHeight = splineHeight - splinePadding.top - splinePadding.bottom;
  const maxSegmentValue = Math.max(...segments.map((segment) => segment.value), 1);
  const splinePoints = segments.map((segment, index) => ({
    x:
      segments.length === 1
        ? splinePadding.left + splineChartWidth / 2
        : splinePadding.left + (index / (segments.length - 1)) * splineChartWidth,
    y:
      splinePadding.top + splineChartHeight - (segment.value / maxSegmentValue) * splineChartHeight,
  }));
  const splinePaths = buildAreaSplinePaths(splinePoints, splinePadding.top + splineChartHeight);

  return html`
    <section class="usage-breakdown">
      <div class="usage-section-heading">
        <span
          >${isTokenMode
            ? t("usage.breakdown.tokensByType")
            : t("usage.breakdown.costByType")}</span
        >
        <small
          >${isTokenMode ? formatTokens(totals.totalTokens) : formatCost(totals.totalCost)}</small
        >
      </div>
      <div class="usage-breakdown-spline" aria-label="Area spline">
        <div class="usage-breakdown-spline__label">
          <span>Area spline</span>
          <small>${isTokenMode ? t("usage.metrics.tokens") : t("usage.metrics.cost")}</small>
        </div>
        <svg viewBox="0 0 ${splineWidth} ${splineHeight}" preserveAspectRatio="none">
          <line
            x1=${splinePadding.left}
            y1=${splinePadding.top + splineChartHeight}
            x2=${splinePadding.left + splineChartWidth}
            y2=${splinePadding.top + splineChartHeight}
            class="usage-breakdown-spline__axis"
          ></line>
          <path d=${splinePaths.area} class="usage-breakdown-spline__area"></path>
          <path d=${splinePaths.line} class="usage-breakdown-spline__line"></path>
          ${segments.map((segment, index) => {
            const point = splinePoints[index];
            const label = isTokenMode ? formatTokens(segment.value) : formatCost(segment.value);
            return svg`
              <circle
                cx=${point.x}
                cy=${point.y}
                r="4"
                class="usage-breakdown-spline__dot usage-breakdown-spline__dot--${segment.key}"
              >
                <title>${segment.label}: ${label}</title>
              </circle>
              <text
                x=${point.x}
                y=${splinePadding.top + splineChartHeight + 17}
                text-anchor="middle"
                class="usage-breakdown-spline__text"
              >
                ${segment.label}
              </text>
            `;
          })}
        </svg>
      </div>
      <div class="usage-breakdown-bar">
        ${segments.map(
          (segment) => html`
            <div
              class="usage-breakdown-segment usage-breakdown-segment--${segment.key}"
              style="width: ${pct(segment.value, total).toFixed(2)}%"
              title="${segment.label}: ${isTokenMode
                ? formatTokens(segment.value)
                : formatCost(segment.value)}"
            ></div>
          `,
        )}
      </div>
      <div class="usage-breakdown-legend">
        ${segments.map(
          (segment) => html`
            <span>
              <i class="usage-breakdown-dot usage-breakdown-dot--${segment.key}"></i>
              ${segment.label}
              <strong
                >${isTokenMode ? formatTokens(segment.value) : formatCost(segment.value)}</strong
              >
            </span>
          `,
        )}
      </div>
    </section>
  `;
}

function renderSessionsCard(
  sessions: UsageSessionEntry[],
  selectedSessions: string[],
  selectedDays: string[],
  isTokenMode: boolean,
  sessionSort: "tokens" | "cost" | "recent" | "messages" | "errors",
  sessionSortDir: "asc" | "desc",
  recentSessions: string[],
  sessionsTab: "all" | "recent",
  onSelectSession: (key: string, shiftKey: boolean) => void,
  onSessionSortChange: (sort: "tokens" | "cost" | "recent" | "messages" | "errors") => void,
  onSessionSortDirChange: (dir: "asc" | "desc") => void,
  onSessionsTabChange: (tab: "all" | "recent") => void,
  visibleColumns: UsageColumnId[],
  totalSessions: number,
  onClearSessions: () => void,
) {
  void recentSessions;
  void sessionsTab;
  void onSessionsTabChange;
  void visibleColumns;

  const selectedSet = new Set(selectedSessions);
  const sessionLabel = (session: UsageSessionEntry): string => {
    const label = session.label || session.key;
    if (label.startsWith("agent:") && label.includes("?token=")) {
      return label.slice(0, label.indexOf("?token="));
    }
    return label;
  };
  const copySessionName = async (session: UsageSessionEntry) => {
    try {
      await navigator.clipboard.writeText(sessionLabel(session));
    } catch {
      // Best-effort copy; browser permissions can block clipboard access.
    }
  };
  const getValue = (session: UsageSessionEntry): number => {
    const usage = session.usage;
    if (!usage) {
      return 0;
    }
    if (selectedDays.length > 0 && usage.dailyBreakdown?.length) {
      const matching = usage.dailyBreakdown.filter((day) => selectedDays.includes(day.date));
      return matching.reduce((sum, day) => sum + (isTokenMode ? day.tokens : day.cost), 0);
    }
    return isTokenMode ? (usage.totalTokens ?? 0) : (usage.totalCost ?? 0);
  };
  const sorted = [...sessions].toSorted((a, b) => {
    switch (sessionSort) {
      case "recent":
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      case "messages":
        return (b.usage?.messageCounts?.total ?? 0) - (a.usage?.messageCounts?.total ?? 0);
      case "errors":
        return (b.usage?.messageCounts?.errors ?? 0) - (a.usage?.messageCounts?.errors ?? 0);
      case "cost":
        return (b.usage?.totalCost ?? 0) - (a.usage?.totalCost ?? 0);
      case "tokens":
      default:
        return (b.usage?.totalTokens ?? 0) - (a.usage?.totalTokens ?? 0);
    }
  });
  const rows = sessionSortDir === "asc" ? sorted.toReversed() : sorted;
  const maxValue = Math.max(...rows.map(getValue), 1);

  return html`
    <section class="usage-sessions">
      <div class="usage-section-heading usage-section-heading--controls">
        <span>${t("usage.sessions.title")}</span>
        <small>
          ${t("usage.sessions.shown", { count: String(sessions.length) })}
          ${totalSessions !== sessions.length
            ? ` · ${t("usage.sessions.total", { count: String(totalSessions) })}`
            : ""}
        </small>
        <div class="usage-session-controls">
          <label>
            ${t("usage.sessions.sort")}
            <select
              .value=${sessionSort}
              @change=${(event: Event) =>
                onSessionSortChange(
                  (event.target as HTMLSelectElement).value as typeof sessionSort,
                )}
            >
              <option value="cost">${t("usage.metrics.cost")}</option>
              <option value="tokens">${t("usage.metrics.tokens")}</option>
              <option value="messages">${t("usage.overview.messages")}</option>
              <option value="errors">${t("usage.overview.errors")}</option>
              <option value="recent">${t("usage.sessions.recentShort")}</option>
            </select>
          </label>
          <button
            class="usage-small-button"
            @click=${() => onSessionSortDirChange(sessionSortDir === "desc" ? "asc" : "desc")}
            title=${sessionSortDir === "desc"
              ? t("usage.sessions.descending")
              : t("usage.sessions.ascending")}
          >
            ${sessionSortDir === "desc" ? "↓" : "↑"}
          </button>
          ${selectedSessions.length > 0
            ? html`
                <button class="usage-small-button" @click=${onClearSessions}>
                  ${t("usage.sessions.clearSelection")}
                </button>
              `
            : nothing}
        </div>
      </div>
      ${rows.length === 0
        ? html`<div class="usage-empty-block">${t("usage.sessions.noneInRange")}</div>`
        : html`
            <div class="usage-session-list">
              ${rows.slice(0, 60).map((session) => {
                const value = getValue(session);
                const selected = selectedSet.has(session.key);
                const label = sessionLabel(session);
                const meta = [
                  session.agentId ? `${t("usage.filters.agent")}:${session.agentId}` : "",
                  session.channel ? `${t("usage.filters.channel")}:${session.channel}` : "",
                  session.modelProvider || session.providerOverride
                    ? `${t("usage.filters.provider")}:${
                        session.modelProvider ?? session.providerOverride
                      }`
                    : "",
                  session.model ? `${t("usage.filters.model")}:${session.model}` : "",
                ].filter(Boolean);
                return html`
                  <button
                    class=${selected
                      ? "usage-session-row usage-session-row--selected"
                      : "usage-session-row"}
                    @click=${(event: MouseEvent) => onSelectSession(session.key, event.shiftKey)}
                    title=${session.key}
                  >
                    <span class="usage-session-row__main">
                      <span class="usage-session-row__title">${label}</span>
                      <span class="usage-session-row__meta"
                        >${meta.join(" · ") || session.key}</span
                      >
                      <span class="usage-session-row__bar">
                        <i style="width: ${pct(value, maxValue).toFixed(2)}%"></i>
                      </span>
                    </span>
                    <span class="usage-session-row__side">
                      <strong>${isTokenMode ? formatTokens(value) : formatCost(value)}</strong>
                      <small>
                        ${session.usage?.messageCounts?.errors
                          ? `${session.usage.messageCounts.errors} ${normalizeLowercaseStringOrEmpty(
                              t("usage.overview.errors"),
                            )}`
                          : `${session.usage?.messageCounts?.total ?? 0} ${t(
                              "usage.overview.messagesAbbrev",
                            )}`}
                      </small>
                      <span
                        class="usage-session-copy"
                        @click=${(event: MouseEvent) => {
                          event.stopPropagation();
                          void copySessionName(session);
                        }}
                      >
                        ${t("usage.sessions.copy")}
                      </span>
                    </span>
                  </button>
                `;
              })}
              ${rows.length > 60
                ? html`
                    <div class="usage-more-sessions">
                      ${t("usage.sessions.more", { count: String(rows.length - 60) })}
                    </div>
                  `
                : nothing}
            </div>
          `}
    </section>
  `;
}

export {
  renderCostBreakdownCompact,
  renderDailyChartCompact,
  renderFilterChips,
  renderInsightList,
  renderPeakErrorList,
  renderSessionsCard,
  renderUsageInsights,
};
