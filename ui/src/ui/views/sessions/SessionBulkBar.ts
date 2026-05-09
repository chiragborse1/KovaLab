import { html, nothing } from "lit";
import { icons } from "../../icons.ts";

export function renderSessionBulkBar(params: {
  count: number;
  labelOpen: boolean;
  labelDraft: string;
  deleteOpen: boolean;
  onClear: () => void;
  onToggleLabel: () => void;
  onLabelDraft: (value: string) => void;
  onApplyLabel: () => void;
  onExport: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  if (params.count <= 0) {
    return nothing;
  }
  return html`
    <div class="sessions-bulk-bar">
      <strong>${params.count} session${params.count === 1 ? "" : "s"} selected</strong>
      <button class="sessions-link-btn" @click=${params.onClear}>${icons.x} Clear</button>
      <button class="sessions-link-btn" @click=${params.onToggleLabel}>
        ${icons.penLine} Label
      </button>
      <button class="sessions-link-btn" @click=${params.onExport}>${icons.download} Export</button>
      <button class="sessions-link-btn danger" @click=${params.onAskDelete}>
        ${icons.trash} Delete
      </button>
      ${params.labelOpen
        ? html`
            <div class="sessions-bulk-popover">
              <div class="sessions-field">
                <label>Apply label to selected sessions</label>
                <input
                  class="sessions-inline-input"
                  .value=${params.labelDraft}
                  @input=${(event: Event) =>
                    params.onLabelDraft((event.target as HTMLInputElement).value)}
                  @keydown=${(event: KeyboardEvent) => {
                    if (event.key === "Enter") {
                      params.onApplyLabel();
                    }
                  }}
                />
                <button class="btn primary" @click=${params.onApplyLabel}>Apply label</button>
              </div>
            </div>
          `
        : nothing}
      ${params.deleteOpen
        ? html`
            <div class="sessions-modal-backdrop" @click=${params.onCancelDelete}></div>
            <div
              class="sessions-bulk-popover"
              style="position: fixed; z-index: 80; top: 50%; bottom: auto; left: 50%; transform: translate(-50%, -50%);"
            >
              <strong>Delete ${params.count} sessions?</strong>
              <p class="muted">This cannot be undone.</p>
              <div class="row" style="justify-content: flex-end; gap: 8px;">
                <button class="btn" @click=${params.onCancelDelete}>Cancel</button>
                <button class="btn danger" @click=${params.onConfirmDelete}>Confirm Delete</button>
              </div>
            </div>
          `
        : nothing}
    </div>
  `;
}
