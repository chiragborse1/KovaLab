import { html, nothing, type TemplateResult } from "lit";
import { TAB_GROUPS, titleForTab, type Tab } from "../navigation.ts";
import { renderKovaStatusDot } from "./primitives.ts";

export type KovaShellOptions = {
  activeTab: Tab;
  connected: boolean;
  gatewayUrl: string;
  version: string;
  sessionsCount: number | null;
  listPane: TemplateResult;
  content: TemplateResult;
  onNavigate: (tab: Tab) => void;
  onSearch: () => void;
};

export function renderKovaShell(options: KovaShellOptions) {
  return html`<div class="kova-app">
    ${renderKovaTopbar(options)} ${renderKovaSidebar(options)}
    <main class="kova-main">
      ${options.listPane}
      <section class="kova-detail-pane">
        <div class="kova-detail-pane__body">${options.content}</div>
      </section>
    </main>
  </div>`;
}

export function renderKovaTopbar(
  options: Pick<KovaShellOptions, "connected" | "gatewayUrl" | "onSearch">,
) {
  return html`<header class="kova-topbar">
    <div class="kova-topbar__brand" title="Kova Forge">
      <span class="kova-topbar__brand-main">Kova</span>
      <span class="kova-topbar__brand-sub">Forge</span>
    </div>
    <div class="kova-topbar__spacer"></div>
    <button class="kova-input kova-topbar__search" type="button" @click=${options.onSearch}>
      Search
    </button>
    <div class="kova-topbar__status" title=${options.gatewayUrl || "Gateway"}>
      ${renderKovaStatusDot(options.connected ? "live" : "error")}
      <span>${options.connected ? "Connected" : "Disconnected"}</span>
    </div>
  </header>`;
}

export function renderKovaSidebar(
  options: Pick<
    KovaShellOptions,
    "activeTab" | "version" | "connected" | "sessionsCount" | "onNavigate"
  >,
) {
  return html`<aside class="kova-sidebar">
    <nav class="kova-sidebar__nav">
      <section class="kova-nav-section">
        <div class="kova-nav-section__label">Chat</div>
        ${renderNavItem("chat", options)}
      </section>
      ${TAB_GROUPS.map(
        (group) => html`<section class="kova-nav-section">
          <div class="kova-nav-section__label">${group.label}</div>
          ${group.tabs.map((tab) => renderNavItem(tab, options))}
        </section>`,
      )}
    </nav>
    <div class="kova-sidebar__status">
      <div class="kova-sidebar__status-row">
        <span>Gateway</span><strong>${options.connected ? "Running" : "Down"}</strong>
      </div>
      <div class="kova-sidebar__status-row">
        <span>Version</span><strong>v${options.version || "unknown"}</strong>
      </div>
      <div class="kova-sidebar__status-row">
        <span>Sessions</span><strong>${options.sessionsCount ?? 0} active</strong>
      </div>
    </div>
  </aside>`;
}

export function renderKovaListPane(options: {
  title: string;
  count?: number | null;
  filters?: string[];
  activeFilter?: string;
  body: TemplateResult;
}) {
  return html`<section class="kova-list-pane">
    <div class="kova-list-pane__header">
      <div class="kova-list-pane__title">${options.title}</div>
      ${options.count == null
        ? nothing
        : html`<div class="kova-list-pane__count">${options.count} items</div>`}
    </div>
    ${options.filters?.length
      ? html`<div class="kova-list-pane__filters">
          ${options.filters.map(
            (filter) => html`<button
              class="kova-filter-pill ${filter === options.activeFilter
                ? "kova-filter-pill--active"
                : ""}"
              type="button"
            >
              ${filter}
            </button>`,
          )}
        </div>`
      : nothing}
    <div class="kova-list-pane__body">${options.body}</div>
  </section>`;
}

export function renderKovaListItem(options: {
  title: string;
  secondary?: string;
  meta?: string;
  selected?: boolean;
  dot?: "live" | "idle" | "dead" | "error" | "running";
  badges?: TemplateResult[];
  onClick?: () => void;
}) {
  return html`<button
    class="kova-list-item ${options.selected ? "kova-list-item--selected" : ""}"
    type="button"
    @click=${() => options.onClick?.()}
  >
    <span style="padding-top: 8px">${renderKovaStatusDot(options.dot ?? "dead")}</span>
    <span class="kova-list-item__main">
      <span class="kova-list-item__title">${options.title}</span>
      ${options.secondary
        ? html`<span class="kova-list-item__secondary kova-mono">${options.secondary}</span>`
        : nothing}
      ${options.badges?.length
        ? html`<span class="kova-list-item__badges">${options.badges}</span>`
        : nothing}
    </span>
    ${options.meta ? html`<span class="kova-list-item__meta">${options.meta}</span>` : nothing}
  </button>`;
}

function renderNavItem(tab: Tab, options: Pick<KovaShellOptions, "activeTab" | "onNavigate">) {
  const active = options.activeTab === tab;
  return html`<button
    class="kova-nav-item ${active ? "kova-nav-item--active" : ""}"
    type="button"
    @click=${() => options.onNavigate(tab)}
  >
    ${titleForTab(tab)}
  </button>`;
}
