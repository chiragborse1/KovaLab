import { html } from "lit";
import { icons } from "../../icons.ts";
import type { SessionSource } from "./types.ts";

export function sourceIcon(source: SessionSource) {
  switch (source) {
    case "telegram":
      return icons.send;
    case "discord":
      return icons.radio;
    case "cron":
      return icons.refresh;
    case "direct":
      return icons.terminal;
    case "other":
      return icons.messageSquare;
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
        <span>${params.collapsed ? icons.chevronRight : icons.chevronDown}</span>
        <span>${sourceIcon(params.source)}</span>
        <span>${params.label}</span>
      </span>
      <span class="session-group-count">${params.count}</span>
    </button>
  `;
}
