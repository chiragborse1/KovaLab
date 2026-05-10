import { html, nothing, type TemplateResult } from "lit";

export type KovaBadgeVariant =
  | "neutral"
  | "live"
  | "ok"
  | "connected"
  | "idle"
  | "pending"
  | "queued"
  | "failed"
  | "error"
  | "running"
  | "cron"
  | "scheduled"
  | "telegram";

export type KovaDotVariant = "live" | "idle" | "dead" | "error" | "running";

/** Render a square CLI-style badge with semantic text/border color only. */
export function renderKovaBadge(label: string, variant: KovaBadgeVariant = "neutral") {
  return html`<span class="kova-badge kova-badge--${variant}">${label}</span>`;
}

/** Render a 5px status dot for list rows and connection indicators. */
export function renderKovaStatusDot(variant: KovaDotVariant, label?: string) {
  return html`<span class="kova-dot kova-dot--${variant}" title=${label ?? variant}></span>`;
}

/** Render a ruled metadata row using uppercase mono key text and body value text. */
export function renderKovaMetaRow(key: string, value: unknown) {
  return html`<div class="kova-meta-row">
    <div class="kova-meta-row__key">${key}</div>
    <div class="kova-meta-row__value">${value == null || value === "" ? "n/a" : String(value)}</div>
  </div>`;
}

/** Render a full-width ruled section divider. */
export function renderKovaDivider() {
  return html`<div class="kova-section-title"></div>`;
}

/** Render the minimal Kova empty state: text only, no illustration or card. */
export function renderKovaEmptyState(title: string, body: string, action?: TemplateResult) {
  return html`<div class="kova-empty-state">
    <div>
      <div class="kova-empty-state__title">${title}</div>
      <div class="kova-empty-state__body">${body}</div>
      ${action ? html`<div style="margin-top: 16px">${action}</div>` : nothing}
    </div>
  </div>`;
}

/** Render a flat uppercase action button. Primary is the only filled action style. */
export function renderKovaButton(
  label: string,
  options: {
    variant?: "primary" | "secondary" | "ghost";
    disabled?: boolean;
    title?: string;
    onClick?: () => void;
  } = {},
) {
  const variant = options.variant === "primary" ? " kova-btn--primary" : "";
  return html`<button
    class="kova-btn${variant}"
    type="button"
    ?disabled=${options.disabled}
    title=${options.title ?? label}
    @click=${() => options.onClick?.()}
  >
    ${label}
  </button>`;
}

/** Render a flat full-width-compatible input using Kova rules/type styling. */
export function renderKovaInput(
  value: string,
  options: {
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    onInput?: (value: string) => void;
  } = {},
) {
  return html`<input
    class="kova-input"
    type=${options.type ?? "text"}
    .value=${value}
    placeholder=${options.placeholder ?? ""}
    ?disabled=${options.disabled}
    @input=${(event: Event) => options.onInput?.((event.target as HTMLInputElement).value)}
  />`;
}

/** Render a native select styled as a flat Kova field. */
export function renderKovaSelect(
  value: string,
  entries: Array<{ value: string; label: string }>,
  onChange: (value: string) => void,
) {
  return html`<select
    class="kova-select"
    .value=${value}
    @change=${(event: Event) => onChange((event.target as HTMLSelectElement).value)}
  >
    ${entries.map((entry) => html`<option value=${entry.value}>${entry.label}</option>`)}
  </select>`;
}

/** Render a compact square-edged switch without surface fills. */
export function renderKovaToggle(checked: boolean, onToggle: (checked: boolean) => void) {
  return html`<button
    class="kova-toggle"
    type="button"
    role="switch"
    aria-checked=${checked ? "true" : "false"}
    @click=${() => onToggle(!checked)}
  >
    <span class="kova-toggle__thumb"></span>
  </button>`;
}

/** Render underline-style tabs. Active state is accent text plus a 1px rule. */
export function renderKovaTabs<T extends string>(
  tabs: Array<{ id: T; label: string }>,
  active: T,
  onSelect: (tab: T) => void,
) {
  return html`<div class="kova-tabs">
    ${tabs.map(
      (tab) => html`<button
        class="kova-tab ${tab.id === active ? "kova-tab--active" : ""}"
        type="button"
        @click=${() => onSelect(tab.id)}
      >
        ${tab.label}
      </button>`,
    )}
  </div>`;
}

/** Render a 2px token usage bar with semantic threshold color. */
export function renderKovaTokenBar(used: number | null, limit: number | null) {
  if (!used || !limit || !Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return html`<span class="kova-muted">n/a</span>`;
  }
  const percent = Math.min(100, Math.max(0, (used / limit) * 100));
  const tone = percent > 80 ? "red" : percent >= 50 ? "amber" : "green";
  const toneClass =
    tone === "red"
      ? " kova-token-bar__fill--red"
      : tone === "amber"
        ? " kova-token-bar__fill--amber"
        : "";
  return html`<div class="kova-token-bar">
    <div class="kova-token-bar__track">
      <div class="kova-token-bar__fill${toneClass}" style="width: ${percent}%"></div>
    </div>
    <div class="kova-token-bar__label">
      ${Math.round(percent)}% · ${formatKovaCount(used)} / ${formatKovaCount(limit)} tokens
    </div>
  </div>`;
}

function formatKovaCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
}
