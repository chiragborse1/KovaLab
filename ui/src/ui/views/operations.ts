import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelsStatusSnapshot, CronJob, CronStatus, LogEntry } from "../types.ts";

export type OperationsProps = {
  connected: boolean;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsLoading: boolean;
  channelsError: string | null;
  cronStatus: CronStatus | null;
  cronJobs: CronJob[];
  cronLoading: boolean;
  nodes: Array<Record<string, unknown>>;
  nodesLoading: boolean;
  logsEntries: LogEntry[];
  logsLoading: boolean;
  logsError: string | null;
  onRefresh: () => void;
};

function countConnectedChannels(snapshot: ChannelsStatusSnapshot | null) {
  if (!snapshot) {
    return { connected: 0, total: 0 };
  }
  let connected = 0;
  let total = 0;
  for (const accounts of Object.values(snapshot.channelAccounts ?? {})) {
    for (const account of accounts) {
      total += 1;
      const probeOk =
        account.probe && typeof account.probe === "object" && "ok" in account.probe
          ? Boolean((account.probe as { ok?: unknown }).ok)
          : false;
      if (account.connected === true || account.running === true || probeOk) {
        connected += 1;
      }
    }
  }
  return { connected, total };
}

function logMessage(entry: LogEntry) {
  return entry.message || entry.raw || "";
}

export function renderOperations(props: OperationsProps) {
  const channels = countConnectedChannels(props.channelsSnapshot);
  const activeJobs = props.cronJobs.filter((job) => job.enabled).length;
  const recentLogs = props.logsEntries.slice(-8).reverse();
  const busy =
    props.channelsLoading || props.cronLoading || props.nodesLoading || props.logsLoading;

  return html`
    <div class="grid grid-cols-2">
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">Runtime Snapshot</div>
            <div class="card-sub">Gateway, channels, node host, and scheduler at a glance.</div>
          </div>
          <button class="btn btn--sm" ?disabled=${busy} @click=${props.onRefresh}>
            ${busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Gateway</div>
            <div class="stat-value">${props.connected ? "Online" : "Offline"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Channels</div>
            <div class="stat-value">${channels.connected}/${channels.total}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Nodes</div>
            <div class="stat-value">${props.nodes.length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Jobs</div>
            <div class="stat-value">${activeJobs}/${props.cronJobs.length}</div>
          </div>
        </div>
        ${props.channelsError
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.channelsError}</div>`
          : nothing}
      </section>

      <section class="card">
        <div class="card-title">Scheduler</div>
        <div class="card-sub">Current cron state and next wakeup.</div>
        <div class="list" style="margin-top: 16px;">
          <div class="list-item">
            <div class="list-main">
              <div class="list-title">Status</div>
              <div class="list-sub">
                ${props.cronStatus?.enabled ? "Scheduler enabled" : "Scheduler disabled or unknown"}
              </div>
            </div>
            <div class="list-meta">
              <div>${props.cronStatus?.jobs ?? props.cronJobs.length} tracked jobs</div>
              <div>
                Next wake:
                ${props.cronStatus?.nextWakeAtMs
                  ? formatRelativeTimestamp(props.cronStatus.nextWakeAtMs)
                  : "none"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-title">Recent Gateway Logs</div>
      <div class="card-sub">Last operational events from the live log stream.</div>
      ${props.logsError
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.logsError}</div>`
        : nothing}
      ${recentLogs.length === 0
        ? html`<div class="muted" style="margin-top: 16px;">No logs loaded yet.</div>`
        : html`
            <div class="list" style="margin-top: 16px;">
              ${recentLogs.map(
                (entry) => html`
                  <div class="list-item">
                    <div class="list-main">
                      <div class="list-title mono">${entry.level ?? "info"}</div>
                      <div class="list-sub">${logMessage(entry)}</div>
                    </div>
                    <div class="list-meta">
                      ${entry.time ? new Date(entry.time).toLocaleTimeString() : ""}
                    </div>
                  </div>
                `,
              )}
            </div>
          `}
    </section>
  `;
}
