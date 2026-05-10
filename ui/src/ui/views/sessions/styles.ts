import { html } from "lit";

export const sessionStyles = html`
  <style>
    .sessions-page {
      display: grid;
      gap: 16px;
    }

    .sessions-header {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(260px, 420px) auto;
      gap: 14px;
      align-items: start;
    }

    .sessions-title {
      margin: 0;
      font-size: 28px;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }

    .sessions-subtitle {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }

    .sessions-search {
      position: relative;
    }

    .sessions-search svg {
      position: absolute;
      left: 12px;
      top: 50%;
      width: 16px;
      height: 16px;
      transform: translateY(-50%);
      color: var(--muted);
    }

    .sessions-search input,
    .sessions-filter-select,
    .sessions-inline-input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--card) 92%, black 8%);
      color: var(--text);
      font: inherit;
      transition:
        border-color 150ms ease,
        background 150ms ease,
        box-shadow 150ms ease;
    }

    .sessions-search input {
      height: 40px;
      padding: 0 14px 0 38px;
    }

    .sessions-inline-input {
      height: 34px;
      padding: 0 10px;
    }

    .sessions-search input:focus,
    .sessions-filter-select:focus,
    .sessions-inline-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    .sessions-filter-bar,
    .sessions-filter-group,
    .sessions-pagination,
    .sessions-pagination-center,
    .sessions-row-actions,
    .sessions-drawer-actions,
    .sessions-chip-row,
    .sessions-bulk-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sessions-filter-bar {
      justify-content: space-between;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--card) 92%, transparent);
      padding: 10px;
      overflow: hidden;
    }

    .sessions-filter-group {
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .sessions-pill,
    .sessions-icon-btn,
    .sessions-sort-control,
    .sessions-tab,
    .sessions-link-btn {
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--card) 92%, transparent);
      color: var(--muted);
      transition:
        border-color 150ms ease,
        background 150ms ease,
        color 150ms ease,
        transform 150ms ease;
    }

    .sessions-pill {
      white-space: nowrap;
      border-radius: 999px;
      padding: 7px 11px;
      font-size: 12px;
      font-weight: 650;
    }

    .sessions-pill.is-active {
      border-color: var(--accent);
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .sessions-pill:hover,
    .sessions-icon-btn:hover,
    .sessions-tab:hover,
    .sessions-link-btn:hover {
      border-color: var(--border-strong);
      color: var(--text);
      background: color-mix(in srgb, var(--card) 78%, var(--muted) 22%);
    }

    .sessions-checkbox-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--text);
    }

    .sessions-checkbox-pill input,
    .session-row input[type="checkbox"] {
      accent-color: var(--accent);
    }

    .sessions-list {
      display: grid;
      gap: 12px;
    }

    .session-group {
      display: grid;
      gap: 8px;
    }

    .session-group-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 0;
      border-bottom: 1px solid var(--border);
      border-radius: 0;
      background: transparent;
      color: var(--text);
      padding: 8px 2px 9px;
      cursor: pointer;
    }

    .session-group-header__left {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 750;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .session-group-chevron {
      display: inline-grid;
      place-items: center;
      width: 18px;
      height: 18px;
      transition: transform 150ms ease;
    }

    .session-group-chevron.is-collapsed {
      transform: rotate(-90deg);
    }

    .session-group-chevron svg,
    .session-group-icon svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .session-group-icon {
      display: inline-grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 999px;
    }

    .session-group-count,
    .session-kind-badge,
    .session-override-chip,
    .session-status-badge {
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
    }

    .session-kind-badge {
      color: color-mix(in srgb, var(--text) 78%, var(--muted) 22%);
      background: color-mix(in srgb, var(--muted) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--muted) 20%, transparent);
    }

    .session-group-count {
      color: var(--muted);
      background: color-mix(in srgb, var(--muted) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--muted) 20%, transparent);
    }

    .session-override-chip {
      color: #f59e0b;
      background: color-mix(in srgb, #f59e0b 14%, transparent);
      border: 1px solid color-mix(in srgb, #f59e0b 25%, transparent);
    }

    .session-status-badge.active {
      color: #22c55e;
      background: color-mix(in srgb, #22c55e 13%, transparent);
      border: 1px solid color-mix(in srgb, #22c55e 22%, transparent);
    }

    .session-status-badge.idle,
    .session-status-badge.unknown {
      color: var(--muted);
      background: color-mix(in srgb, var(--muted) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--muted) 18%, transparent);
    }

    .session-row {
      position: relative;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) 132px;
      gap: 12px;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--card) 94%, transparent);
      min-height: 64px;
      padding: 12px 16px;
      transition:
        border-color 150ms ease,
        background 150ms ease,
        transform 150ms ease,
        box-shadow 150ms ease;
    }

    .session-row:hover {
      border-color: var(--border-strong);
      background: color-mix(in srgb, var(--card) 84%, var(--muted) 16%);
      transform: translateY(-1px);
      box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
    }

    .session-row-left {
      display: grid;
      grid-template-columns: auto 48px;
      gap: 10px;
      align-items: center;
    }

    .session-source-mark {
      display: grid;
      gap: 3px;
      justify-items: center;
      color: var(--text);
    }

    .session-source-icon {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--card) 70%, black 30%);
    }

    .session-source-icon svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .session-source-label-row {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-width: 0;
    }

    .session-source-label {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: var(--muted);
      text-transform: uppercase;
    }

    .session-source-chat {
      border-left: 1px solid color-mix(in srgb, var(--muted) 28%, transparent);
      color: var(--accent);
      font-size: 8px;
      font-weight: 850;
      letter-spacing: 0.1em;
      line-height: 1;
      padding-left: 5px;
      text-decoration: none;
      text-transform: uppercase;
    }

    .session-source-chat:hover,
    .session-source-chat:focus-visible {
      color: var(--accent-hover);
      outline: none;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .source-direct {
      color: #60a5fa;
      background: color-mix(in srgb, #3b82f6 14%, transparent);
      border-color: color-mix(in srgb, #3b82f6 28%, transparent);
    }

    .source-telegram {
      color: #38bdf8;
      background: color-mix(in srgb, #0ea5e9 14%, transparent);
      border-color: color-mix(in srgb, #0ea5e9 28%, transparent);
    }

    .source-discord {
      color: #a78bfa;
      background: color-mix(in srgb, #8b5cf6 14%, transparent);
      border-color: color-mix(in srgb, #8b5cf6 28%, transparent);
    }

    .source-cron {
      color: #818cf8;
      background: color-mix(in srgb, #6366f1 14%, transparent);
      border-color: color-mix(in srgb, #6366f1 28%, transparent);
    }

    .source-other {
      color: var(--muted);
      background: color-mix(in srgb, var(--muted) 12%, transparent);
      border-color: color-mix(in srgb, var(--muted) 22%, transparent);
    }

    .session-main {
      min-width: 0;
      display: grid;
      gap: 5px;
    }

    .session-title-btn {
      border: 0;
      background: transparent;
      color: var(--text);
      padding: 0;
      text-align: left;
      font: inherit;
      font-weight: 760;
      font-size: 15px;
      cursor: pointer;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .session-secondary {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: var(--muted);
      font-size: 12px;
    }

    .session-secondary .mono {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .session-add-label {
      border: 0;
      background: transparent;
      color: color-mix(in srgb, var(--muted) 70%, transparent);
      padding: 0;
      cursor: pointer;
      font: inherit;
    }

    .sessions-icon-btn {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      padding: 0;
      cursor: pointer;
    }

    .sessions-icon-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .session-secondary > .sessions-icon-btn {
      width: 24px;
      height: 24px;
      opacity: 0;
      pointer-events: none;
    }

    .session-row:hover .session-secondary > .sessions-icon-btn,
    .session-row:focus-within .session-secondary > .sessions-icon-btn {
      opacity: 1;
      pointer-events: auto;
    }

    .sessions-link-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 30px;
      border-radius: 10px;
      padding: 0 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .sessions-link-btn.danger,
    .sessions-icon-btn.danger {
      color: #ef4444;
      border-color: color-mix(in srgb, #ef4444 28%, var(--border));
    }

    .session-row-actions {
      position: absolute;
      right: 12px;
      top: 50%;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 6px;
      transform: translateY(-50%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms ease;
    }

    .session-row:hover .session-row-actions,
    .session-row:focus-within .session-row-actions {
      opacity: 1;
      pointer-events: auto;
    }

    .session-meta {
      display: grid;
      justify-items: end;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
      transition: opacity 150ms ease;
    }

    .session-row:hover .session-meta,
    .session-row:focus-within .session-meta {
      opacity: 0;
    }

    .session-token-bar {
      width: 120px;
      display: grid;
      gap: 4px;
      text-align: right;
    }

    .session-token-track {
      height: 3px;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--muted) 13%, transparent);
    }

    .session-token-fill {
      height: 100%;
      border-radius: inherit;
      background: #22c55e;
    }

    .session-token-fill.warn {
      background: #f59e0b;
    }

    .session-token-fill.danger {
      background: #ef4444;
    }

    .session-updated.active {
      color: #22c55e;
    }

    .session-updated.recent {
      color: #f59e0b;
    }

    .session-updated-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    .session-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--muted);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--muted) 14%, transparent);
    }

    .session-status-dot.active {
      background: #22c55e;
      box-shadow: 0 0 0 3px color-mix(in srgb, #22c55e 14%, transparent);
    }

    .session-status-dot.idle {
      background: #f59e0b;
      box-shadow: 0 0 0 3px color-mix(in srgb, #f59e0b 14%, transparent);
    }

    .session-status-dot.stale {
      background: color-mix(in srgb, var(--muted) 74%, transparent);
    }

    .sessions-sort-control {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 4px 2px;
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }

    .sessions-sort-control svg {
      width: 13px;
      height: 13px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .sessions-sort-control span {
      min-width: 24px;
      color: color-mix(in srgb, var(--muted) 70%, transparent);
      font-weight: 650;
    }

    .sessions-sort-control:hover,
    .sessions-sort-control.is-active {
      color: var(--text);
      text-decoration: underline;
      text-underline-offset: 4px;
    }

    .sessions-drawer-backdrop,
    .sessions-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      background: rgba(0, 0, 0, 0.5);
    }

    .sessions-drawer {
      position: fixed;
      z-index: 71;
      top: 0;
      right: 0;
      width: min(580px, calc(100vw - 24px));
      height: 100vh;
      display: grid;
      grid-template-rows: auto auto 1fr;
      border-left: 1px solid var(--border);
      background: color-mix(in srgb, var(--bg) 86%, var(--card) 14%);
      box-shadow: -24px 0 48px rgba(0, 0, 0, 0.36);
      animation: sessionsSlideIn 200ms ease;
    }

    @keyframes sessionsSlideIn {
      from {
        transform: translateX(18px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .sessions-drawer-header {
      display: grid;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      padding: 20px;
    }

    .sessions-drawer-title-row {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 14px;
    }

    .sessions-drawer-title {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .sessions-drawer-tabs {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      padding: 0 20px;
    }

    .sessions-tab {
      border-bottom: 0;
      border-radius: 12px 12px 0 0;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
    }

    .sessions-tab.is-active {
      border-color: var(--accent);
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .sessions-drawer-body {
      min-height: 0;
      overflow: auto;
      padding: 20px;
    }

    .sessions-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .sessions-meta-card,
    .sessions-overrides,
    .sessions-conversation,
    .sessions-checkpoint-card,
    .sessions-empty {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--card) 92%, transparent);
    }

    .sessions-meta-card {
      display: grid;
      gap: 6px;
      padding: 12px;
      min-width: 0;
    }

    .sessions-meta-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .sessions-meta-value {
      min-width: 0;
      color: var(--text);
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    .sessions-overrides {
      margin-top: 14px;
      overflow: hidden;
    }

    .sessions-overrides summary {
      cursor: pointer;
      padding: 14px;
      font-weight: 750;
    }

    .sessions-overrides-grid {
      display: grid;
      gap: 12px;
      padding: 0 14px 14px;
    }

    .sessions-field {
      display: grid;
      gap: 6px;
    }

    .sessions-field label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    .sessions-field select {
      height: 34px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card);
      color: var(--text);
      padding: 0 10px;
    }

    .sessions-conversation {
      min-height: 320px;
      display: grid;
      align-content: start;
      gap: 12px;
      padding: 14px;
    }

    .session-message {
      max-width: 82%;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 10px 12px;
      white-space: pre-wrap;
      font-size: 13px;
      line-height: 1.45;
    }

    .session-message.user {
      justify-self: end;
      background: var(--accent-subtle);
      border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
    }

    .session-message.assistant,
    .session-message.tool,
    .session-message.unknown {
      justify-self: start;
      background: color-mix(in srgb, var(--card) 88%, black 12%);
    }

    .session-message.system {
      justify-self: center;
      max-width: 92%;
      border-color: transparent;
      background: transparent;
      color: var(--muted);
      font-style: italic;
      text-align: center;
    }

    .sessions-checkpoints {
      display: grid;
      gap: 12px;
    }

    .sessions-checkpoint-card {
      display: grid;
      gap: 10px;
      padding: 14px;
    }

    .sessions-bulk-bar {
      position: sticky;
      bottom: 16px;
      z-index: 20;
      justify-content: center;
      width: fit-content;
      max-width: calc(100vw - 48px);
      margin: 10px auto 0;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      background: color-mix(in srgb, var(--bg) 86%, var(--card) 14%);
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32);
      padding: 8px 10px;
    }

    .sessions-bulk-popover {
      position: absolute;
      bottom: 54px;
      left: 50%;
      width: min(320px, calc(100vw - 40px));
      transform: translateX(-50%);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--card);
      padding: 12px;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.34);
    }

    .sessions-pagination {
      justify-content: space-between;
      border-top: 1px solid var(--border);
      padding-top: 12px;
      color: var(--muted);
      font-size: 13px;
    }

    .sessions-pagination-center {
      justify-content: center;
    }

    .sessions-empty {
      display: grid;
      place-items: center;
      gap: 10px;
      min-height: 280px;
      padding: 32px;
      text-align: center;
      color: var(--muted);
    }

    .sessions-empty svg {
      width: 42px;
      height: 42px;
      color: var(--accent);
    }

    .sessions-skeleton-row {
      height: 92px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background: linear-gradient(
        90deg,
        color-mix(in srgb, white 4%, transparent),
        color-mix(in srgb, white 9%, transparent),
        color-mix(in srgb, white 4%, transparent)
      );
      background-size: 220% 100%;
      animation: sessionsShimmer 1.2s ease-in-out infinite;
    }

    @keyframes sessionsShimmer {
      from {
        background-position: 120% 0;
      }
      to {
        background-position: -120% 0;
      }
    }

    @media (max-width: 860px) {
      .sessions-header {
        grid-template-columns: 1fr;
      }

      .sessions-filter-bar,
      .sessions-pagination {
        align-items: stretch;
        flex-direction: column;
      }

      .session-row {
        grid-template-columns: 1fr;
      }

      .session-meta {
        justify-items: start;
      }

      .sessions-meta-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
`;
