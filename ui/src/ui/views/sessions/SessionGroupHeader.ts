import { html } from "lit";
import { icons } from "../../icons.ts";
import type { SessionSource } from "./types.ts";

export function sourceIcon(source: SessionSource) {
  switch (source) {
    case "telegram":
      return icons.send;
    case "discord":
      return icons.hash;
    case "cron":
      return icons.clock;
    case "direct":
      return icons.terminal;
    case "other":
      return icons.helpCircle;
  }
}

export function renderSessionGroupHeader(params: {
  source: SessionSource;
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return html`
    <button class="session-group-header" @click=${params.onToggle}>
      <span class="session-group-header__left">
        <span class=${`session-group-chevron ${params.collapsed ? "is-collapsed" : ""}`}
          >${icons.chevronDown}</span
        >
        <span class=${`session-group-icon source-${params.source}`}
          >${sourceIcon(params.source)}</span
        >
        <span>${params.label}</span>
      </span>
      <span class=${`session-group-count source-${params.source}`}>${params.count}</span>
    </button>
  `;
}
