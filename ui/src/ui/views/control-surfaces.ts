import { html, nothing, type TemplateResult } from "lit";
import type { Tab } from "../navigation.ts";
import type {
  AgentsListResult,
  ChannelsStatusSnapshot,
  CronJob,
  SessionsListResult,
  SkillStatusReport,
  StatusSummary,
} from "../types.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function countChannels(snapshot: ChannelsStatusSnapshot | null) {
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

function taskSummary(status: StatusSummary | null) {
  const tasks = asRecord(status?.tasks);
  const byStatus = asRecord(tasks.byStatus);
  const numeric = (key: string) => {
    const value = tasks[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  const statusNumeric = (key: string) => {
    const value = byStatus[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return {
    total: numeric("total"),
    active: numeric("active"),
    failures: numeric("failures"),
    queued: statusNumeric("queued"),
    running: statusNumeric("running"),
  };
}

function stat(label: string, value: string | number, detail?: string): TemplateResult {
  return html`
    <div class="stat">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${detail ? html`<div class="stat-sub">${detail}</div>` : nothing}
    </div>
  `;
}

export function renderTasksSurface(params: {
  loading: boolean;
  status: StatusSummary | null;
  onRefresh: () => void;
}) {
  const tasks = taskSummary(params.status);
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Task Health</div>
          <div class="card-sub">
            Durable task summary from gateway status. Use Advanced → Debug for raw RPC detail.
          </div>
        </div>
        <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
          ${params.loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div class="stat-grid" style="margin-top: 16px;">
        ${stat("Tracked", tasks.total)} ${stat("Active", tasks.active)}
        ${stat("Queued", tasks.queued)} ${stat("Running", tasks.running)}
        ${stat("Issues", tasks.failures)}
      </div>
      ${!params.status
        ? html`<div class="muted" style="margin-top: 16px;">Load status to inspect tasks.</div>`
        : tasks.total === 0
          ? html`<div class="callout success" style="margin-top: 16px;">
              No tracked background tasks in the current gateway snapshot.
            </div>`
          : html`<pre class="code-block" style="margin-top: 16px;">
${JSON.stringify(params.status.tasks ?? {}, null, 2)}</pre
            >`}
    </section>
  `;
}

export function renderConductorSurface(params: {
  agents: AgentsListResult | null;
  sessions: SessionsListResult | null;
  cronJobs: CronJob[];
  skills: SkillStatusReport | null;
  channels: ChannelsStatusSnapshot | null;
  onNavigate: (tab: Tab) => void;
}) {
  const channelCounts = countChannels(params.channels);
  const readySkills =
    params.skills?.skills?.filter(
      (entry) => entry.eligible && !entry.disabled && !entry.blockedByAllowlist,
    ).length ?? 0;
  const totalSkills = params.skills?.skills?.length ?? 0;
  return html`
    <div class="grid grid-cols-2">
      <section class="card">
        <div class="card-title">Conductor Overview</div>
        <div class="card-sub">
          Coordination state across agents, sessions, jobs, channels, and skills.
        </div>
        <div class="stat-grid" style="margin-top: 16px;">
          ${stat("Agents", params.agents?.agents.length ?? 0)}
          ${stat("Sessions", params.sessions?.sessions?.length ?? 0)}
          ${stat("Jobs", params.cronJobs.length)}
          ${stat("Channels", `${channelCounts.connected}/${channelCounts.total}`)}
          ${stat("Ready skills", `${readySkills}/${totalSkills}`)}
        </div>
      </section>

      <section class="card">
        <div class="card-title">Route Work</div>
        <div class="card-sub">Jump directly into the owner surface for each workflow.</div>
        <div class="row" style="margin-top: 16px;">
          <button class="btn btn--sm" @click=${() => params.onNavigate("agents")}>Agents</button>
          <button class="btn btn--sm" @click=${() => params.onNavigate("cron")}>Jobs</button>
          <button class="btn btn--sm" @click=${() => params.onNavigate("sessions")}>
            Sessions
          </button>
          <button class="btn btn--sm" @click=${() => params.onNavigate("skills")}>Skills</button>
        </div>
      </section>
    </div>
  `;
}
