import { html, nothing } from "lit";
import { icons } from "../../icons.ts";
import { pathForTab } from "../../navigation.ts";
import { sourceIcon } from "./SessionGroupHeader.ts";
import { formatTokenCount, isOverrideNonDefault, truncateMiddle } from "./sessionUtils.ts";
import type { Session, SessionsProps } from "./types.ts";

function tokenFillClass(percent: number | null): string {
  if (percent == null) {
    return "";
  }
  if (percent > 80) {
    return "danger";
  }
  if (percent >= 50) {
    return "warn";
  }
  return "";
}

function statusDotClass(updatedAtMs: number | null): string {
  if (!updatedAtMs) {
    return "stale";
  }
  const age = Date.now() - updatedAtMs;
  if (age < 60 * 60 * 1000) {
    return "active";
  }
  if (age < 24 * 60 * 60 * 1000) {
    return "idle";
  }
  return "stale";
}

function updatedClass(updatedAtMs: number | null): string {
  if (!updatedAtMs) {
    return "";
  }
  const age = Date.now() - updatedAtMs;
  if (age < 60 * 60 * 1000) {
    return "active";
  }
  if (age < 24 * 60 * 60 * 1000) {
    return "recent";
  }
  return "";
}

export function renderSessionTokenBar(session: Session, wide = false) {
  if (session.tokensUsed == null || session.tokenLimit == null || session.tokenPercent == null) {
    return html`<span class="muted">n/a</span>`;
  }
  return html`
    <div class="session-token-bar" style=${wide ? "width: 100%;" : ""}>
      <div class="session-token-track">
        <div
          class=${`session-token-fill ${tokenFillClass(session.tokenPercent)}`}
          style=${`width: ${Math.max(1, Math.min(100, session.tokenPercent))}%`}
        ></div>
      </div>
      <span>${formatTokenCount(session.tokensUsed)} / ${formatTokenCount(session.tokenLimit)}</span>
    </div>
  `;
}

export function renderSessionRowCard(params: {
  session: Session;
  props: SessionsProps;
  selected: boolean;
  editingLabel: boolean;
  labelDraft: string;
  onOpen: () => void;
  onEditLabel: () => void;
  onLabelDraft: (value: string) => void;
  onSaveLabel: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const { session, props } = params;
  const chatUrl = `${pathForTab("chat", props.basePath)}?session=${encodeURIComponent(session.key)}`;
  const labelUsed = Boolean(session.label);
  const overrides = isOverrideNonDefault(session.row);
  return html`
    <article class="session-row" @click=${params.onOpen}>
      <div class="session-row-left">
        <input
          type="checkbox"
          .checked=${params.selected}
          aria-label="Select session"
          @click=${(event: MouseEvent) => event.stopPropagation()}
          @change=${() => props.onToggleSelect(session.key)}
        />
        <div class="session-source-mark">
          <span class=${`session-source-icon source-${session.source}`}
            >${sourceIcon(session.source)}</span
          >
          <span class="session-source-label">${session.source}</span>
        </div>
      </div>
      <div class="session-main">
        <button class="session-title-btn" @click=${params.onOpen}>${session.displayTitle}</button>
        <div class="session-secondary">
          ${params.editingLabel
            ? html`
                <input
                  class="sessions-inline-input"
                  .value=${params.labelDraft}
                  @click=${(event: MouseEvent) => event.stopPropagation()}
                  @input=${(event: Event) =>
                    params.onLabelDraft((event.target as HTMLInputElement).value)}
                  @blur=${params.onSaveLabel}
                  @keydown=${(event: KeyboardEvent) => {
                    if (event.key === "Enter") {
                      params.onSaveLabel();
                    }
                  }}
                />
              `
            : labelUsed
              ? html`<span class="mono" title=${session.key}>${truncateMiddle(session.key)}</span>`
              : html`<span class="mono" title=${session.key}>${truncateMiddle(session.key)}</span>`}
          <button
            class="sessions-icon-btn"
            title="Copy key"
            @click=${(event: MouseEvent) => {
              event.stopPropagation();
              params.onCopy();
            }}
          >
            ${icons.copy}
          </button>
        </div>
        <div class="sessions-chip-row">
          <span class="session-kind-badge">${session.kind}</span>
          ${overrides ? html`<span class="session-override-chip">overrides</span>` : nothing}
        </div>
        <div class="session-row-actions" aria-label="Session actions">
          <a
            class="sessions-icon-btn"
            title="Open in Chat"
            href=${chatUrl}
            @click=${(event: MouseEvent) => {
              event.stopPropagation();
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              if (props.onNavigateToChat) {
                event.preventDefault();
                props.onNavigateToChat(session.key);
              }
            }}
          >
            ${icons.messageSquare}
          </a>
          <button
            class="sessions-icon-btn"
            title="Label"
            @click=${(event: MouseEvent) => {
              event.stopPropagation();
              params.onEditLabel();
            }}
          >
            ${icons.tag}
          </button>
          <button
            class="sessions-icon-btn"
            title="Copy key"
            @click=${(event: MouseEvent) => {
              event.stopPropagation();
              params.onCopy();
            }}
          >
            ${icons.copy}
          </button>
          <button
            class="sessions-icon-btn danger"
            title="Delete"
            @click=${(event: MouseEvent) => {
              event.stopPropagation();
              params.onDelete();
            }}
          >
            ${icons.trash}
          </button>
        </div>
      </div>
      <div class="session-meta">
        ${renderSessionTokenBar(session)}
        <span class="session-updated-wrap">
          <span class=${`session-status-dot ${statusDotClass(session.updatedAtMs)}`}></span>
          <span class=${`session-updated ${updatedClass(session.updatedAtMs)}`}
            >${session.updatedAt}</span
          >
        </span>
      </div>
    </article>
  `;
}
