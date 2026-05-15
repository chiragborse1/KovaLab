import { html, nothing } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { t } from "../../i18n/index.ts";
import type {
  CronFieldErrors,
  CronFieldKey,
  CronJobsLastStatusFilter,
  CronJobsScheduleKindFilter,
} from "../controllers/cron.ts";
import { formatRelativeTimestamp, formatMs } from "../format.ts";
import { toSanitizedMarkdownHtml } from "../markdown.ts";
import { pathForTab } from "../navigation.ts";
import { formatCronSchedule, formatNextRun } from "../presenter.ts";
import type { ChannelUiMetaEntry, CronJob, CronRunLogEntry, CronStatus } from "../types.ts";
import type {
  CronDeliveryStatus,
  CronJobsEnabledFilter,
  CronRunScope,
  CronRunsStatusValue,
  CronJobsSortBy,
  CronRunsStatusFilter,
  CronSortDir,
} from "../types.ts";
import type { CronFormState } from "../ui-types.ts";

export type CronProps = {
  basePath: string;
  loading: boolean;
  jobsLoadingMore: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  jobsTotal: number;
  jobsHasMore: boolean;
  jobsQuery: string;
  jobsEnabledFilter: CronJobsEnabledFilter;
  jobsScheduleKindFilter: CronJobsScheduleKindFilter;
  jobsLastStatusFilter: CronJobsLastStatusFilter;
  jobsSortBy: CronJobsSortBy;
  jobsSortDir: CronSortDir;
  error: string | null;
  busy: boolean;
  form: CronFormState;
  fieldErrors: CronFieldErrors;
  canSubmit: boolean;
  editingJobId: string | null;
  channels: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  runsJobId: string | null;
  runs: CronRunLogEntry[];
  runsTotal: number;
  runsHasMore: boolean;
  runsLoadingMore: boolean;
  runsScope: CronRunScope;
  runsStatuses: CronRunsStatusValue[];
  runsDeliveryStatuses: CronDeliveryStatus[];
  runsStatusFilter: CronRunsStatusFilter;
  runsQuery: string;
  runsSortDir: CronSortDir;
  agentSuggestions: string[];
  modelSuggestions: string[];
  thinkingSuggestions: string[];
  timezoneSuggestions: string[];
  deliveryToSuggestions: string[];
  accountSuggestions: string[];
  onFormChange: (patch: Partial<CronFormState>) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onEdit: (job: CronJob) => void;
  onClone: (job: CronJob) => void;
  onCancelEdit: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob, mode?: "force" | "due") => void;
  onRemove: (job: CronJob) => void;
  /** Open the simplified creation wizard. */
  onQuickCreate?: () => void;
  onLoadRuns: (jobId: string) => void;
  onLoadMoreJobs: () => void;
  onJobsFiltersChange: (patch: {
    cronJobsQuery?: string;
    cronJobsEnabledFilter?: CronJobsEnabledFilter;
    cronJobsScheduleKindFilter?: CronJobsScheduleKindFilter;
    cronJobsLastStatusFilter?: CronJobsLastStatusFilter;
    cronJobsSortBy?: CronJobsSortBy;
    cronJobsSortDir?: CronSortDir;
  }) => void | Promise<void>;
  onJobsFiltersReset: () => void | Promise<void>;
  onLoadMoreRuns: () => void;
  onRunsFiltersChange: (patch: {
    cronRunsScope?: CronRunScope;
    cronRunsStatuses?: CronRunsStatusValue[];
    cronRunsDeliveryStatuses?: CronDeliveryStatus[];
    cronRunsStatusFilter?: CronRunsStatusFilter;
    cronRunsQuery?: string;
    cronRunsSortDir?: CronSortDir;
  }) => void | Promise<void>;
  onNavigateToChat?: (sessionKey: string) => void;
};

function getRunStatusOptions(): Array<{ value: CronRunsStatusValue; label: string }> {
  return [
    { value: "ok", label: t("cron.runs.runStatusOk") },
    { value: "error", label: t("cron.runs.runStatusError") },
    { value: "skipped", label: t("cron.runs.runStatusSkipped") },
  ];
}

function getRunDeliveryOptions(): Array<{ value: CronDeliveryStatus; label: string }> {
  return [
    { value: "delivered", label: t("cron.runs.deliveryDelivered") },
    { value: "not-delivered", label: t("cron.runs.deliveryNotDelivered") },
    { value: "unknown", label: t("cron.runs.deliveryUnknown") },
    { value: "not-requested", label: t("cron.runs.deliveryNotRequested") },
  ];
}

function toggleSelection<T extends string>(selected: T[], value: T, checked: boolean): T[] {
  const set = new Set(selected);
  if (checked) {
    set.add(value);
  } else {
    set.delete(value);
  }
  return Array.from(set);
}

function summarizeSelection(selectedLabels: string[], allLabel: string) {
  if (selectedLabels.length === 0) {
    return allLabel;
  }
  if (selectedLabels.length <= 2) {
    return selectedLabels.join(", ");
  }
  return `${selectedLabels[0]} +${selectedLabels.length - 1}`;
}

function buildChannelOptions(props: CronProps): string[] {
  const options = ["last", ...props.channels.filter(Boolean)];
  const current = props.form.deliveryChannel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  const seen = new Set<string>();
  return options.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function resolveChannelLabel(props: CronProps, channel: string): string {
  if (channel === "last") {
    return "last";
  }
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) {
    return meta.label;
  }
  return props.channelLabels?.[channel] ?? channel;
}

function renderRunFilterDropdown(params: {
  id: string;
  title: string;
  summary: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  onClear: () => void;
}) {
  return html`
    <div class="field cron-filter-dropdown" data-filter=${params.id}>
      <span>${params.title}</span>
      <details class="cron-filter-dropdown__details">
        <summary class="btn cron-filter-dropdown__trigger">
          <span>${params.summary}</span>
        </summary>
        <div class="cron-filter-dropdown__panel">
          <div class="cron-filter-dropdown__list">
            ${params.options.map(
              (option) => html`
                <label class="cron-filter-dropdown__option">
                  <input
                    type="checkbox"
                    value=${option.value}
                    .checked=${params.selected.includes(option.value)}
                    @change=${(event: Event) => {
                      const target = event.target as HTMLInputElement;
                      params.onToggle(option.value, target.checked);
                    }}
                  />
                  <span>${option.label}</span>
                </label>
              `,
            )}
          </div>
          <div class="row">
            <button class="btn" type="button" @click=${params.onClear}>
              ${t("cron.runs.clear")}
            </button>
          </div>
        </div>
      </details>
    </div>
  `;
}

function renderSuggestionList(id: string, options: string[]) {
  const clean = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));
  if (clean.length === 0) {
    return nothing;
  }
  return html`<datalist id=${id}>
    ${clean.map((value) => html`<option value=${value}></option> `)}
  </datalist>`;
}

type BlockingField = {
  key: CronFieldKey;
  label: string;
  message: string;
  inputId: string;
};

function errorIdForField(key: CronFieldKey) {
  return `cron-error-${key}`;
}

function inputIdForField(key: CronFieldKey) {
  if (key === "name") {
    return "cron-name";
  }
  if (key === "scheduleAt") {
    return "cron-schedule-at";
  }
  if (key === "everyAmount") {
    return "cron-every-amount";
  }
  if (key === "cronExpr") {
    return "cron-cron-expr";
  }
  if (key === "staggerAmount") {
    return "cron-stagger-amount";
  }
  if (key === "payloadText") {
    return "cron-payload-text";
  }
  if (key === "payloadModel") {
    return "cron-payload-model";
  }
  if (key === "payloadThinking") {
    return "cron-payload-thinking";
  }
  if (key === "timeoutSeconds") {
    return "cron-timeout-seconds";
  }
  if (key === "failureAlertAfter") {
    return "cron-failure-alert-after";
  }
  if (key === "failureAlertCooldownSeconds") {
    return "cron-failure-alert-cooldown-seconds";
  }
  return "cron-delivery-to";
}

function fieldLabelForKey(
  key: CronFieldKey,
  form: CronFormState,
  deliveryMode: CronFormState["deliveryMode"],
) {
  if (key === "payloadText") {
    return form.payloadKind === "systemEvent"
      ? t("cron.form.mainTimelineMessage")
      : t("cron.form.assistantTaskPrompt");
  }
  if (key === "deliveryTo") {
    return deliveryMode === "webhook" ? t("cron.form.webhookUrl") : t("cron.form.to");
  }
  const labels: Record<CronFieldKey, string> = {
    name: t("cron.form.fieldName"),
    scheduleAt: t("cron.form.runAt"),
    everyAmount: t("cron.form.every"),
    cronExpr: t("cron.form.expression"),
    staggerAmount: t("cron.form.staggerWindow"),
    payloadText: t("cron.form.assistantTaskPrompt"),
    payloadModel: t("cron.form.model"),
    payloadThinking: t("cron.form.thinking"),
    timeoutSeconds: t("cron.form.timeoutSeconds"),
    deliveryTo: t("cron.form.to"),
    failureAlertAfter: "Failure alert after",
    failureAlertCooldownSeconds: "Failure alert cooldown",
  };
  return labels[key];
}

function collectBlockingFields(
  errors: CronFieldErrors,
  form: CronFormState,
  deliveryMode: CronFormState["deliveryMode"],
): BlockingField[] {
  const orderedKeys: CronFieldKey[] = [
    "name",
    "scheduleAt",
    "everyAmount",
    "cronExpr",
    "staggerAmount",
    "payloadText",
    "payloadModel",
    "payloadThinking",
    "timeoutSeconds",
    "deliveryTo",
    "failureAlertAfter",
    "failureAlertCooldownSeconds",
  ];
  const fields: BlockingField[] = [];
  for (const key of orderedKeys) {
    const message = errors[key];
    if (!message) {
      continue;
    }
    fields.push({
      key,
      label: fieldLabelForKey(key, form, deliveryMode),
      message,
      inputId: inputIdForField(key),
    });
  }
  return fields;
}

function focusFormField(id: string) {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  el.focus();
}

function renderFieldLabel(text: string, required = false) {
  return html`<span>
    ${text}
    ${required
      ? html`
          <span class="cron-required-marker" aria-hidden="true">*</span>
          <span class="cron-required-sr">${t("cron.form.requiredSr")}</span>
        `
      : nothing}
  </span>`;
}

type CronJobStats = {
  enabled: number;
  disabled: number;
  failing: number;
  skipped: number;
  dueNow: number;
  delivering: number;
};

function collectJobStats(jobs: CronJob[], nowMs = Date.now()): CronJobStats {
  return jobs.reduce<CronJobStats>(
    (stats, job) => {
      if (job.enabled) {
        stats.enabled += 1;
      } else {
        stats.disabled += 1;
      }
      if (job.state?.lastStatus === "error") {
        stats.failing += 1;
      }
      if (job.state?.lastStatus === "skipped") {
        stats.skipped += 1;
      }
      if (
        job.enabled &&
        typeof job.state?.nextRunAtMs === "number" &&
        job.state.nextRunAtMs <= nowMs
      ) {
        stats.dueNow += 1;
      }
      if (job.delivery?.mode && job.delivery.mode !== "none") {
        stats.delivering += 1;
      }
      return stats;
    },
    { enabled: 0, disabled: 0, failing: 0, skipped: 0, dueNow: 0, delivering: 0 },
  );
}

function statusToneForJob(job: CronJob): "ok" | "danger" | "warn" | "muted" {
  if (!job.enabled) {
    return "muted";
  }
  if (job.state?.lastStatus === "error") {
    return "danger";
  }
  if (job.state?.lastStatus === "skipped") {
    return "warn";
  }
  return "ok";
}

function labelForScheduleKind(job: CronJob): string {
  if (job.schedule.kind === "at") {
    return t("cron.form.at");
  }
  if (job.schedule.kind === "every") {
    return t("cron.form.every");
  }
  return t("cron.form.cronOption");
}

function jobDeliveryLabel(job: CronJob): string {
  if (!job.delivery || job.delivery.mode === "none") {
    return t("cron.form.noneInternal");
  }
  if (job.delivery.mode === "webhook") {
    return t("cron.form.webhookPost");
  }
  return t("cron.form.announceDefault");
}

function renderMetricCell(params: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "ok" | "danger" | "warn" | "muted";
}) {
  return html`
    <div class=${`cron-metric-cell ${params.tone ? `is-${params.tone}` : ""}`}>
      <span>${params.label}</span>
      <strong>${params.value}</strong>
      ${params.sub ? html`<small>${params.sub}</small>` : nothing}
    </div>
  `;
}

function renderCronSummary(props: CronProps, stats: CronJobStats) {
  const nextWake = formatNextRun(props.status?.nextWakeAtMs ?? null);
  const failedJobs = props.jobs.filter((job) => job.state?.lastStatus === "error");
  const failedEnabledJobs = failedJobs.filter((job) => job.enabled);
  return html`
    <section class="card cron-summary-strip cron-command-center">
      <div class="cron-command-center__head">
        <div>
          <div class="card-title">Cron Command Center</div>
          <div class="card-sub">
            Schedule agent work, inspect delivery, and replay failed runs without leaving the page.
          </div>
        </div>
        <div class="cron-summary-strip__actions">
          ${failedJobs.length > 0
            ? html`
                <button
                  class="btn"
                  ?disabled=${props.busy}
                  @click=${() => {
                    for (const job of failedJobs) {
                      props.onRun(job, "force");
                    }
                  }}
                >
                  Retry failed
                </button>
              `
            : nothing}
          ${failedEnabledJobs.length > 0
            ? html`
                <button
                  class="btn danger"
                  ?disabled=${props.busy}
                  @click=${() => {
                    for (const job of failedEnabledJobs) {
                      props.onToggle(job, false);
                    }
                  }}
                >
                  Pause failed
                </button>
              `
            : nothing}
          ${props.onQuickCreate
            ? html`<button class="btn btn--primary" @click=${props.onQuickCreate}>+ New</button>`
            : nothing}
          <button
            class=${props.loading ? "btn cron-refresh-btn--loading" : "btn"}
            ?disabled=${props.loading}
            @click=${props.onRefresh}
          >
            ${props.loading ? t("cron.summary.refreshing") : t("cron.summary.refresh")}
          </button>
        </div>
      </div>
      <div class="cron-metric-grid">
        ${renderMetricCell({
          label: t("cron.summary.enabled"),
          value: props.status
            ? props.status.enabled
              ? t("cron.summary.yes")
              : t("cron.summary.no")
            : t("common.na"),
          sub: props.status ? `${props.status.jobs} ${t("cron.summary.jobs").toLowerCase()}` : "",
          tone: props.status ? (props.status.enabled ? "ok" : "danger") : "muted",
        })}
        ${renderMetricCell({
          label: "Active jobs",
          value: stats.enabled,
          sub: `${stats.disabled} disabled`,
          tone: stats.enabled > 0 ? "ok" : "muted",
        })}
        ${renderMetricCell({
          label: "Attention",
          value: stats.failing,
          sub: stats.skipped > 0 ? `${stats.skipped} skipped` : "last run errors",
          tone: stats.failing > 0 ? "danger" : stats.skipped > 0 ? "warn" : "ok",
        })}
        ${renderMetricCell({
          label: t("cron.summary.nextWake"),
          value: nextWake,
          sub: stats.dueNow > 0 ? `${stats.dueNow} due now` : "scheduler queue",
          tone: stats.dueNow > 0 ? "warn" : "muted",
        })}
        ${renderMetricCell({
          label: "Delivery",
          value: stats.delivering,
          sub: "announce/webhook jobs",
          tone: stats.delivering > 0 ? "ok" : "muted",
        })}
      </div>
      ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}
    </section>
  `;
}

function renderTemplateButton(params: {
  title: string;
  detail: string;
  patch: Partial<CronFormState>;
  props: CronProps;
}) {
  return html`
    <button
      class="cron-template"
      type="button"
      @click=${() => params.props.onFormChange(params.patch)}
    >
      <strong>${params.title}</strong>
      <span>${params.detail}</span>
    </button>
  `;
}

function renderTemplateRail(props: CronProps) {
  return html`
    <div class="cron-template-rail">
      ${renderTemplateButton({
        title: "Morning briefing",
        detail: "7 AM daily agent brief",
        props,
        patch: {
          name: "Morning briefing",
          description: "Daily briefing from recent workspace and channel context.",
          scheduleKind: "cron",
          cronExpr: "0 7 * * *",
          sessionTarget: "isolated",
          payloadKind: "agentTurn",
          payloadText: "Prepare a concise morning briefing with priorities, risks, and follow-ups.",
          deliveryMode: "announce",
          wakeMode: "now",
          deleteAfterRun: false,
        },
      })}
      ${renderTemplateButton({
        title: "Weekly cost report",
        detail: "Monday 9 AM usage audit",
        props,
        patch: {
          name: "Weekly cost report",
          description: "Weekly cost, token, and model usage summary.",
          scheduleKind: "cron",
          cronExpr: "0 9 * * 1",
          sessionTarget: "isolated",
          payloadKind: "agentTurn",
          payloadText:
            "Generate a weekly cost report with model spend, token usage, anomalies, and recommended savings.",
          deliveryMode: "announce",
          wakeMode: "now",
          deleteAfterRun: false,
        },
      })}
      ${renderTemplateButton({
        title: "Memory dreaming",
        detail: "Nightly memory promotion",
        props,
        patch: {
          name: "Memory dreaming",
          description: "Promote durable memory from recent work.",
          scheduleKind: "cron",
          cronExpr: "30 2 * * *",
          sessionTarget: "isolated",
          payloadKind: "agentTurn",
          payloadText:
            "Review recent sessions and promote durable insights, preferences, and project facts into memory.",
          deliveryMode: "none",
          wakeMode: "now",
          deleteAfterRun: false,
        },
      })}
      ${renderTemplateButton({
        title: "Channel digest",
        detail: "6 PM channel summary",
        props,
        patch: {
          name: "Channel digest",
          description: "Summarize unread channel activity.",
          scheduleKind: "cron",
          cronExpr: "0 18 * * *",
          sessionTarget: "isolated",
          payloadKind: "agentTurn",
          payloadText:
            "Summarize important channel activity, unanswered messages, decisions, and follow-up tasks.",
          deliveryMode: "announce",
          wakeMode: "now",
          deleteAfterRun: false,
        },
      })}
      ${renderTemplateButton({
        title: "Reminder",
        detail: "Main timeline wakeup",
        props,
        patch: {
          name: "Reminder",
          scheduleKind: "at",
          sessionTarget: "main",
          payloadKind: "systemEvent",
          wakeMode: "now",
          deliveryMode: "none",
          deleteAfterRun: true,
        },
      })}
      ${renderTemplateButton({
        title: "Webhook",
        detail: "POST result payload",
        props,
        patch: {
          name: "Webhook report",
          scheduleKind: "cron",
          cronExpr: "0 8 * * *",
          sessionTarget: "isolated",
          payloadKind: "agentTurn",
          payloadText:
            "Run the scheduled task and POST the result payload to the configured webhook.",
          deliveryMode: "webhook",
          wakeMode: "now",
          deleteAfterRun: false,
        },
      })}
    </div>
  `;
}

type SchedulePreview = {
  rows: string[];
  warnings: string[];
};

type CronFieldMatcher = (value: number) => boolean;

function formatPreviewDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseEveryAmount(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function everyUnitMs(unit: CronFormState["everyUnit"]): number {
  if (unit === "days") {
    return 24 * 60 * 60 * 1000;
  }
  if (unit === "hours") {
    return 60 * 60 * 1000;
  }
  return 60 * 1000;
}

function isWildcardCronField(field: string): boolean {
  const trimmed = field.trim();
  return trimmed === "*" || trimmed === "?";
}

function parseCronNumber(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function parseCronFieldMatcher(field: string, min: number, max: number): CronFieldMatcher | null {
  const segments = field
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  const ranges: Array<{ start: number; end: number; step: number }> = [];
  for (const segment of segments) {
    const parts = segment.split("/");
    if (parts.length > 2) {
      return null;
    }
    const rangeRaw = parts[0] ?? "";
    const step = parts[1] ? parseCronNumber(parts[1], 1, max - min + 1) : 1;
    if (step == null) {
      return null;
    }
    let start: number;
    let end: number;
    if (rangeRaw === "*" || rangeRaw === "?") {
      start = min;
      end = max;
    } else if (rangeRaw.includes("-")) {
      const [startRaw, endRaw] = rangeRaw.split("-");
      if (!startRaw || !endRaw) {
        return null;
      }
      const parsedStart = parseCronNumber(startRaw, min, max);
      const parsedEnd = parseCronNumber(endRaw, min, max);
      if (parsedStart == null || parsedEnd == null || parsedStart > parsedEnd) {
        return null;
      }
      start = parsedStart;
      end = parsedEnd;
    } else {
      const parsed = parseCronNumber(rangeRaw, min, max);
      if (parsed == null) {
        return null;
      }
      start = parsed;
      end = parsed;
    }
    ranges.push({ start, end, step });
  }
  return (value: number) =>
    ranges.some(
      ({ start, end, step }) => value >= start && value <= end && (value - start) % step === 0,
    );
}

function isKnownTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function buildCronExpressionPreview(form: CronFormState, now: Date): SchedulePreview {
  const warnings: string[] = [];
  const rawFields = form.cronExpr.trim().split(/\s+/).filter(Boolean);
  const fields = rawFields.length === 6 ? rawFields.slice(1) : rawFields;
  if (fields.length !== 5) {
    return {
      rows: [],
      warnings: form.cronExpr.trim()
        ? [
            "Preview supports common 5-field cron expressions. The gateway will validate the full expression when saving.",
          ]
        : [],
    };
  }

  const [minuteRaw, hourRaw, dayOfMonthRaw, monthRaw, dayOfWeekRaw] = fields;
  const minute = parseCronFieldMatcher(minuteRaw, 0, 59);
  const hour = parseCronFieldMatcher(hourRaw, 0, 23);
  const dayOfMonth = parseCronFieldMatcher(dayOfMonthRaw, 1, 31);
  const month = parseCronFieldMatcher(monthRaw, 1, 12);
  const dayOfWeek = parseCronFieldMatcher(dayOfWeekRaw, 0, 7);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return {
      rows: [],
      warnings: [
        "Preview could not parse this expression locally. The gateway will still validate it with the scheduler.",
      ],
    };
  }

  const dayOfMonthWildcard = isWildcardCronField(dayOfMonthRaw);
  const dayOfWeekWildcard = isWildcardCronField(dayOfWeekRaw);
  if (!dayOfMonthWildcard && !dayOfWeekWildcard) {
    warnings.push(
      "Day-of-month and day-of-week are both set. Cron uses OR behavior here, so either field can trigger a run.",
    );
  }
  const timezone = form.cronTz.trim();
  if (timezone && !isKnownTimeZone(timezone)) {
    warnings.push(
      "Timezone is not recognized by this browser. The gateway will validate it when saving.",
    );
  } else if (timezone) {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserZone && timezone !== browserZone) {
      warnings.push(
        `Preview is shown in browser local time (${browserZone}); the gateway will schedule in ${timezone}.`,
      );
    }
  }

  const rows: string[] = [];
  const cursor = new Date(now);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  for (let i = 0; i < 200_000 && rows.length < 5; i += 1) {
    const cronDayOfWeek = cursor.getDay();
    const matchesDayOfWeek = dayOfWeek(cronDayOfWeek) || (cronDayOfWeek === 0 && dayOfWeek(7));
    const matchesDayOfMonth = dayOfMonth(cursor.getDate());
    const matchesDay =
      !dayOfMonthWildcard && !dayOfWeekWildcard
        ? matchesDayOfMonth || matchesDayOfWeek
        : matchesDayOfMonth && matchesDayOfWeek;
    if (
      minute(cursor.getMinutes()) &&
      hour(cursor.getHours()) &&
      month(cursor.getMonth() + 1) &&
      matchesDay
    ) {
      rows.push(formatPreviewDate(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  if (rows.length === 0) {
    warnings.push("No local preview matches were found in the next 138 days.");
  }
  return { rows, warnings };
}

function buildSchedulePreview(form: CronFormState, now = new Date()): SchedulePreview {
  if (form.scheduleKind === "at") {
    if (!form.scheduleAt.trim()) {
      return { rows: [], warnings: [] };
    }
    const date = new Date(form.scheduleAt);
    if (Number.isNaN(date.getTime())) {
      return { rows: [], warnings: ["Run-at value is not a valid date yet."] };
    }
    return { rows: [formatPreviewDate(date)], warnings: [] };
  }
  if (form.scheduleKind === "every") {
    const amount = parseEveryAmount(form.everyAmount);
    if (amount == null) {
      return { rows: [], warnings: [] };
    }
    const intervalMs = amount * everyUnitMs(form.everyUnit);
    return {
      rows: Array.from({ length: 5 }, (_, index) =>
        formatPreviewDate(new Date(now.getTime() + intervalMs * (index + 1))),
      ),
      warnings: [],
    };
  }
  return buildCronExpressionPreview(form, now);
}

function renderSchedulePreview(form: CronFormState) {
  const preview = buildSchedulePreview(form);
  if (preview.rows.length === 0 && preview.warnings.length === 0) {
    return nothing;
  }
  return html`
    <div class="cron-schedule-preview">
      <div class="cron-schedule-preview__head">
        <span>Schedule preview</span>
        ${preview.rows.length > 1 ? html`<small>Next ${preview.rows.length}</small>` : nothing}
      </div>
      ${preview.rows.length > 0
        ? html`
            <ol class="cron-schedule-preview__list">
              ${preview.rows.map((row) => html`<li>${row}</li>`)}
            </ol>
          `
        : nothing}
      ${preview.warnings.length > 0
        ? html`
            <ul class="cron-schedule-preview__warnings">
              ${preview.warnings.map((warning) => html`<li>${warning}</li>`)}
            </ul>
          `
        : nothing}
    </div>
  `;
}

function renderSelectedJobPanel(job: CronJob | undefined, props: CronProps) {
  if (!job) {
    return html`
      <section class="card cron-selected-job">
        <div class="card-title">No job selected</div>
        <div class="card-sub">
          Select a job to inspect schedule, delivery, run history, and quick actions.
        </div>
        <div class="cron-empty-action-row">
          ${props.onQuickCreate
            ? html`<button class="btn btn--primary" @click=${props.onQuickCreate}>
                + New job
              </button>`
            : nothing}
        </div>
      </section>
    `;
  }
  const tone = statusToneForJob(job);
  return html`
    <section class="card cron-selected-job">
      <div class="cron-selected-job__head">
        <div>
          <div class="card-title">${job.name}</div>
          <div class="card-sub">${job.description || formatCronSchedule(job)}</div>
        </div>
        <span class=${`cron-status-dot is-${tone}`}></span>
      </div>
      <div class="cron-selected-job__grid">
        ${renderMetricCell({
          label: "Schedule",
          value: labelForScheduleKind(job),
          sub: formatCronSchedule(job),
          tone: job.enabled ? "ok" : "muted",
        })}
        ${renderMetricCell({
          label: t("cron.jobState.next"),
          value: formatStateRelative(job.state?.nextRunAtMs),
          sub: formatMs(job.state?.nextRunAtMs),
          tone: "muted",
        })}
        ${renderMetricCell({
          label: t("cron.jobState.last"),
          value: formatStateRelative(job.state?.lastRunAtMs),
          sub: job.state?.lastStatus ?? t("common.na"),
          tone,
        })}
        ${renderMetricCell({
          label: t("cron.jobDetail.delivery"),
          value: jobDeliveryLabel(job),
          sub: job.delivery?.to || job.delivery?.channel || job.delivery?.mode || "internal",
          tone: job.delivery?.mode && job.delivery.mode !== "none" ? "ok" : "muted",
        })}
      </div>
      <div class="row cron-selected-job__actions">
        <button class="btn" ?disabled=${props.busy} @click=${() => props.onEdit(job)}>
          ${t("cron.jobList.edit")}
        </button>
        <button class="btn" ?disabled=${props.busy} @click=${() => props.onClone(job)}>
          ${t("cron.jobList.clone")}
        </button>
        <button class="btn" ?disabled=${props.busy} @click=${() => props.onRun(job, "force")}>
          ${t("cron.jobList.run")}
        </button>
        <button
          class="btn"
          ?disabled=${props.busy}
          @click=${() => props.onToggle(job, !job.enabled)}
        >
          ${job.enabled ? t("cron.jobList.disable") : t("cron.jobList.enable")}
        </button>
        ${renderRemoveConfirmation(job, props, (action) => action())}
      </div>
    </section>
  `;
}

export function renderCron(props: CronProps) {
  const isEditing = Boolean(props.editingJobId);
  const isAgentTurn = props.form.payloadKind === "agentTurn";
  const isCronSchedule = props.form.scheduleKind === "cron";
  const channelOptions = buildChannelOptions(props);
  const selectedJob =
    props.runsJobId == null ? undefined : props.jobs.find((job) => job.id === props.runsJobId);
  const jobStats = collectJobStats(props.jobs);
  const selectedRunTitle =
    props.runsScope === "all"
      ? t("cron.jobList.allJobs")
      : (selectedJob?.name ?? props.runsJobId ?? t("cron.jobList.selectJob"));
  const runs = props.runs.toSorted((a, b) =>
    props.runsSortDir === "asc" ? a.ts - b.ts : b.ts - a.ts,
  );
  const runStatusOptions = getRunStatusOptions();
  const runDeliveryOptions = getRunDeliveryOptions();
  const selectedStatusLabels = runStatusOptions
    .filter((option) => props.runsStatuses.includes(option.value))
    .map((option) => option.label);
  const selectedDeliveryLabels = runDeliveryOptions
    .filter((option) => props.runsDeliveryStatuses.includes(option.value))
    .map((option) => option.label);
  const statusSummary = summarizeSelection(selectedStatusLabels, t("cron.runs.allStatuses"));
  const deliverySummary = summarizeSelection(selectedDeliveryLabels, t("cron.runs.allDelivery"));
  const supportsAnnounce =
    props.form.sessionTarget !== "main" && props.form.payloadKind === "agentTurn";
  const selectedDeliveryMode =
    props.form.deliveryMode === "announce" && !supportsAnnounce ? "none" : props.form.deliveryMode;
  const blockingFields = collectBlockingFields(props.fieldErrors, props.form, selectedDeliveryMode);
  const blockedByValidation = !props.busy && blockingFields.length > 0;
  const hasActiveJobsFilters =
    props.jobsQuery.trim().length > 0 ||
    props.jobsEnabledFilter !== "all" ||
    props.jobsScheduleKindFilter !== "all" ||
    props.jobsLastStatusFilter !== "all" ||
    props.jobsSortBy !== "nextRunAtMs" ||
    props.jobsSortDir !== "asc";
  const submitDisabledReason =
    blockedByValidation && !props.canSubmit
      ? blockingFields.length === 1
        ? t("cron.form.fixFields", { count: String(blockingFields.length) })
        : t("cron.form.fixFieldsPlural", { count: String(blockingFields.length) })
      : "";
  return html`
    ${renderCronSummary(props, jobStats)}
    <section class="cron-workspace">
      <div class="cron-workspace-main">
        <section class="card">
          <div
            class="row"
            style="justify-content: space-between; align-items: flex-start; gap: 12px;"
          >
            <div>
              <div class="card-title">${t("cron.jobs.title")}</div>
              <div class="card-sub">${t("cron.jobs.subtitle")}</div>
            </div>
            <div class="muted">
              ${t("cron.jobs.shownOf", {
                shown: String(props.jobs.length),
                total: String(props.jobsTotal),
              })}
            </div>
          </div>
          <div class="filters" style="margin-top: 12px;">
            <label class="field cron-filter-search">
              <span>${t("cron.jobs.searchJobs")}</span>
              <input
                .value=${props.jobsQuery}
                placeholder=${t("cron.jobs.searchPlaceholder")}
                @input=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsQuery: (e.target as HTMLInputElement).value,
                  })}
              />
            </label>
            <label class="field">
              <span>${t("cron.jobs.enabled")}</span>
              <select
                .value=${props.jobsEnabledFilter}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsEnabledFilter: (e.target as HTMLSelectElement)
                      .value as CronJobsEnabledFilter,
                  })}
              >
                <option value="all">${t("cron.jobs.all")}</option>
                <option value="enabled">${t("common.enabled")}</option>
                <option value="disabled">${t("common.disabled")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("cron.jobs.schedule")}</span>
              <select
                data-test-id="cron-jobs-schedule-filter"
                .value=${props.jobsScheduleKindFilter}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsScheduleKindFilter: (e.target as HTMLSelectElement)
                      .value as CronJobsScheduleKindFilter,
                  })}
              >
                <option value="all">${t("cron.jobs.all")}</option>
                <option value="at">${t("cron.form.at")}</option>
                <option value="every">${t("cron.form.every")}</option>
                <option value="cron">${t("cron.form.cronOption")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("cron.jobs.lastRun")}</span>
              <select
                data-test-id="cron-jobs-last-status-filter"
                .value=${props.jobsLastStatusFilter}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsLastStatusFilter: (e.target as HTMLSelectElement)
                      .value as CronJobsLastStatusFilter,
                  })}
              >
                <option value="all">${t("cron.jobs.all")}</option>
                <option value="ok">${t("cron.runs.runStatusOk")}</option>
                <option value="error">${t("cron.runs.runStatusError")}</option>
                <option value="skipped">${t("cron.runs.runStatusSkipped")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("cron.jobs.sort")}</span>
              <select
                .value=${props.jobsSortBy}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsSortBy: (e.target as HTMLSelectElement).value as CronJobsSortBy,
                  })}
              >
                <option value="nextRunAtMs">${t("cron.jobs.nextRun")}</option>
                <option value="updatedAtMs">${t("cron.jobs.recentlyUpdated")}</option>
                <option value="name">${t("cron.jobs.name")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("cron.jobs.direction")}</span>
              <select
                .value=${props.jobsSortDir}
                @change=${(e: Event) =>
                  props.onJobsFiltersChange({
                    cronJobsSortDir: (e.target as HTMLSelectElement).value as CronSortDir,
                  })}
              >
                <option value="asc">${t("cron.jobs.ascending")}</option>
                <option value="desc">${t("cron.jobs.descending")}</option>
              </select>
            </label>
            <label class="field">
              <span>${t("cron.jobs.reset")}</span>
              <button
                class="btn"
                data-test-id="cron-jobs-filters-reset"
                ?disabled=${!hasActiveJobsFilters}
                @click=${props.onJobsFiltersReset}
              >
                ${t("cron.jobs.reset")}
              </button>
            </label>
          </div>
          ${props.jobs.length === 0
            ? html` <div class="muted" style="margin-top: 12px">${t("cron.jobs.noMatching")}</div> `
            : html`
                <div class="list" style="margin-top: 12px;">
                  ${props.jobs.map((job) => renderJob(job, props))}
                </div>
              `}
          ${props.jobsHasMore
            ? html`
                <div class="row" style="margin-top: 12px">
                  <button
                    class="btn"
                    ?disabled=${props.loading || props.jobsLoadingMore}
                    @click=${props.onLoadMoreJobs}
                  >
                    ${props.jobsLoadingMore ? t("cron.jobs.loading") : t("cron.jobs.loadMore")}
                  </button>
                </div>
              `
            : nothing}
        </section>

        <section class="card">
          <div
            class="row"
            style="justify-content: space-between; align-items: flex-start; gap: 12px;"
          >
            <div>
              <div class="card-title">${t("cron.runs.title")}</div>
              <div class="card-sub">
                ${props.runsScope === "all"
                  ? t("cron.runs.subtitleAll")
                  : t("cron.runs.subtitleJob", { title: selectedRunTitle })}
              </div>
            </div>
            <div class="muted">
              ${t("cron.jobs.shownOf", {
                shown: String(runs.length),
                total: String(props.runsTotal),
              })}
            </div>
          </div>
          <div class="cron-run-filters">
            <div class="cron-run-filters__row cron-run-filters__row--primary">
              <label class="field">
                <span>${t("cron.runs.scope")}</span>
                <select
                  .value=${props.runsScope}
                  @change=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsScope: (e.target as HTMLSelectElement).value as CronRunScope,
                    })}
                >
                  <option value="all">${t("cron.runs.allJobs")}</option>
                  <option value="job" ?disabled=${props.runsJobId == null}>
                    ${t("cron.runs.selectedJob")}
                  </option>
                </select>
              </label>
              <label class="field cron-run-filter-search">
                <span>${t("cron.runs.searchRuns")}</span>
                <input
                  .value=${props.runsQuery}
                  placeholder=${t("cron.runs.searchPlaceholder")}
                  @input=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsQuery: (e.target as HTMLInputElement).value,
                    })}
                />
              </label>
              <label class="field">
                <span>${t("cron.jobs.sort")}</span>
                <select
                  .value=${props.runsSortDir}
                  @change=${(e: Event) =>
                    props.onRunsFiltersChange({
                      cronRunsSortDir: (e.target as HTMLSelectElement).value as CronSortDir,
                    })}
                >
                  <option value="desc">${t("cron.runs.newestFirst")}</option>
                  <option value="asc">${t("cron.runs.oldestFirst")}</option>
                </select>
              </label>
            </div>
            <div class="cron-run-filters__row cron-run-filters__row--secondary">
              ${renderRunFilterDropdown({
                id: "status",
                title: t("cron.runs.status"),
                summary: statusSummary,
                options: runStatusOptions,
                selected: props.runsStatuses,
                onToggle: (value, checked) => {
                  const next = toggleSelection(
                    props.runsStatuses,
                    value as CronRunsStatusValue,
                    checked,
                  );
                  void props.onRunsFiltersChange({ cronRunsStatuses: next });
                },
                onClear: () => {
                  void props.onRunsFiltersChange({ cronRunsStatuses: [] });
                },
              })}
              ${renderRunFilterDropdown({
                id: "delivery",
                title: t("cron.runs.delivery"),
                summary: deliverySummary,
                options: runDeliveryOptions,
                selected: props.runsDeliveryStatuses,
                onToggle: (value, checked) => {
                  const next = toggleSelection(
                    props.runsDeliveryStatuses,
                    value as CronDeliveryStatus,
                    checked,
                  );
                  void props.onRunsFiltersChange({ cronRunsDeliveryStatuses: next });
                },
                onClear: () => {
                  void props.onRunsFiltersChange({ cronRunsDeliveryStatuses: [] });
                },
              })}
            </div>
          </div>
          ${props.runsScope === "job" && props.runsJobId == null
            ? html`
                <div class="muted" style="margin-top: 12px">${t("cron.runs.selectJobHint")}</div>
              `
            : runs.length === 0
              ? html`
                  <div class="muted" style="margin-top: 12px">${t("cron.runs.noMatching")}</div>
                `
              : html`
                  <div class="list" style="margin-top: 12px;">
                    ${runs.map((entry) => renderRun(entry, props.basePath, props.onNavigateToChat))}
                  </div>
                `}
          ${(props.runsScope === "all" || props.runsJobId != null) && props.runsHasMore
            ? html`
                <div class="row" style="margin-top: 12px">
                  <button
                    class="btn"
                    ?disabled=${props.runsLoadingMore}
                    @click=${props.onLoadMoreRuns}
                  >
                    ${props.runsLoadingMore ? t("cron.jobs.loading") : t("cron.runs.loadMore")}
                  </button>
                </div>
              `
            : nothing}
        </section>
      </div>

      <section class="card cron-workspace-form">
        ${renderSelectedJobPanel(selectedJob, props)}
        <div class="card-title">${isEditing ? t("cron.form.editJob") : t("cron.form.newJob")}</div>
        <div class="card-sub">
          ${isEditing ? t("cron.form.updateSubtitle") : t("cron.form.createSubtitle")}
        </div>
        <div class="cron-form">
          ${renderTemplateRail(props)}
          <div class="cron-required-legend">
            <span class="cron-required-marker" aria-hidden="true">*</span> ${t(
              "cron.form.required",
            )}
          </div>
          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cron.form.basics")}</div>
            <div class="cron-form-section__sub">${t("cron.form.basicsSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field">
                ${renderFieldLabel(t("cron.form.fieldName"), true)}
                <input
                  id="cron-name"
                  .value=${props.form.name}
                  placeholder=${t("cron.form.namePlaceholder")}
                  aria-invalid=${props.fieldErrors.name ? "true" : "false"}
                  aria-describedby=${ifDefined(
                    props.fieldErrors.name ? errorIdForField("name") : undefined,
                  )}
                  @input=${(e: Event) =>
                    props.onFormChange({ name: (e.target as HTMLInputElement).value })}
                />
                ${renderFieldError(props.fieldErrors.name, errorIdForField("name"))}
              </label>
              <label class="field">
                <span>${t("cron.form.description")}</span>
                <input
                  .value=${props.form.description}
                  placeholder=${t("cron.form.descriptionPlaceholder")}
                  @input=${(e: Event) =>
                    props.onFormChange({ description: (e.target as HTMLInputElement).value })}
                />
              </label>
              <label class="field">
                ${renderFieldLabel(t("cron.form.agentId"))}
                <input
                  id="cron-agent-id"
                  .value=${props.form.agentId}
                  list="cron-agent-suggestions"
                  ?disabled=${props.form.clearAgent}
                  @input=${(e: Event) =>
                    props.onFormChange({ agentId: (e.target as HTMLInputElement).value })}
                  placeholder=${t("cron.form.agentPlaceholder")}
                />
                <div class="cron-help">${t("cron.form.agentHelp")}</div>
              </label>
              <label class="field checkbox cron-checkbox cron-checkbox-inline">
                <input
                  type="checkbox"
                  .checked=${props.form.enabled}
                  @change=${(e: Event) =>
                    props.onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
                />
                <span class="field-checkbox__label">${t("cron.summary.enabled")}</span>
              </label>
            </div>
          </section>

          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cron.form.schedule")}</div>
            <div class="cron-form-section__sub">${t("cron.form.scheduleSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field cron-span-2">
                ${renderFieldLabel(t("cron.form.schedule"))}
                <select
                  id="cron-schedule-kind"
                  .value=${props.form.scheduleKind}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      scheduleKind: (e.target as HTMLSelectElement)
                        .value as CronFormState["scheduleKind"],
                    })}
                >
                  <option value="every">${t("cron.form.every")}</option>
                  <option value="at">${t("cron.form.at")}</option>
                  <option value="cron">${t("cron.form.cronOption")}</option>
                </select>
              </label>
            </div>
            ${renderScheduleFields(props)} ${renderSchedulePreview(props.form)}
          </section>

          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cron.form.execution")}</div>
            <div class="cron-form-section__sub">${t("cron.form.executionSub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field">
                ${renderFieldLabel(t("cron.form.session"))}
                <select
                  id="cron-session-target"
                  .value=${props.form.sessionTarget}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      sessionTarget: (e.target as HTMLSelectElement)
                        .value as CronFormState["sessionTarget"],
                    })}
                >
                  <option value="main">${t("cron.form.main")}</option>
                  <option value="isolated">${t("cron.form.isolated")}</option>
                </select>
                <div class="cron-help">${t("cron.form.sessionHelp")}</div>
              </label>
              <label class="field">
                ${renderFieldLabel(t("cron.form.wakeMode"))}
                <select
                  id="cron-wake-mode"
                  .value=${props.form.wakeMode}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      wakeMode: (e.target as HTMLSelectElement).value as CronFormState["wakeMode"],
                    })}
                >
                  <option value="now">${t("cron.form.now")}</option>
                  <option value="next-heartbeat">${t("cron.form.nextHeartbeat")}</option>
                </select>
                <div class="cron-help">${t("cron.form.wakeModeHelp")}</div>
              </label>
              <label class="field ${isAgentTurn ? "" : "cron-span-2"}">
                ${renderFieldLabel(t("cron.form.payloadKind"))}
                <select
                  id="cron-payload-kind"
                  .value=${props.form.payloadKind}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      payloadKind: (e.target as HTMLSelectElement)
                        .value as CronFormState["payloadKind"],
                    })}
                >
                  <option value="systemEvent">${t("cron.form.systemEvent")}</option>
                  <option value="agentTurn">${t("cron.form.agentTurn")}</option>
                </select>
                <div class="cron-help">
                  ${props.form.payloadKind === "systemEvent"
                    ? t("cron.form.systemEventHelp")
                    : t("cron.form.agentTurnHelp")}
                </div>
              </label>
              ${isAgentTurn
                ? html`
                    <label class="field">
                      ${renderFieldLabel(t("cron.form.timeoutSeconds"))}
                      <input
                        id="cron-timeout-seconds"
                        .value=${props.form.timeoutSeconds}
                        placeholder=${t("cron.form.timeoutPlaceholder")}
                        aria-invalid=${props.fieldErrors.timeoutSeconds ? "true" : "false"}
                        aria-describedby=${ifDefined(
                          props.fieldErrors.timeoutSeconds
                            ? errorIdForField("timeoutSeconds")
                            : undefined,
                        )}
                        @input=${(e: Event) =>
                          props.onFormChange({
                            timeoutSeconds: (e.target as HTMLInputElement).value,
                          })}
                      />
                      <div class="cron-help">${t("cron.form.timeoutHelp")}</div>
                      ${renderFieldError(
                        props.fieldErrors.timeoutSeconds,
                        errorIdForField("timeoutSeconds"),
                      )}
                    </label>
                  `
                : nothing}
            </div>
            <label class="field cron-span-2">
              ${renderFieldLabel(
                props.form.payloadKind === "systemEvent"
                  ? t("cron.form.mainTimelineMessage")
                  : t("cron.form.assistantTaskPrompt"),
                true,
              )}
              <textarea
                id="cron-payload-text"
                .value=${props.form.payloadText}
                aria-invalid=${props.fieldErrors.payloadText ? "true" : "false"}
                aria-describedby=${ifDefined(
                  props.fieldErrors.payloadText ? errorIdForField("payloadText") : undefined,
                )}
                @input=${(e: Event) =>
                  props.onFormChange({
                    payloadText: (e.target as HTMLTextAreaElement).value,
                  })}
                rows="4"
              ></textarea>
              ${renderFieldError(props.fieldErrors.payloadText, errorIdForField("payloadText"))}
            </label>
          </section>

          <section class="cron-form-section">
            <div class="cron-form-section__title">${t("cron.form.deliverySection")}</div>
            <div class="cron-form-section__sub">${t("cron.form.deliverySub")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field ${selectedDeliveryMode === "none" ? "cron-span-2" : ""}">
                ${renderFieldLabel(t("cron.form.resultDelivery"))}
                <select
                  id="cron-delivery-mode"
                  .value=${selectedDeliveryMode}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      deliveryMode: (e.target as HTMLSelectElement)
                        .value as CronFormState["deliveryMode"],
                    })}
                >
                  ${supportsAnnounce
                    ? html` <option value="announce">${t("cron.form.announceDefault")}</option> `
                    : nothing}
                  <option value="webhook">${t("cron.form.webhookPost")}</option>
                  <option value="none">${t("cron.form.noneInternal")}</option>
                </select>
                <div class="cron-help">${t("cron.form.deliveryHelp")}</div>
              </label>
              ${selectedDeliveryMode !== "none"
                ? html`
                    <label class="field ${selectedDeliveryMode === "webhook" ? "cron-span-2" : ""}">
                      ${renderFieldLabel(
                        selectedDeliveryMode === "webhook"
                          ? t("cron.form.webhookUrl")
                          : t("cron.form.channel"),
                        selectedDeliveryMode === "webhook",
                      )}
                      ${selectedDeliveryMode === "webhook"
                        ? html`
                            <input
                              id="cron-delivery-to"
                              .value=${props.form.deliveryTo}
                              list="cron-delivery-to-suggestions"
                              aria-invalid=${props.fieldErrors.deliveryTo ? "true" : "false"}
                              aria-describedby=${ifDefined(
                                props.fieldErrors.deliveryTo
                                  ? errorIdForField("deliveryTo")
                                  : undefined,
                              )}
                              @input=${(e: Event) =>
                                props.onFormChange({
                                  deliveryTo: (e.target as HTMLInputElement).value,
                                })}
                              placeholder=${t("cron.form.webhookPlaceholder")}
                            />
                          `
                        : html`
                            <select
                              id="cron-delivery-channel"
                              .value=${props.form.deliveryChannel || "last"}
                              @change=${(e: Event) =>
                                props.onFormChange({
                                  deliveryChannel: (e.target as HTMLSelectElement).value,
                                })}
                            >
                              ${channelOptions.map(
                                (channel) =>
                                  html`<option value=${channel}>
                                    ${resolveChannelLabel(props, channel)}
                                  </option>`,
                              )}
                            </select>
                          `}
                      ${selectedDeliveryMode === "announce"
                        ? html` <div class="cron-help">${t("cron.form.channelHelp")}</div> `
                        : html` <div class="cron-help">${t("cron.form.webhookHelp")}</div> `}
                    </label>
                    ${selectedDeliveryMode === "announce"
                      ? html`
                          <label class="field cron-span-2">
                            ${renderFieldLabel(t("cron.form.to"))}
                            <input
                              id="cron-delivery-to"
                              .value=${props.form.deliveryTo}
                              list="cron-delivery-to-suggestions"
                              @input=${(e: Event) =>
                                props.onFormChange({
                                  deliveryTo: (e.target as HTMLInputElement).value,
                                })}
                              placeholder=${t("cron.form.toPlaceholder")}
                            />
                            <div class="cron-help">${t("cron.form.toHelp")}</div>
                          </label>
                        `
                      : nothing}
                    ${selectedDeliveryMode === "webhook"
                      ? renderFieldError(
                          props.fieldErrors.deliveryTo,
                          errorIdForField("deliveryTo"),
                        )
                      : nothing}
                  `
                : nothing}
            </div>
          </section>

          <details class="cron-advanced">
            <summary class="cron-advanced__summary">${t("cron.form.advanced")}</summary>
            <div class="cron-help">${t("cron.form.advancedHelp")}</div>
            <div class="form-grid cron-form-grid">
              <label class="field checkbox cron-checkbox">
                <input
                  type="checkbox"
                  .checked=${props.form.deleteAfterRun}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      deleteAfterRun: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="field-checkbox__label">${t("cron.form.deleteAfterRun")}</span>
                <div class="cron-help">${t("cron.form.deleteAfterRunHelp")}</div>
              </label>
              <label class="field checkbox cron-checkbox">
                <input
                  type="checkbox"
                  .checked=${props.form.clearAgent}
                  @change=${(e: Event) =>
                    props.onFormChange({
                      clearAgent: (e.target as HTMLInputElement).checked,
                    })}
                />
                <span class="field-checkbox__label">${t("cron.form.clearAgentOverride")}</span>
                <div class="cron-help">${t("cron.form.clearAgentHelp")}</div>
              </label>
              <label class="field cron-span-2">
                ${renderFieldLabel("Session key")}
                <input
                  id="cron-session-key"
                  .value=${props.form.sessionKey}
                  @input=${(e: Event) =>
                    props.onFormChange({
                      sessionKey: (e.target as HTMLInputElement).value,
                    })}
                  placeholder="agent:main:main"
                />
                <div class="cron-help">Optional routing key for job delivery and wake routing.</div>
              </label>
              ${isCronSchedule
                ? html`
                    <label class="field checkbox cron-checkbox cron-span-2">
                      <input
                        type="checkbox"
                        .checked=${props.form.scheduleExact}
                        @change=${(e: Event) =>
                          props.onFormChange({
                            scheduleExact: (e.target as HTMLInputElement).checked,
                          })}
                      />
                      <span class="field-checkbox__label">${t("cron.form.exactTiming")}</span>
                      <div class="cron-help">${t("cron.form.exactTimingHelp")}</div>
                    </label>
                    <div class="cron-stagger-group cron-span-2">
                      <label class="field">
                        ${renderFieldLabel(t("cron.form.staggerWindow"))}
                        <input
                          id="cron-stagger-amount"
                          .value=${props.form.staggerAmount}
                          ?disabled=${props.form.scheduleExact}
                          aria-invalid=${props.fieldErrors.staggerAmount ? "true" : "false"}
                          aria-describedby=${ifDefined(
                            props.fieldErrors.staggerAmount
                              ? errorIdForField("staggerAmount")
                              : undefined,
                          )}
                          @input=${(e: Event) =>
                            props.onFormChange({
                              staggerAmount: (e.target as HTMLInputElement).value,
                            })}
                          placeholder=${t("cron.form.staggerPlaceholder")}
                        />
                        ${renderFieldError(
                          props.fieldErrors.staggerAmount,
                          errorIdForField("staggerAmount"),
                        )}
                      </label>
                      <label class="field">
                        <span>${t("cron.form.staggerUnit")}</span>
                        <select
                          .value=${props.form.staggerUnit}
                          ?disabled=${props.form.scheduleExact}
                          @change=${(e: Event) =>
                            props.onFormChange({
                              staggerUnit: (e.target as HTMLSelectElement)
                                .value as CronFormState["staggerUnit"],
                            })}
                        >
                          <option value="seconds">${t("cron.form.seconds")}</option>
                          <option value="minutes">${t("cron.form.minutes")}</option>
                        </select>
                      </label>
                    </div>
                  `
                : nothing}
              ${isAgentTurn
                ? html`
                    <label class="field cron-span-2">
                      ${renderFieldLabel("Account ID")}
                      <input
                        id="cron-delivery-account-id"
                        .value=${props.form.deliveryAccountId}
                        list="cron-delivery-account-suggestions"
                        ?disabled=${selectedDeliveryMode !== "announce"}
                        @input=${(e: Event) =>
                          props.onFormChange({
                            deliveryAccountId: (e.target as HTMLInputElement).value,
                          })}
                        placeholder="default"
                      />
                      <div class="cron-help">
                        Optional channel account ID for multi-account setups.
                      </div>
                    </label>
                    <label class="field checkbox cron-checkbox cron-span-2">
                      <input
                        type="checkbox"
                        .checked=${props.form.payloadLightContext}
                        @change=${(e: Event) =>
                          props.onFormChange({
                            payloadLightContext: (e.target as HTMLInputElement).checked,
                          })}
                      />
                      <span class="field-checkbox__label">Light context</span>
                      <div class="cron-help">
                        Use lightweight bootstrap context for this agent job.
                      </div>
                    </label>
                    <label class="field">
                      ${renderFieldLabel(t("cron.form.model"))}
                      <input
                        id="cron-payload-model"
                        .value=${props.form.payloadModel}
                        list="cron-model-suggestions"
                        @input=${(e: Event) =>
                          props.onFormChange({
                            payloadModel: (e.target as HTMLInputElement).value,
                          })}
                        placeholder=${t("cron.form.modelPlaceholder")}
                      />
                      <div class="cron-help">${t("cron.form.modelHelp")}</div>
                    </label>
                    <label class="field">
                      ${renderFieldLabel(t("cron.form.thinking"))}
                      <input
                        id="cron-payload-thinking"
                        .value=${props.form.payloadThinking}
                        list="cron-thinking-suggestions"
                        @input=${(e: Event) =>
                          props.onFormChange({
                            payloadThinking: (e.target as HTMLInputElement).value,
                          })}
                        placeholder=${t("cron.form.thinkingPlaceholder")}
                      />
                      <div class="cron-help">${t("cron.form.thinkingHelp")}</div>
                    </label>
                  `
                : nothing}
              ${isAgentTurn
                ? html`
                    <label class="field cron-span-2">
                      ${renderFieldLabel("Failure alerts")}
                      <select
                        .value=${props.form.failureAlertMode}
                        @change=${(e: Event) =>
                          props.onFormChange({
                            failureAlertMode: (e.target as HTMLSelectElement)
                              .value as CronFormState["failureAlertMode"],
                          })}
                      >
                        <option value="inherit">Inherit global setting</option>
                        <option value="disabled">Disable for this job</option>
                        <option value="custom">Custom per-job settings</option>
                      </select>
                      <div class="cron-help">
                        Control when this job sends repeated-failure alerts.
                      </div>
                    </label>
                    ${props.form.failureAlertMode === "custom"
                      ? html`
                          <label class="field">
                            ${renderFieldLabel("Alert after")}
                            <input
                              id="cron-failure-alert-after"
                              .value=${props.form.failureAlertAfter}
                              aria-invalid=${props.fieldErrors.failureAlertAfter ? "true" : "false"}
                              aria-describedby=${ifDefined(
                                props.fieldErrors.failureAlertAfter
                                  ? errorIdForField("failureAlertAfter")
                                  : undefined,
                              )}
                              @input=${(e: Event) =>
                                props.onFormChange({
                                  failureAlertAfter: (e.target as HTMLInputElement).value,
                                })}
                              placeholder="2"
                            />
                            <div class="cron-help">Consecutive errors before alerting.</div>
                            ${renderFieldError(
                              props.fieldErrors.failureAlertAfter,
                              errorIdForField("failureAlertAfter"),
                            )}
                          </label>
                          <label class="field">
                            ${renderFieldLabel("Cooldown (seconds)")}
                            <input
                              id="cron-failure-alert-cooldown-seconds"
                              .value=${props.form.failureAlertCooldownSeconds}
                              aria-invalid=${props.fieldErrors.failureAlertCooldownSeconds
                                ? "true"
                                : "false"}
                              aria-describedby=${ifDefined(
                                props.fieldErrors.failureAlertCooldownSeconds
                                  ? errorIdForField("failureAlertCooldownSeconds")
                                  : undefined,
                              )}
                              @input=${(e: Event) =>
                                props.onFormChange({
                                  failureAlertCooldownSeconds: (e.target as HTMLInputElement).value,
                                })}
                              placeholder="3600"
                            />
                            <div class="cron-help">Minimum seconds between alerts.</div>
                            ${renderFieldError(
                              props.fieldErrors.failureAlertCooldownSeconds,
                              errorIdForField("failureAlertCooldownSeconds"),
                            )}
                          </label>
                          <label class="field">
                            ${renderFieldLabel("Alert channel")}
                            <select
                              .value=${props.form.failureAlertChannel || "last"}
                              @change=${(e: Event) =>
                                props.onFormChange({
                                  failureAlertChannel: (e.target as HTMLSelectElement).value,
                                })}
                            >
                              ${channelOptions.map(
                                (channel) =>
                                  html`<option value=${channel}>
                                    ${resolveChannelLabel(props, channel)}
                                  </option>`,
                              )}
                            </select>
                          </label>
                          <label class="field">
                            ${renderFieldLabel("Alert to")}
                            <input
                              .value=${props.form.failureAlertTo}
                              list="cron-delivery-to-suggestions"
                              @input=${(e: Event) =>
                                props.onFormChange({
                                  failureAlertTo: (e.target as HTMLInputElement).value,
                                })}
                              placeholder="+1555... or chat id"
                            />
                            <div class="cron-help">
                              Optional recipient override for failure alerts.
                            </div>
                          </label>
                          <label class="field">
                            ${renderFieldLabel("Alert mode")}
                            <select
                              .value=${props.form.failureAlertDeliveryMode || "announce"}
                              @change=${(e: Event) =>
                                props.onFormChange({
                                  failureAlertDeliveryMode: (e.target as HTMLSelectElement)
                                    .value as CronFormState["failureAlertDeliveryMode"],
                                })}
                            >
                              <option value="announce">Announce (via channel)</option>
                              <option value="webhook">Webhook (HTTP POST)</option>
                            </select>
                          </label>
                          <label class="field">
                            ${renderFieldLabel("Alert account ID")}
                            <input
                              .value=${props.form.failureAlertAccountId}
                              @input=${(e: Event) =>
                                props.onFormChange({
                                  failureAlertAccountId: (e.target as HTMLInputElement).value,
                                })}
                              placeholder="Account ID for multi-account setups"
                            />
                          </label>
                        `
                      : nothing}
                  `
                : nothing}
              ${selectedDeliveryMode !== "none"
                ? html`
                    <label class="field checkbox cron-checkbox cron-span-2">
                      <input
                        type="checkbox"
                        .checked=${props.form.deliveryBestEffort}
                        @change=${(e: Event) =>
                          props.onFormChange({
                            deliveryBestEffort: (e.target as HTMLInputElement).checked,
                          })}
                      />
                      <span class="field-checkbox__label"
                        >${t("cron.form.bestEffortDelivery")}</span
                      >
                      <div class="cron-help">${t("cron.form.bestEffortHelp")}</div>
                    </label>
                  `
                : nothing}
            </div>
          </details>
        </div>
        ${blockedByValidation
          ? html`
              <div class="cron-form-status" role="status" aria-live="polite">
                <div class="cron-form-status__title">${t("cron.form.cantAddYet")}</div>
                <div class="cron-help">${t("cron.form.fillRequired")}</div>
                <ul class="cron-form-status__list">
                  ${blockingFields.map(
                    (field) => html`
                      <li>
                        <button
                          type="button"
                          class="cron-form-status__link"
                          @click=${() => focusFormField(field.inputId)}
                        >
                          ${field.label}: ${t(field.message)}
                        </button>
                      </li>
                    `,
                  )}
                </ul>
              </div>
            `
          : nothing}
        <div class="row cron-form-actions">
          <button
            class="btn primary"
            ?disabled=${props.busy || !props.canSubmit}
            @click=${props.onAdd}
          >
            ${props.busy
              ? t("cron.form.saving")
              : isEditing
                ? t("cron.form.saveChanges")
                : t("cron.form.addJob")}
          </button>
          ${submitDisabledReason
            ? html`<div class="cron-submit-reason" aria-live="polite">${submitDisabledReason}</div>`
            : nothing}
          ${isEditing
            ? html`
                <button class="btn" ?disabled=${props.busy} @click=${props.onCancelEdit}>
                  ${t("cron.form.cancel")}
                </button>
              `
            : nothing}
        </div>
      </section>
    </section>

    ${renderSuggestionList("cron-agent-suggestions", props.agentSuggestions)}
    ${renderSuggestionList("cron-model-suggestions", props.modelSuggestions)}
    ${renderSuggestionList("cron-thinking-suggestions", props.thinkingSuggestions)}
    ${renderSuggestionList("cron-tz-suggestions", props.timezoneSuggestions)}
    ${renderSuggestionList("cron-delivery-to-suggestions", props.deliveryToSuggestions)}
    ${renderSuggestionList("cron-delivery-account-suggestions", props.accountSuggestions)}
  `;
}

function renderScheduleFields(props: CronProps) {
  const form = props.form;
  if (form.scheduleKind === "at") {
    return html`
      <label class="field cron-span-2" style="margin-top: 12px;">
        ${renderFieldLabel(t("cron.form.runAt"), true)}
        <input
          id="cron-schedule-at"
          type="datetime-local"
          .value=${form.scheduleAt}
          aria-invalid=${props.fieldErrors.scheduleAt ? "true" : "false"}
          aria-describedby=${ifDefined(
            props.fieldErrors.scheduleAt ? errorIdForField("scheduleAt") : undefined,
          )}
          @input=${(e: Event) =>
            props.onFormChange({
              scheduleAt: (e.target as HTMLInputElement).value,
            })}
        />
        ${renderFieldError(props.fieldErrors.scheduleAt, errorIdForField("scheduleAt"))}
      </label>
    `;
  }
  if (form.scheduleKind === "every") {
    return html`
      <div class="form-grid cron-form-grid" style="margin-top: 12px;">
        <label class="field">
          ${renderFieldLabel(t("cron.form.every"), true)}
          <input
            id="cron-every-amount"
            .value=${form.everyAmount}
            aria-invalid=${props.fieldErrors.everyAmount ? "true" : "false"}
            aria-describedby=${ifDefined(
              props.fieldErrors.everyAmount ? errorIdForField("everyAmount") : undefined,
            )}
            @input=${(e: Event) =>
              props.onFormChange({
                everyAmount: (e.target as HTMLInputElement).value,
              })}
            placeholder=${t("cron.form.everyAmountPlaceholder")}
          />
          ${renderFieldError(props.fieldErrors.everyAmount, errorIdForField("everyAmount"))}
        </label>
        <label class="field">
          <span>${t("cron.form.unit")}</span>
          <select
            .value=${form.everyUnit}
            @change=${(e: Event) =>
              props.onFormChange({
                everyUnit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
              })}
          >
            <option value="minutes">${t("cron.form.minutes")}</option>
            <option value="hours">${t("cron.form.hours")}</option>
            <option value="days">${t("cron.form.days")}</option>
          </select>
        </label>
      </div>
    `;
  }
  return html`
    <div class="form-grid cron-form-grid" style="margin-top: 12px;">
      <label class="field">
        ${renderFieldLabel(t("cron.form.expression"), true)}
        <input
          id="cron-cron-expr"
          .value=${form.cronExpr}
          aria-invalid=${props.fieldErrors.cronExpr ? "true" : "false"}
          aria-describedby=${ifDefined(
            props.fieldErrors.cronExpr ? errorIdForField("cronExpr") : undefined,
          )}
          @input=${(e: Event) =>
            props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
          placeholder=${t("cron.form.expressionPlaceholder")}
        />
        ${renderFieldError(props.fieldErrors.cronExpr, errorIdForField("cronExpr"))}
      </label>
      <label class="field">
        <span>${t("cron.form.timezoneOptional")}</span>
        <input
          .value=${form.cronTz}
          list="cron-tz-suggestions"
          @input=${(e: Event) =>
            props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
          placeholder=${t("cron.form.timezonePlaceholder")}
        />
        <div class="cron-help">${t("cron.form.timezoneHelp")}</div>
      </label>
      <div class="cron-help cron-span-2">${t("cron.form.jitterHelp")}</div>
    </div>
  `;
}

function renderFieldError(message?: string, id?: string) {
  if (!message) {
    return nothing;
  }
  return html`<div id=${ifDefined(id)} class="cron-help cron-error">${t(message)}</div>`;
}

function renderRemoveConfirmation(
  job: CronJob,
  props: CronProps,
  selectAnd: (action: () => void) => void,
) {
  return html`
    <details class="cron-danger-confirm" @click=${(event: Event) => event.stopPropagation()}>
      <summary class="btn danger">${t("cron.jobList.remove")}</summary>
      <div class="cron-danger-confirm__panel">
        <span>Delete this cron job? This cannot be undone.</span>
        <button
          class="btn danger"
          ?disabled=${props.busy}
          @click=${(event: Event) => {
            event.stopPropagation();
            selectAnd(() => props.onRemove(job));
          }}
        >
          Confirm delete
        </button>
      </div>
    </details>
  `;
}

function renderJob(job: CronJob, props: CronProps) {
  const isSelected = props.runsJobId === job.id;
  const itemClass = `list-item list-item-clickable cron-job${isSelected ? " list-item-selected" : ""}`;
  const tone = statusToneForJob(job);
  const selectAnd = (action: () => void) => {
    props.onLoadRuns(job.id);
    action();
  };
  return html`
    <div class=${itemClass} @click=${() => props.onLoadRuns(job.id)}>
      <div class="cron-job-header">
        <div class="list-main">
          <div class="list-title cron-job-title">
            <span class=${`cron-status-dot is-${tone}`}></span>
            <span>${job.name}</span>
          </div>
          <div class="list-sub cron-job-schedule-line">
            <span>${labelForScheduleKind(job)}</span>
            <span>${formatCronSchedule(job)}</span>
          </div>
          ${job.agentId
            ? html`<div class="muted cron-job-agent">
                ${t("cron.jobDetail.agent")}: ${job.agentId}
              </div>`
            : nothing}
        </div>
        <div class="list-meta">${renderJobState(job)}</div>
      </div>
      ${renderJobPayload(job)}
      <div class="cron-job-footer">
        <div class="chip-row cron-job-chips">
          <span class=${`chip ${job.enabled ? "chip-ok" : "chip-danger"}`}>
            ${job.enabled ? t("cron.jobList.enabled") : t("cron.jobList.disabled")}
          </span>
          <span class="chip">${job.sessionTarget}</span>
          <span class="chip">${job.wakeMode}</span>
        </div>
        <div class="row cron-job-actions">
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onEdit(job));
            }}
          >
            ${t("cron.jobList.edit")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onClone(job));
            }}
          >
            ${t("cron.jobList.clone")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onToggle(job, !job.enabled));
            }}
          >
            ${job.enabled ? t("cron.jobList.disable") : t("cron.jobList.enable")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onRun(job, "force"));
            }}
          >
            ${t("cron.jobList.run")}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              selectAnd(() => props.onRun(job, "due"));
            }}
          >
            Run if due
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onLoadRuns(job.id);
            }}
          >
            ${t("cron.jobList.history")}
          </button>
          ${renderRemoveConfirmation(job, props, selectAnd)}
        </div>
      </div>
    </div>
  `;
}

function renderJobPayload(job: CronJob) {
  if (job.payload.kind === "systemEvent") {
    return html`<div class="cron-job-detail">
      <span class="cron-job-detail-label">${t("cron.jobDetail.system")}</span>
      <span class="muted cron-job-detail-value">${job.payload.text}</span>
    </div>`;
  }

  const delivery = job.delivery;
  const deliveryTarget =
    delivery?.mode === "webhook"
      ? delivery.to
        ? ` (${delivery.to})`
        : ""
      : delivery?.channel || delivery?.to
        ? ` (${delivery.channel ?? "last"}${delivery.to ? ` -> ${delivery.to}` : ""})`
        : "";

  return html`
    <div class="cron-job-detail">
      <div class="cron-job-detail-section">
        <span class="cron-job-detail-label">${t("cron.jobDetail.prompt")}</span>
        <div class="muted cron-job-detail-value chat-text" @click=${stopPropagationForInteractive}>
          ${unsafeHTML(toSanitizedMarkdownHtml(job.payload.message))}
        </div>
      </div>
      ${delivery
        ? html`<div class="cron-job-detail-section">
            <span class="cron-job-detail-label">${t("cron.jobDetail.delivery")}</span>
            <span class="muted cron-job-detail-value">${delivery.mode}${deliveryTarget}</span>
          </div>`
        : nothing}
    </div>
  `;
}

function stopPropagationForInteractive(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest("a,button,input,textarea,select,summary,[role='button'],[role='link']")) {
    event.stopPropagation();
  }
}

function formatStateRelative(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return t("common.na");
  }
  return formatRelativeTimestamp(ms);
}

function formatRunNextLabel(nextRunAtMs: number, nowMs = Date.now()) {
  const rel = formatRelativeTimestamp(nextRunAtMs);
  return nextRunAtMs > nowMs ? t("cron.runEntry.next", { rel }) : t("cron.runEntry.due", { rel });
}

function renderJobState(job: CronJob) {
  const rawStatus = job.state?.lastStatus;
  const statusClass =
    rawStatus === "ok"
      ? "cron-job-status-ok"
      : rawStatus === "error"
        ? "cron-job-status-error"
        : rawStatus === "skipped"
          ? "cron-job-status-skipped"
          : "cron-job-status-na";
  const statusLabel =
    rawStatus === "ok"
      ? t("cron.runs.runStatusOk")
      : rawStatus === "error"
        ? t("cron.runs.runStatusError")
        : rawStatus === "skipped"
          ? t("cron.runs.runStatusSkipped")
          : t("common.na");
  const nextRunAtMs = job.state?.nextRunAtMs;
  const lastRunAtMs = job.state?.lastRunAtMs;

  return html`
    <div class="cron-job-state">
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">${t("cron.jobState.status")}</span>
        <span class=${`cron-job-status-pill ${statusClass}`}>${statusLabel}</span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">${t("cron.jobState.next")}</span>
        <span class="cron-job-state-value" title=${formatMs(nextRunAtMs)}>
          ${formatStateRelative(nextRunAtMs)}
        </span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">${t("cron.jobState.last")}</span>
        <span class="cron-job-state-value" title=${formatMs(lastRunAtMs)}>
          ${formatStateRelative(lastRunAtMs)}
        </span>
      </div>
    </div>
  `;
}

function runStatusLabel(value: string): string {
  switch (value) {
    case "ok":
      return t("cron.runs.runStatusOk");
    case "error":
      return t("cron.runs.runStatusError");
    case "skipped":
      return t("cron.runs.runStatusSkipped");
    default:
      return t("cron.runs.runStatusUnknown");
  }
}

function runDeliveryLabel(value: string): string {
  switch (value) {
    case "delivered":
      return t("cron.runs.deliveryDelivered");
    case "not-delivered":
      return t("cron.runs.deliveryNotDelivered");
    case "not-requested":
      return t("cron.runs.deliveryNotRequested");
    case "unknown":
      return t("cron.runs.deliveryUnknown");
    default:
      return t("cron.runs.deliveryUnknown");
  }
}

function buildRunDetailPayload(entry: CronRunLogEntry): Record<string, unknown> {
  const details: Record<string, unknown> = {
    jobId: entry.jobId,
    jobName: entry.jobName ?? null,
    action: entry.action ?? null,
    status: entry.status ?? null,
    timestamp: formatMs(entry.ts),
    runAt: typeof entry.runAtMs === "number" ? formatMs(entry.runAtMs) : null,
    nextRunAt: typeof entry.nextRunAtMs === "number" ? formatMs(entry.nextRunAtMs) : null,
    durationMs: entry.durationMs ?? null,
    delivered: entry.delivered ?? null,
    deliveryStatus: entry.deliveryStatus ?? null,
    deliveryError: entry.deliveryError ?? null,
    sessionId: entry.sessionId ?? null,
    sessionKey: entry.sessionKey ?? null,
    model: entry.model ?? null,
    provider: entry.provider ?? null,
    usage: entry.usage ?? null,
    error: entry.error ?? null,
  };
  return details;
}

function renderRun(
  entry: CronRunLogEntry,
  basePath: string,
  onNavigateToChat?: (sessionKey: string) => void,
) {
  const chatUrl =
    typeof entry.sessionKey === "string" && entry.sessionKey.trim().length > 0
      ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(entry.sessionKey)}`
      : null;
  const status = runStatusLabel(entry.status ?? "unknown");
  const delivery = runDeliveryLabel(entry.deliveryStatus ?? "not-requested");
  const usage = entry.usage;
  const usageSummary =
    usage && typeof usage.total_tokens === "number"
      ? `${usage.total_tokens} tokens`
      : usage && typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number"
        ? `${usage.input_tokens} in / ${usage.output_tokens} out`
        : null;
  const bodySource = entry.summary || entry.error || t("cron.runEntry.noSummary");
  const showErrorInMeta = !!entry.error && !!entry.summary;
  return html`
    <div class="list-item cron-run-entry">
      <div class="cron-run-entry__header">
        <div class="list-main cron-run-entry__main">
          <div class="list-title cron-run-entry__title">
            ${entry.jobName ?? entry.jobId}
            <span class="muted"> · ${status}</span>
          </div>
          <div class="chip-row" style="margin-top: 4px;">
            <span class="chip">${delivery}</span>
            ${entry.model ? html`<span class="chip">${entry.model}</span>` : nothing}
            ${entry.provider ? html`<span class="chip">${entry.provider}</span>` : nothing}
            ${usageSummary ? html`<span class="chip">${usageSummary}</span>` : nothing}
          </div>
        </div>
        <div class="list-meta cron-run-entry__meta">
          <div>${formatMs(entry.ts)}</div>
          ${typeof entry.runAtMs === "number"
            ? html`<div class="muted">${t("cron.runEntry.runAt")} ${formatMs(entry.runAtMs)}</div>`
            : nothing}
          <div class="muted">${entry.durationMs ?? 0}ms</div>
          ${typeof entry.nextRunAtMs === "number"
            ? html`<div class="muted">${formatRunNextLabel(entry.nextRunAtMs)}</div>`
            : nothing}
          ${chatUrl
            ? html`<div>
                <a
                  class="session-link"
                  href=${chatUrl}
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
                    if (onNavigateToChat && entry.sessionKey) {
                      e.preventDefault();
                      onNavigateToChat(entry.sessionKey);
                    }
                  }}
                  >${t("cron.runEntry.openRunChat")}</a
                >
              </div>`
            : nothing}
          ${showErrorInMeta ? html`<div class="muted">${entry.error}</div>` : nothing}
          ${entry.deliveryError ? html`<div class="muted">${entry.deliveryError}</div>` : nothing}
        </div>
      </div>
      <div class="cron-run-entry__body chat-text">
        ${unsafeHTML(toSanitizedMarkdownHtml(bodySource))}
      </div>
      <details class="cron-run-details">
        <summary>Run details</summary>
        <pre>${JSON.stringify(buildRunDetailPayload(entry), null, 2)}</pre>
      </details>
    </div>
  `;
}
