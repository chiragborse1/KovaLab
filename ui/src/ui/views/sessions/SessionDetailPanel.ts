import { html, nothing } from "lit";
import { icons } from "../../icons.ts";
import { pathForTab } from "../../navigation.ts";
import { renderSessionCheckpoints } from "./SessionCheckpoints.ts";
import { renderSessionConversation } from "./SessionConversation.ts";
import { renderSessionTokenBar } from "./SessionRowCard.ts";
import {
  FAST_LEVELS,
  REASONING_LEVELS,
  resolveThinkLevelOptions,
  resolveThinkLevelPatchValue,
  VERBOSE_LEVELS,
  withCurrentLabeledOption,
  withCurrentOption,
} from "./sessionUtils.ts";
import type {
  Session,
  SessionConversationMessage,
  SessionDetailTab,
  SessionsProps,
} from "./types.ts";

function overrideSelect(params: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[] | readonly string[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return html`
    <div class="sessions-field">
      <label>${params.label}</label>
      <select
        ?disabled=${params.disabled}
        @change=${(event: Event) => params.onChange((event.target as HTMLSelectElement).value)}
      >
        ${params.options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const label = typeof option === "string" ? option || "inherit" : option.label;
          return html`<option value=${value} ?selected=${params.value === value}>${label}</option>`;
        })}
      </select>
    </div>
  `;
}

export function renderSessionDetailPanel(params: {
  session: Session;
  props: SessionsProps;
  tab: SessionDetailTab;
  labelEditing: boolean;
  labelDraft: string;
  conversationLoading: boolean;
  conversationError: string | null;
  conversationMessages: SessionConversationMessage[] | null;
  onClose: () => void;
  onTab: (tab: SessionDetailTab) => void;
  onEditLabel: () => void;
  onLabelDraft: (value: string) => void;
  onSaveLabel: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onRetryConversation: () => void;
}) {
  const { session, props } = params;
  const row = session.row;
  const chatUrl = `${pathForTab("chat", props.basePath)}?session=${encodeURIComponent(session.key)}`;
  const thinking = row.thinkingLevel ?? "";
  const fastMode = row.fastMode === true ? "on" : row.fastMode === false ? "off" : "";
  const verbose = row.verboseLevel ?? "";
  const reasoning = row.reasoningLevel ?? "";
  const checkpointItems = props.checkpointItemsByKey[session.key] ?? [];
  const checkpointError = props.checkpointErrorByKey[session.key] ?? null;

  return html`
    <div class="sessions-drawer-backdrop" @click=${params.onClose}></div>
    <aside class="sessions-drawer" @click=${(event: MouseEvent) => event.stopPropagation()}>
      <header class="sessions-drawer-header">
        <div class="sessions-drawer-title-row">
          <div>
            <h2 class="sessions-drawer-title">${session.displayTitle}</h2>
            <div class="sessions-chip-row" style="margin-top: 8px;">
              <span class=${`session-status-badge ${session.status}`}>${session.status}</span>
              <span class="session-kind-badge">${session.source}</span>
            </div>
          </div>
          <button class="sessions-icon-btn" @click=${params.onClose} aria-label="Close">
            ${icons.x}
          </button>
        </div>
        <div class="sessions-drawer-actions">
          <a
            class="btn primary"
            href=${chatUrl}
            @click=${(event: MouseEvent) => {
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
            Open in Chat
          </a>
          <button class="btn danger" @click=${params.onDelete}>Delete Session</button>
        </div>
      </header>
      <nav class="sessions-drawer-tabs">
        ${(["overview", "conversation", "checkpoints"] as const).map(
          (tab) => html`
            <button
              class=${`sessions-tab ${params.tab === tab ? "is-active" : ""}`}
              @click=${() => params.onTab(tab)}
            >
              ${tab[0].toUpperCase()}${tab.slice(1)}
            </button>
          `,
        )}
      </nav>
      <div class="sessions-drawer-body">
        ${params.tab === "overview"
          ? html`
              <div class="sessions-meta-grid">
                <div class="sessions-meta-card">
                  <span class="sessions-meta-label">Session Key</span>
                  <span class="sessions-meta-value mono">${session.key}</span>
                  <button class="sessions-link-btn" @click=${params.onCopy}>
                    ${icons.copy} Copy
                  </button>
                </div>
                <div class="sessions-meta-card">
                  <span class="sessions-meta-label">Agent</span>
                  <span class="sessions-meta-value">${session.agentId ?? "unknown"}</span>
                </div>
                <div class="sessions-meta-card">
                  <span class="sessions-meta-label">Kind / Source</span>
                  <span class="sessions-meta-value">${session.kind} · ${session.source}</span>
                </div>
                <div class="sessions-meta-card">
                  <span class="sessions-meta-label">Label</span>
                  ${params.labelEditing
                    ? html`
                        <input
                          class="sessions-inline-input"
                          .value=${params.labelDraft}
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
                    : html`
                        <button class="session-add-label" @click=${params.onEditLabel}>
                          ${session.label || "No label"}
                        </button>
                      `}
                </div>
                <div class="sessions-meta-card">
                  <span class="sessions-meta-label">Created</span>
                  <span class="sessions-meta-value">unknown</span>
                </div>
                <div class="sessions-meta-card">
                  <span class="sessions-meta-label">Last Active</span>
                  <span class="sessions-meta-value">${session.updatedAt}</span>
                </div>
                <div class="sessions-meta-card">
                  <span class="sessions-meta-label">Token Usage</span>
                  <span class="sessions-meta-value">${renderSessionTokenBar(session, true)}</span>
                </div>
                <div class="sessions-meta-card">
                  <span class="sessions-meta-label">Store</span>
                  <span class="sessions-meta-value">${props.result?.path ?? "unknown"}</span>
                </div>
              </div>
              <details class="sessions-overrides">
                <summary>Session Overrides</summary>
                <div class="sessions-overrides-grid">
                  <div class="sessions-meta-card">
                    <span class="sessions-meta-label">Compaction</span>
                    <span class="sessions-meta-value">
                      ${row.compactionCheckpointCount
                        ? `${row.compactionCheckpointCount} checkpoint${row.compactionCheckpointCount === 1 ? "" : "s"}`
                        : "none"}
                    </span>
                    <button class="sessions-link-btn" @click=${() => params.onTab("checkpoints")}>
                      Show checkpoints
                    </button>
                  </div>
                  ${overrideSelect({
                    label: "Thinking",
                    value: thinking,
                    options: withCurrentLabeledOption(resolveThinkLevelOptions(row), thinking),
                    disabled: props.loading,
                    onChange: (value) =>
                      props.onPatch(session.key, {
                        thinkingLevel: resolveThinkLevelPatchValue(value),
                      }),
                  })}
                  ${overrideSelect({
                    label: "Fast",
                    value: fastMode,
                    options: withCurrentLabeledOption(FAST_LEVELS, fastMode),
                    disabled: props.loading,
                    onChange: (value) =>
                      props.onPatch(session.key, {
                        fastMode: value === "" ? null : value === "on",
                      }),
                  })}
                  ${overrideSelect({
                    label: "Verbose",
                    value: verbose,
                    options: withCurrentLabeledOption(VERBOSE_LEVELS, verbose),
                    disabled: props.loading,
                    onChange: (value) =>
                      props.onPatch(session.key, { verboseLevel: value || null }),
                  })}
                  ${overrideSelect({
                    label: "Reasoning",
                    value: reasoning,
                    options: withCurrentOption(REASONING_LEVELS, reasoning),
                    disabled: props.loading,
                    onChange: (value) =>
                      props.onPatch(session.key, { reasoningLevel: value || null }),
                  })}
                </div>
              </details>
            `
          : nothing}
        ${params.tab === "conversation"
          ? renderSessionConversation({
              loading: params.conversationLoading,
              error: params.conversationError,
              messages: params.conversationMessages,
              onRetry: params.onRetryConversation,
              onOpenChat: () => props.onNavigateToChat?.(session.key),
            })
          : nothing}
        ${params.tab === "checkpoints"
          ? renderSessionCheckpoints({
              sessionKey: session.key,
              checkpoints: checkpointItems,
              loading: props.checkpointLoadingKey === session.key,
              busyKey: props.checkpointBusyKey,
              error: checkpointError,
              onRetry: () => props.onToggleCheckpointDetails(session.key),
              onBranch: props.onBranchFromCheckpoint,
              onRestore: props.onRestoreCheckpoint,
            })
          : nothing}
      </div>
    </aside>
  `;
}
