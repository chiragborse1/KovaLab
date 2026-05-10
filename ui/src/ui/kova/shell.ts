import { html, nothing, type TemplateResult } from "lit";
import { TAB_GROUPS, titleForTab, type Tab } from "../navigation.ts";
import { renderKovaStatusDot } from "./primitives.ts";

export type KovaShellOptions = {
  activeTab: Tab;
  connected: boolean;
  gatewayUrl: string;
  version: string;
  sessionsCount: number | null;
  content: TemplateResult;
  topbarActions?: TemplateResult;
  onNavigate: (tab: Tab) => void;
  onSearch: () => void;
};

export function renderKovaShell(options: KovaShellOptions) {
  return html`<div class="kova-app">
    ${renderKovaTopbar(options)} ${renderKovaSidebar(options)}
    <main class="kova-main">
      <section
        class="kova-detail-pane ${options.activeTab === "chat" ? "kova-detail-pane--chat" : ""}"
      >
        <div class="kova-detail-pane__body">${options.content}</div>
      </section>
    </main>
  </div>`;
}

export function renderKovaTopbar(
  options: Pick<KovaShellOptions, "connected" | "gatewayUrl" | "topbarActions" | "onSearch">,
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
    ${options.topbarActions
      ? html`<div class="kova-topbar__actions">${options.topbarActions}</div>`
      : nothing}
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
