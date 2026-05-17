import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import { pathForTab } from "../navigation.ts";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  ModelCatalogEntry,
  SkillStatusReport,
  ToolsCatalogResult,
  ToolsEffectiveResult,
} from "../types.ts";
import { renderAgentOverview } from "./agents-panels-overview.ts";
import {
  renderAgentFiles,
  renderAgentChannels,
  renderAgentCron,
} from "./agents-panels-status-files.ts";
export type { AgentsPanel } from "./agents.types.ts";
import { renderAgentTools, renderAgentSkills } from "./agents-panels-tools-skills.ts";
import {
  type AgentContext,
  agentAvatarHue,
  agentBadgeText,
  buildAgentContext,
  normalizeAgentLabel,
  resolveAgentAvatarUrl,
  resolveAgentEmoji,
} from "./agents-utils.ts";
import type { AgentsPanel } from "./agents.types.ts";

export type ConfigState = {
  form: Record<string, unknown> | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
};

export type ChannelsState = {
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  lastSuccess: number | null;
};

export type CronState = {
  status: CronStatus | null;
  jobs: CronJob[];
  loading: boolean;
  error: string | null;
};

export type AgentFilesState = {
  list: AgentsFilesListResult | null;
  loading: boolean;
  error: string | null;
  active: string | null;
  contents: Record<string, string>;
  drafts: Record<string, string>;
  saving: boolean;
};

export type AgentSkillsState = {
  report: SkillStatusReport | null;
  loading: boolean;
  error: string | null;
  agentId: string | null;
  filter: string;
};

export type ToolsCatalogState = {
  loading: boolean;
  error: string | null;
  result: ToolsCatalogResult | null;
};

export type ToolsEffectiveState = {
  loading: boolean;
  error: string | null;
  result: ToolsEffectiveResult | null;
};

export type AgentsProps = {
  basePath: string;
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  activePanel: AgentsPanel;
  config: ConfigState;
  channels: ChannelsState;
  cron: CronState;
  agentFiles: AgentFilesState;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkills: AgentSkillsState;
  toolsCatalog: ToolsCatalogState;
  toolsEffective: ToolsEffectiveState;
  runtimeSessionKey: string;
  runtimeSessionMatchesSelectedAgent: boolean;
  modelCatalog: ModelCatalogEntry[];
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onToolsProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onToolsOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onChannelsRefresh: () => void;
  onCronRefresh: () => void;
  onCronRunNow: (jobId: string) => void;
  onSkillsFilterChange: (next: string) => void;
  onSkillsRefresh: () => void;
  onAgentSkillToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  onAgentSkillsClear: (agentId: string) => void;
  onAgentSkillsDisableAll: (agentId: string) => void;
  onSetDefault: (agentId: string) => void;
};

type AgentView = {
  agent: AgentsListResult["agents"][number];
  context: AgentContext;
  identity: AgentIdentityResult | null;
  label: string;
  initials: string;
  emoji: string;
  avatarUrl: string | null;
  hue: number;
  selected: boolean;
  isDefault: boolean;
};

export function renderAgents(props: AgentsProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (agents.find((agent) => agent.id === selectedId) ?? null)
    : null;
  const selectedSkillCount =
    selectedId && props.agentSkills.agentId === selectedId
      ? (props.agentSkills.report?.skills?.length ?? null)
      : null;

  const channelEntryCount = props.channels.snapshot
    ? Object.keys(props.channels.snapshot.channelAccounts ?? {}).length
    : null;
  const cronJobCount = selectedId
    ? props.cron.jobs.filter((j) => j.agentId === selectedId).length
    : null;
  const liveToolCount = props.runtimeSessionMatchesSelectedAgent
    ? (props.toolsEffective.result?.groups ?? []).reduce(
        (sum, group) => sum + group.tools.length,
        0,
      )
    : null;
  const selectedFilesCount =
    selectedId && props.agentFiles.list?.agentId === selectedId
      ? props.agentFiles.list.files.length
      : null;
  const tabCounts: Record<string, number | null> = {
    files: props.agentFiles.list?.files?.length ?? null,
    skills: selectedSkillCount,
    channels: channelEntryCount,
    cron: cronJobCount || null,
  };
  const agentViews = agents.map((agent) =>
    buildAgentView({
      agent,
      selectedId,
      defaultId,
      configForm: props.config.form,
      agentFilesList: props.agentFiles.list,
      identity: props.agentIdentityById[agent.id] ?? null,
    }),
  );
  const selectedView = selectedAgent
    ? buildAgentView({
        agent: selectedAgent,
        selectedId,
        defaultId,
        configForm: props.config.form,
        agentFilesList: props.agentFiles.list,
        identity: props.agentIdentityById[selectedAgent.id] ?? null,
      })
    : null;

  return html`
    <div class="agents-layout">
      ${renderAgentsCommandDeck({
        props,
        agents,
        agentViews,
        selectedView,
        selectedId,
        defaultId,
        selectedSkillCount,
        selectedFilesCount,
        channelEntryCount,
        cronJobCount,
        liveToolCount,
      })}
      ${renderAgentRoster(agentViews, props.onSelectAgent)}
      <section class="agents-main">
        ${!selectedAgent
          ? html`
              <div class="card">
                <div class="card-title">Select an agent</div>
                <div class="card-sub">Pick an agent to inspect its workspace and tools.</div>
              </div>
            `
          : html`
              ${renderAgentTabs(
                props.activePanel,
                (panel) => props.onSelectPanel(panel),
                tabCounts,
              )}
              ${props.activePanel === "overview"
                ? renderAgentOverview({
                    agent: selectedAgent,
                    basePath: props.basePath,
                    defaultId,
                    configForm: props.config.form,
                    agentFilesList: props.agentFiles.list,
                    agentIdentity: props.agentIdentityById[selectedAgent.id] ?? null,
                    agentIdentityError: props.agentIdentityError,
                    agentIdentityLoading: props.agentIdentityLoading,
                    configLoading: props.config.loading,
                    configSaving: props.config.saving,
                    configDirty: props.config.dirty,
                    modelCatalog: props.modelCatalog,
                    onConfigReload: props.onConfigReload,
                    onConfigSave: props.onConfigSave,
                    onModelChange: props.onModelChange,
                    onModelFallbacksChange: props.onModelFallbacksChange,
                    onSelectPanel: props.onSelectPanel,
                  })
                : nothing}
              ${props.activePanel === "files"
                ? renderAgentFiles({
                    agentId: selectedAgent.id,
                    agentFilesList: props.agentFiles.list,
                    agentFilesLoading: props.agentFiles.loading,
                    agentFilesError: props.agentFiles.error,
                    agentFileActive: props.agentFiles.active,
                    agentFileContents: props.agentFiles.contents,
                    agentFileDrafts: props.agentFiles.drafts,
                    agentFileSaving: props.agentFiles.saving,
                    onLoadFiles: props.onLoadFiles,
                    onSelectFile: props.onSelectFile,
                    onFileDraftChange: props.onFileDraftChange,
                    onFileReset: props.onFileReset,
                    onFileSave: props.onFileSave,
                  })
                : nothing}
              ${props.activePanel === "tools"
                ? renderAgentTools({
                    agentId: selectedAgent.id,
                    configForm: props.config.form,
                    configLoading: props.config.loading,
                    configSaving: props.config.saving,
                    configDirty: props.config.dirty,
                    toolsCatalogLoading: props.toolsCatalog.loading,
                    toolsCatalogError: props.toolsCatalog.error,
                    toolsCatalogResult: props.toolsCatalog.result,
                    toolsEffectiveLoading: props.toolsEffective.loading,
                    toolsEffectiveError: props.toolsEffective.error,
                    toolsEffectiveResult: props.toolsEffective.result,
                    runtimeSessionKey: props.runtimeSessionKey,
                    runtimeSessionMatchesSelectedAgent: props.runtimeSessionMatchesSelectedAgent,
                    onProfileChange: props.onToolsProfileChange,
                    onOverridesChange: props.onToolsOverridesChange,
                    onConfigReload: props.onConfigReload,
                    onConfigSave: props.onConfigSave,
                  })
                : nothing}
              ${props.activePanel === "skills"
                ? renderAgentSkills({
                    agentId: selectedAgent.id,
                    report: props.agentSkills.report,
                    loading: props.agentSkills.loading,
                    error: props.agentSkills.error,
                    activeAgentId: props.agentSkills.agentId,
                    configForm: props.config.form,
                    configLoading: props.config.loading,
                    configSaving: props.config.saving,
                    configDirty: props.config.dirty,
                    filter: props.agentSkills.filter,
                    onFilterChange: props.onSkillsFilterChange,
                    onRefresh: props.onSkillsRefresh,
                    onToggle: props.onAgentSkillToggle,
                    onClear: props.onAgentSkillsClear,
                    onDisableAll: props.onAgentSkillsDisableAll,
                    onConfigReload: props.onConfigReload,
                    onConfigSave: props.onConfigSave,
                  })
                : nothing}
              ${props.activePanel === "channels"
                ? renderAgentChannels({
                    context: buildAgentContext(
                      selectedAgent,
                      props.config.form,
                      props.agentFiles.list,
                      defaultId,
                      props.agentIdentityById[selectedAgent.id] ?? null,
                    ),
                    configForm: props.config.form,
                    snapshot: props.channels.snapshot,
                    loading: props.channels.loading,
                    error: props.channels.error,
                    lastSuccess: props.channels.lastSuccess,
                    onRefresh: props.onChannelsRefresh,
                    onSelectPanel: props.onSelectPanel,
                  })
                : nothing}
              ${props.activePanel === "cron"
                ? renderAgentCron({
                    context: buildAgentContext(
                      selectedAgent,
                      props.config.form,
                      props.agentFiles.list,
                      defaultId,
                      props.agentIdentityById[selectedAgent.id] ?? null,
                    ),
                    agentId: selectedAgent.id,
                    jobs: props.cron.jobs,
                    status: props.cron.status,
                    loading: props.cron.loading,
                    error: props.cron.error,
                    onRefresh: props.onCronRefresh,
                    onRunNow: props.onCronRunNow,
                    onSelectPanel: props.onSelectPanel,
                  })
                : nothing}
            `}
      </section>
    </div>
  `;
}

function buildAgentView(params: {
  agent: AgentsListResult["agents"][number];
  selectedId: string | null;
  defaultId: string | null;
  configForm: Record<string, unknown> | null;
  agentFilesList: AgentsFilesListResult | null;
  identity: AgentIdentityResult | null;
}): AgentView {
  const label = normalizeAgentLabel(params.agent);
  return {
    agent: params.agent,
    context: buildAgentContext(
      params.agent,
      params.configForm,
      params.agentFilesList,
      params.defaultId,
      params.identity,
    ),
    identity: params.identity,
    label,
    initials: resolveAgentInitials(label, params.agent.id),
    emoji: resolveAgentEmoji(params.agent, params.identity),
    avatarUrl: resolveAgentAvatarUrl(params.agent, params.identity),
    hue: agentAvatarHue(params.agent.id),
    selected: params.agent.id === params.selectedId,
    isDefault: Boolean(params.defaultId && params.agent.id === params.defaultId),
  };
}

function resolveAgentInitials(label: string, fallback: string): string {
  const parts = label
    .trim()
    .split(/[\s_-]+/g)
    .filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || fallback.slice(0, 2).toUpperCase() || "A";
}

function renderAgentAvatar(view: AgentView, size: "sm" | "lg" = "sm") {
  return html`
    <span
      class="agent-avatar agent-avatar--${size} agent-avatar--reactor"
      style=${`--agent-hue: ${view.hue};`}
      aria-hidden="true"
    >
      ${view.avatarUrl
        ? html`<img src=${view.avatarUrl} alt="" />`
        : view.emoji
          ? html`<span>${view.emoji}</span>`
          : html`<span>${view.initials}</span>`}
    </span>
  `;
}

function renderAgentsCommandDeck(params: {
  props: AgentsProps;
  agents: AgentsListResult["agents"];
  agentViews: AgentView[];
  selectedView: AgentView | null;
  selectedId: string | null;
  defaultId: string | null;
  selectedSkillCount: number | null;
  selectedFilesCount: number | null;
  channelEntryCount: number | null;
  cronJobCount: number | null;
  liveToolCount: number | null;
}) {
  const selected = params.selectedView;
  const statusLabel = params.props.runtimeSessionMatchesSelectedAgent
    ? "Live in chat"
    : params.selectedId
      ? "Standby"
      : "No agent selected";
  const configState = params.props.config.saving
    ? "Saving"
    : params.props.config.dirty
      ? "Unsaved"
      : params.props.config.loading
        ? "Loading"
        : "Synced";
  const chatHref = pathForTab("chat", params.props.basePath);
  return html`
    <section class="card agents-command-deck">
      <div class="agents-command-deck__hero">
        <div class="agents-command-deck__identity">
          ${selected ? renderAgentAvatar(selected, "lg") : nothing}
          <div class="agents-command-deck__copy">
            <div class="agents-eyebrow">
              <span
                class="agents-live-dot ${params.props.runtimeSessionMatchesSelectedAgent
                  ? "is-live"
                  : ""}"
              ></span>
              Agent command deck
            </div>
            <h2>${selected?.label ?? "No agent selected"}</h2>
            <p>
              ${selected
                ? html`
                    <span class="mono">${selected.agent.id}</span>
                    <span>·</span>
                    <span>${selected.context.model}</span>
                  `
                : "Pick an agent to inspect its runtime, workspace, and operating surface."}
            </p>
          </div>
        </div>
        <div class="agents-command-deck__actions">
          <div class="agents-control-select">
            <select
              class="agents-select"
              .value=${params.selectedId ?? ""}
              ?disabled=${params.props.loading || params.agents.length === 0}
              @change=${(e: Event) =>
                params.props.onSelectAgent((e.target as HTMLSelectElement).value)}
            >
              ${params.agents.length === 0
                ? html` <option value="">No agents</option> `
                : params.agents.map(
                    (agent) => html`
                      <option value=${agent.id} ?selected=${agent.id === params.selectedId}>
                        ${normalizeAgentLabel(agent)}${agentBadgeText(agent.id, params.defaultId)
                          ? ` (${agentBadgeText(agent.id, params.defaultId)})`
                          : ""}
                      </option>
                    `,
                  )}
            </select>
          </div>
          ${selected
            ? html`
                <button
                  type="button"
                  class="btn btn--sm btn--ghost"
                  @click=${() => void navigator.clipboard.writeText(selected.agent.id)}
                  title="Copy agent ID to clipboard"
                >
                  ${icons.copy} Copy ID
                </button>
                <button
                  type="button"
                  class="btn btn--sm btn--ghost"
                  ?disabled=${selected.isDefault}
                  @click=${() => params.props.onSetDefault(selected.agent.id)}
                  title=${selected.isDefault
                    ? "Already the default agent"
                    : "Set as the default agent"}
                >
                  ${selected.isDefault ? "Default" : "Set Default"}
                </button>
              `
            : nothing}
          <a class="btn btn--sm btn--ghost" href=${chatHref}>${icons.messageSquare} Chat</a>
          <button
            class="btn btn--sm agents-refresh-btn"
            ?disabled=${params.props.loading}
            @click=${params.props.onRefresh}
          >
            ${params.props.loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>
      </div>
      ${params.props.error
        ? html`<div class="callout danger">${params.props.error}</div>`
        : nothing}
      <div class="agents-command-grid">
        ${renderAgentCommandMetric("Fleet", String(params.agentViews.length), "configured agents")}
        ${renderAgentCommandMetric(
          "Runtime",
          statusLabel,
          params.props.runtimeSessionKey || "no active session",
          params.props.runtimeSessionMatchesSelectedAgent ? "ok" : null,
        )}
        ${renderAgentCommandMetric(
          "Files",
          params.selectedFilesCount == null ? "Load" : String(params.selectedFilesCount),
          "workspace core files",
        )}
        ${renderAgentCommandMetric(
          "Skills",
          params.selectedSkillCount == null ? "Pending" : String(params.selectedSkillCount),
          "agent skill report",
        )}
        ${renderAgentCommandMetric(
          "Live Tools",
          params.liveToolCount == null ? "Switch Chat" : String(params.liveToolCount),
          "available now",
        )}
        ${renderAgentCommandMetric(
          "Cron",
          params.cronJobCount == null ? "Load" : String(params.cronJobCount),
          "assigned jobs",
        )}
        ${renderAgentCommandMetric(
          "Channels",
          params.channelEntryCount == null ? "Load" : String(params.channelEntryCount),
          "connected surfaces",
        )}
        ${renderAgentCommandMetric(
          "Config",
          configState,
          selected?.isDefault ? "default agent" : "agent override capable",
          params.props.config.dirty ? "warn" : null,
        )}
      </div>
    </section>
  `;
}

function renderAgentCommandMetric(
  label: string,
  value: string,
  note: string,
  tone: "ok" | "warn" | null = null,
) {
  return html`
    <div class="agents-command-metric ${tone ? `is-${tone}` : ""}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </div>
  `;
}

function renderAgentRoster(agentViews: AgentView[], onSelectAgent: (agentId: string) => void) {
  if (agentViews.length === 0) {
    return nothing;
  }
  return html`
    <section class="agents-roster">
      <div class="agents-roster__header">
        <div>
          <div class="card-title">Agent Fleet</div>
          <div class="card-sub">
            Switch between isolated workspaces, identities, and routing targets.
          </div>
        </div>
      </div>
      <div class="agent-list agent-list--deck">
        ${agentViews.map(
          (view) => html`
            <button
              type="button"
              class="agent-row agent-row--deck ${view.selected ? "active" : ""}"
              style=${`--agent-hue: ${view.hue};`}
              @click=${() => onSelectAgent(view.agent.id)}
            >
              ${renderAgentAvatar(view)}
              <span class="agent-info">
                <span class="agent-title">${view.label}</span>
                <span class="agent-sub mono">${view.agent.id}</span>
                <span class="agent-sub">${view.context.workspace}</span>
              </span>
              <span class="agent-row__meta">
                ${view.isDefault ? html`<span class="agent-pill">default</span>` : nothing}
                <span class="agent-pill">${view.context.skillsLabel}</span>
              </span>
            </button>
          `,
        )}
      </div>
    </section>
  `;
}

function renderAgentTabs(
  active: AgentsPanel,
  onSelect: (panel: AgentsPanel) => void,
  counts: Record<string, number | null>,
) {
  const tabs: Array<{ id: AgentsPanel; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "files", label: "Files" },
    { id: "tools", label: "Tools" },
    { id: "skills", label: "Skills" },
    { id: "channels", label: "Channels" },
    { id: "cron", label: "Cron Jobs" },
  ];
  return html`
    <div class="agent-tabs">
      ${tabs.map(
        (tab) => html`
          <button
            class="agent-tab ${active === tab.id ? "active" : ""}"
            type="button"
            @click=${() => onSelect(tab.id)}
          >
            ${tab.label}${counts[tab.id] != null
              ? html`<span class="agent-tab-count">${counts[tab.id]}</span>`
              : nothing}
          </button>
        `,
      )}
    </div>
  `;
}
