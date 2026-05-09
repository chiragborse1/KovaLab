import { html } from "lit";
import { formatRelativeTimestamp } from "../../format.ts";
import type { SessionCompactionCheckpoint } from "../../types.ts";
import { formatCheckpointDelta, formatCheckpointReason } from "./sessionUtils.ts";

export function renderSessionCheckpoints(params: {
  sessionKey: string;
  checkpoints: SessionCompactionCheckpoint[];
  loading: boolean;
  busyKey: string | null;
  error: string | null;
  onBranch: (sessionKey: string, checkpointId: string) => void | Promise<void>;
  onRestore: (sessionKey: string, checkpointId: string) => void | Promise<void>;
  onRetry: () => void;
}) {
  if (params.loading) {
    return html`<div class="sessions-empty">Loading checkpoints…</div>`;
  }
  if (params.error) {
    return html`
      <div class="sessions-empty">
        <strong>Could not load checkpoints</strong>
        <span>${params.error}</span>
        <button class="btn" @click=${params.onRetry}>Retry</button>
      </div>
    `;
  }
  if (params.checkpoints.length === 0) {
    return html`<div class="sessions-empty">No checkpoints for this session</div>`;
  }
  return html`
    <div class="sessions-checkpoints">
      ${params.checkpoints.map(
        (checkpoint) => html`
          <div class="sessions-checkpoint-card">
            <div class="row" style="justify-content: space-between; gap: 12px;">
              <strong
                >${formatCheckpointReason(checkpoint.reason)} ·
                ${formatRelativeTimestamp(checkpoint.createdAt)}</strong
              >
              <span class="muted">${formatCheckpointDelta(checkpoint)}</span>
            </div>
            <div class="mono muted">${checkpoint.checkpointId}</div>
            <div>${checkpoint.summary || "No summary captured."}</div>
            <div class="row" style="gap: 8px; flex-wrap: wrap;">
              <button
                class="btn btn--sm"
                ?disabled=${params.busyKey === checkpoint.checkpointId}
                @click=${() => params.onBranch(params.sessionKey, checkpoint.checkpointId)}
              >
                Branch from checkpoint
              </button>
              <button
                class="btn btn--sm"
                ?disabled=${params.busyKey === checkpoint.checkpointId}
                @click=${() => params.onRestore(params.sessionKey, checkpoint.checkpointId)}
              >
                Restore
              </button>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}
