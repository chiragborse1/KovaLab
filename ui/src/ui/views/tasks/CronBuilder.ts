import { html } from "lit";
import type { CronDraft } from "./types.ts";
import { cronExpression, cronPreview } from "./utils.ts";

export function renderCronBuilder(params: {
  cron: CronDraft;
  onChange: (cron: CronDraft) => void;
}) {
  const set = (patch: Partial<CronDraft>) => params.onChange({ ...params.cron, ...patch });
  const input = (key: keyof CronDraft, label: string, placeholder: string) => html`
    <label class="tasks-field">
      <span>${label}</span>
      <input
        class="tasks-input"
        .value=${String(params.cron[key])}
        placeholder=${placeholder}
        @input=${(event: InputEvent) =>
          set({ [key]: (event.currentTarget as HTMLInputElement).value } as Partial<CronDraft>)}
      />
    </label>
  `;

  return html`
    <div class="cron-builder">
      <div class="cron-builder__presets">
        ${(["hourly", "daily", "weekly", "custom"] as const).map(
          (preset) => html`
            <button
              class=${`tasks-segment ${params.cron.preset === preset ? "is-active" : ""}`}
              @click=${() => set({ preset })}
              type="button"
            >
              ${preset === "hourly"
                ? "Every hour"
                : preset === "daily"
                  ? "Every day"
                  : preset === "weekly"
                    ? "Every week"
                    : "Custom"}
            </button>
          `,
        )}
      </div>
      ${params.cron.preset === "custom"
        ? html`
            <div class="cron-builder__custom">
              ${input("minute", "Minute", "0")} ${input("hour", "Hour", "9")}
              ${input("day", "Day", "*")} ${input("month", "Month", "*")}
              ${input("weekday", "Weekday", "1")}
            </div>
          `
        : ""}
      <div class="cron-builder__preview">
        <strong>${cronPreview(params.cron)}</strong>
        <span>${cronExpression(params.cron)}</span>
      </div>
    </div>
  `;
}
