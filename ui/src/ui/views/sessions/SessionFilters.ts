import { html } from "lit";
import type { SessionFilterSource, SessionFilterTime, SessionSource } from "./types.ts";

const SOURCE_FILTERS: Array<{ value: SessionFilterSource; label: string }> = [
  { value: "all", label: "All" },
  { value: "direct", label: "Direct" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
  { value: "cron", label: "Cron" },
  { value: "other", label: "Other" },
];

const TIME_FILTERS: Array<{ value: SessionFilterTime; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];

export function renderSessionFilters(params: {
  source: SessionFilterSource;
  time: SessionFilterTime;
  activeOnly: boolean;
  counts: Record<SessionSource, number>;
  onSource: (source: SessionFilterSource) => void;
  onTime: (time: SessionFilterTime) => void;
  onActiveOnly: (activeOnly: boolean) => void;
}) {
  const total = Object.values(params.counts).reduce((sum, count) => sum + count, 0);
  return html`
    <div class="sessions-filter-bar">
      <div class="sessions-filter-group" aria-label="Source filter">
        ${SOURCE_FILTERS.map((filter) => {
          const count = filter.value === "all" ? total : (params.counts[filter.value] ?? 0);
          return html`
            <button
              class=${`sessions-pill ${params.source === filter.value ? "is-active" : ""}`}
              @click=${() => params.onSource(filter.value)}
            >
              ${filter.label} ${count}
            </button>
          `;
        })}
      </div>
      <div class="sessions-filter-group" aria-label="Time filter">
        ${TIME_FILTERS.map(
          (filter) => html`
            <button
              class=${`sessions-pill ${params.time === filter.value ? "is-active" : ""}`}
              @click=${() => params.onTime(filter.value)}
            >
              ${filter.label}
            </button>
          `,
        )}
        <label class="sessions-pill sessions-checkbox-pill">
          <input
            type="checkbox"
            .checked=${params.activeOnly}
            @change=${(event: Event) =>
              params.onActiveOnly((event.target as HTMLInputElement).checked)}
          />
          <span>Active only</span>
        </label>
      </div>
    </div>
  `;
}
