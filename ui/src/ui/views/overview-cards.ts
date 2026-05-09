import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { formatCost, formatTokens, formatRelativeTimestamp } from "../format.ts";
import { icons } from "../icons.ts";
import { isMonitoredAuthProvider } from "../model-auth-helpers.ts";
import { formatNextRun } from "../presenter.ts";
import type {
  GatewaySessionRow,
  ModelAuthStatusProvider,
  SessionsUsageResult,
  SessionsListResult,
  SkillStatusReport,
  CronJob,
  CronStatus,
  ModelAuthStatusResult,
} from "../types.ts";

export type OverviewCardsProps = {
  usageResult: SessionsUsageResult | null;
  sessionsResult: SessionsListResult | null;
  skillsReport: SkillStatusReport | null;
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  modelAuthStatus: ModelAuthStatusResult | null;
  presenceCount: number;
  onNavigate: (tab: string) => void;
  onOpenSessionChat: (sessionKey: string) => void;
};

type StatCard = {
  kind: string;
  tab: string;
  label: string;
  value: string | TemplateResult;
  hint: string | TemplateResult;
  tone?: "warn" | "danger";
  icon?: TemplateResult;
  sparkline?: number[];
  sparklineLabel?: string;
};

function renderSparkline(values: number[] | undefined, label: string | undefined) {
  if (!values || values.length < 2) {
    return nothing;
  }
  const width = 104;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const step = width / Math.max(1, values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return html`
    <span class="ov-card__sparkline" title=${label ?? ""} aria-label=${label ?? "Trend"}>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">
        <polygon points=${area}></polygon>
        <polyline points=${points}></polyline>
      </svg>
    </span>
  `;
}

function renderStatCard(card: StatCard, onNavigate: (tab: string) => void) {
  const classes = ["ov-card", card.tone ? `ov-card--${card.tone}` : ""].filter(Boolean).join(" ");
  return html`
    <button class=${classes} data-kind=${card.kind} @click=${() => onNavigate(card.tab)}>
      <span class="ov-card__label">
        ${card.icon ? html`<span class="ov-card__icon">${card.icon}</span>` : nothing} ${card.label}
      </span>
      <span class="ov-card__value">${card.value}</span>
      ${renderSparkline(card.sparkline, card.sparklineLabel)}
      <span class="ov-card__hint">${card.hint}</span>
    </button>
  `;
}

function buildLastSevenDays(now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

function buildDailyCostTrend(result: SessionsUsageResult | null): number[] {
  const byDate = new Map((result?.aggregates.daily ?? []).map((d) => [d.date, d.cost] as const));
  return buildLastSevenDays().map((date) => byDate.get(date) ?? 0);
}

function buildDailySessionTrend(result: SessionsListResult | null): number[] {
  const days = buildLastSevenDays();
  const counts = new Map(days.map((date) => [date, 0] as const));
  for (const session of result?.sessions ?? []) {
    if (!session.updatedAt) {
      continue;
    }
    const date = new Date(session.updatedAt).toISOString().slice(0, 10);
    if (counts.has(date)) {
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }
  return days.map((date) => counts.get(date) ?? 0);
}

function resolveAuthTone(providers: ModelAuthStatusProvider[]): "warn" | "danger" | undefined {
  let tone: "warn" | "danger" | undefined;
  const oneDayMs = 24 * 60 * 60 * 1000;
  for (const provider of providers) {
    if (provider.status === "expired" || provider.status === "missing") {
      return "danger";
    }
    if (provider.status === "expiring") {
      tone = "warn";
    }
    if (
      provider.expiry &&
      Number.isFinite(provider.expiry.remainingMs) &&
      provider.expiry.remainingMs <= oneDayMs
    ) {
      return "danger";
    }
  }
  return tone;
}

function resolveSessionTitle(row: GatewaySessionRow): string {
  const derived = row.derivedTitle?.trim();
  const preview = row.lastMessagePreview?.trim();
  const display = row.displayName?.trim();
  const label = row.label?.trim();
  return derived || preview || display || label || row.key;
}

function resolveSessionState(row: GatewaySessionRow): "active" | "idle" | "closed" {
  if (row.status === "running" || row.hasActiveSubagentRun) {
    return "active";
  }
  if (
    row.status === "failed" ||
    row.status === "killed" ||
    row.status === "timeout" ||
    row.abortedLastRun
  ) {
    return "closed";
  }
  return "idle";
}

function renderSkeletonCards() {
  // Render 4 skeletons — matching the always-present cards (cost, sessions,
  // skills, cron). The Model Auth card is conditional on OAuth providers
  // existing, so rendering it in the skeleton would cause a layout shift
  // when real data arrives for a setup without OAuth. Accept a brief empty
  // slot instead for setups that DO have OAuth.
  return html`
    <section class="ov-cards">
      ${[0, 1, 2, 3].map(
        (i) => html`
          <div class="ov-card" style="cursor:default;animation-delay:${i * 50}ms">
            <span class="skeleton skeleton-line" style="width:60px;height:10px"></span>
            <span class="skeleton skeleton-stat"></span>
            <span class="skeleton skeleton-line skeleton-line--medium" style="height:12px"></span>
          </div>
        `,
      )}
    </section>
  `;
}

export function renderOverviewCards(props: OverviewCardsProps) {
  const dataLoaded =
    props.usageResult != null || props.sessionsResult != null || props.skillsReport != null;
  if (!dataLoaded) {
    return renderSkeletonCards();
  }

  const totals = props.usageResult?.totals;
  const totalCost = formatCost(totals?.totalCost);
  const totalTokens = formatTokens(totals?.totalTokens);
  const totalMessages = totals ? String(props.usageResult?.aggregates?.messages?.total ?? 0) : "0";
  const sessionCount = props.sessionsResult?.count ?? null;
  const costTrend = buildDailyCostTrend(props.usageResult);
  const sessionTrend = buildDailySessionTrend(props.sessionsResult);

  const skills = props.skillsReport?.skills ?? [];
  const enabledSkills = skills.filter((s) => !s.disabled).length;
  const blockedSkills = skills.filter((s) => s.blockedByAllowlist).length;
  const totalSkills = skills.length;

  const cronEnabled = props.cronStatus?.enabled ?? null;
  const cronNext = props.cronStatus?.nextWakeAtMs ?? null;
  const cronJobCount = props.cronJobs.length;
  const failedCronCount = props.cronJobs.filter((j) => j.state?.lastStatus === "error").length;

  const cronValue =
    cronEnabled == null
      ? t("common.na")
      : cronEnabled
        ? `${cronJobCount} jobs`
        : t("common.disabled");

  const cronHint =
    failedCronCount > 0
      ? html`<span class="danger">${failedCronCount} failed</span>`
      : cronNext
        ? t("overview.stats.cronNext", { time: formatNextRun(cronNext) })
        : "";

  const cards: StatCard[] = [
    {
      kind: "cost",
      tab: "usage",
      label: t("overview.cards.cost"),
      value: totalCost,
      hint: `${totalTokens} tokens · ${totalMessages} msgs`,
      sparkline: costTrend,
      sparklineLabel: "7-day cost trend",
    },
    {
      kind: "sessions",
      tab: "sessions",
      label: t("overview.stats.sessions"),
      value: String(sessionCount ?? t("common.na")),
      hint: t("overview.stats.sessionsHint"),
      sparkline: sessionTrend,
      sparklineLabel: "7-day session activity",
    },
    {
      kind: "skills",
      tab: "skills",
      label: t("overview.cards.skills"),
      value: `${enabledSkills}/${totalSkills}`,
      hint: blockedSkills > 0 ? `${blockedSkills} blocked` : `${enabledSkills} active`,
    },
    {
      kind: "cron",
      tab: "cron",
      label: t("overview.stats.cron"),
      value: cronValue,
      hint: cronHint,
    },
  ];

  // Model auth card — show providers whose auth needs monitoring.
  // See isMonitoredAuthProvider for the exact predicate.
  //
  // Rendered while loading (modelAuthStatus === null) so the card slot stays
  // in the grid instead of snapping in on data arrival, matching the cron
  // card's N/A-placeholder pattern. Still hidden entirely for api-key-only
  // setups post-load (nothing to monitor), which accepts a one-time hide
  // rather than the recurring load-time layout shift.
  const authLoading = props.modelAuthStatus === null;
  const authProviders = props.modelAuthStatus?.providers ?? [];
  const monitoredProviders = authProviders.filter(isMonitoredAuthProvider);
  if (authLoading) {
    cards.push({
      kind: "auth",
      tab: "overview",
      label: t("overview.cards.modelAuth"),
      value: t("common.na"),
      hint: "",
    });
  } else if (monitoredProviders.length > 0) {
    const expired = monitoredProviders.filter(
      (p) => p.status === "expired" || p.status === "missing",
    ).length;
    const expiring = monitoredProviders.filter((p) => p.status === "expiring").length;
    const authValue =
      expired > 0
        ? html`<span class="danger"
            >${t("overview.cards.modelAuthExpired", { count: String(expired) })}</span
          >`
        : expiring > 0
          ? html`<span class="warn"
              >${t("overview.cards.modelAuthExpiring", { count: String(expiring) })}</span
            >`
          : t("overview.cards.modelAuthOk", { count: String(monitoredProviders.length) });

    // Format a window reset time compactly (e.g. "2:43 PM", "Apr 16").
    // Hidden for windows with plenty of headroom to keep the hint readable;
    // shown when a window is below 25% to signal urgency.
    const formatReset = (resetAt: number | undefined, pctLeft: number): string | null => {
      if (!resetAt || !Number.isFinite(resetAt) || pctLeft >= 25) {
        return null;
      }
      const d = new Date(resetAt);
      if (Number.isNaN(d.getTime())) {
        return null;
      }
      const withinADay = resetAt - Date.now() < 24 * 60 * 60 * 1000;
      return withinADay
        ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    const hintParts = monitoredProviders
      .map((p) => {
        const bits: string[] = [];
        for (const w of p.usage?.windows ?? []) {
          // Clamp to [0, 100] — providers can report usedPercent > 100 when
          // fully exhausted, which would render as "-5% left" without this.
          const pctLeft = Math.max(0, Math.min(100, Math.round(100 - w.usedPercent)));
          const label = (w.label || "").trim();
          const prefix = label ? `${label} ` : "";
          const pctStr = t("overview.cards.modelAuthUsageLeft", { pct: String(pctLeft) });
          const resetStr = formatReset(w.resetAt, pctLeft);
          bits.push(resetStr ? `${prefix}${pctStr} (${resetStr})` : `${prefix}${pctStr}`);
        }
        if (
          p.expiry &&
          Number.isFinite(p.expiry.at) &&
          p.status !== "static" &&
          p.expiry.label &&
          p.expiry.label !== "unknown"
        ) {
          bits.push(t("overview.cards.modelAuthExpiresIn", { when: p.expiry.label }));
        }
        return bits.length > 0 ? `${p.displayName}: ${bits.join(", ")}` : null;
      })
      .filter((s): s is string => s !== null)
      .slice(0, 2);
    const authHint =
      hintParts.join(" · ") ||
      t("overview.cards.modelAuthProviders", { count: String(monitoredProviders.length) });

    const authTone = resolveAuthTone(monitoredProviders);
    cards.push({
      kind: "auth",
      tab: "overview",
      label: t("overview.cards.modelAuth"),
      value: authValue,
      hint: authHint,
      tone: authTone,
      icon: authTone ? icons.alertTriangle : undefined,
    });
  }

  const sessions = props.sessionsResult?.sessions.slice(0, 5) ?? [];

  return html`
    <section class="ov-cards">${cards.map((c) => renderStatCard(c, props.onNavigate))}</section>

    ${sessions.length > 0
      ? html`
          <section class="ov-recent">
            <h3 class="ov-recent__title">${t("overview.cards.recentSessions")}</h3>
            <ul class="ov-recent__list">
              ${sessions.map(
                (s) => html`
                  <li class="ov-recent__row" title=${s.key}>
                    <span class="ov-recent__identity">
                      <span
                        class="ov-recent__status ov-recent__status--${resolveSessionState(s)}"
                        title=${resolveSessionState(s)}
                      ></span>
                      <span class="ov-recent__key">${resolveSessionTitle(s)}</span>
                    </span>
                    ${s.model
                      ? html`<span class="ov-recent__model-pill">${s.model}</span>`
                      : html`<span></span>`}
                    <span class="ov-recent__time"
                      >${s.updatedAt ? formatRelativeTimestamp(s.updatedAt) : ""}</span
                    >
                    <button
                      type="button"
                      class="ov-recent__open"
                      @click=${() => props.onOpenSessionChat(s.key)}
                    >
                      Open Chat
                    </button>
                  </li>
                `,
              )}
            </ul>
          </section>
        `
      : nothing}
  `;
}
