import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
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
  detailOpen: boolean;
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
  onOpenDetails: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
  onNavigate: (tab: string) => void;
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

export function renderAgents(props: AgentsProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (agents.find((agent) => agent.id === selectedId) ?? null)
    : null;
  const selectedIdentity = selectedAgent
    ? (props.agentIdentityById[selectedAgent.id] ?? null)
    : null;
  const selectedContext = selectedAgent
    ? buildAgentContext(
        selectedAgent,
        props.config.form,
        props.agentFiles.list,
        defaultId,
        selectedIdentity,
      )
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
  const tabCounts: Record<string, number | null> = {
    files: props.agentFiles.list?.files?.length ?? null,
    skills: selectedSkillCount,
    channels: channelEntryCount,
    cron: cronJobCount || null,
  };

  return html`
    <div class="agents-layout">
      <section class="agents-main">
        ${renderAgentProfiles({
          agents,
          selectedId,
          defaultId,
          configForm: props.config.form,
          agentFilesList: props.agentFiles.list,
          agentIdentityById: props.agentIdentityById,
          loading: props.loading,
          error: props.error,
          runtimeSessionMatchesSelectedAgent: props.runtimeSessionMatchesSelectedAgent,
          onRefresh: props.onRefresh,
          onSelectAgent: props.onSelectAgent,
          onOpenDetails: props.onOpenDetails,
          onDeleteAgent: props.onDeleteAgent,
        })}
        ${!selectedAgent
          ? html`
              <div class="card">
                <div class="card-title">Select an agent</div>
                <div class="card-sub">Pick an agent to inspect its workspace and tools.</div>
              </div>
            `
          : !props.detailOpen
            ? nothing
            : html`
                ${renderAgentStickyHeader({
                  agent: selectedAgent,
                  context: selectedContext,
                  defaultId,
                  identity: selectedIdentity,
                  runtimeSessionMatchesSelectedAgent: props.runtimeSessionMatchesSelectedAgent,
                  onSelectPanel: props.onSelectPanel,
                  onSetDefault: props.onSetDefault,
                  onRefresh: props.onRefresh,
                })}
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
                      configForm: props.config.form,
                      snapshot: props.channels.snapshot,
                      loading: props.channels.loading,
                      error: props.channels.error,
                      lastSuccess: props.channels.lastSuccess,
                      onRefresh: props.onChannelsRefresh,
                      onAddChannel: () => props.onNavigate("channels"),
                    })
                  : nothing}
                ${props.activePanel === "cron"
                  ? renderAgentCron({
                      agentId: selectedAgent.id,
                      jobs: props.cron.jobs,
                      status: props.cron.status,
                      loading: props.cron.loading,
                      error: props.cron.error,
                      onRefresh: props.onCronRefresh,
                      onRunNow: props.onCronRunNow,
                      onScheduleJob: () => props.onNavigate("cron"),
                    })
                  : nothing}
              `}
      </section>
    </div>
  `;
}

function renderAgentProfiles(params: {
  agents: AgentsListResult["agents"];
  selectedId: string | null;
  defaultId: string | null;
  configForm: Record<string, unknown> | null;
  agentFilesList: AgentsFilesListResult | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  loading: boolean;
  error: string | null;
  runtimeSessionMatchesSelectedAgent: boolean;
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onOpenDetails: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
}) {
  return html`
    <section class="agent-profiles-card">
      <div class="agent-profiles-card__header">
        <div>
          <div class="card-title">Agent profiles</div>
          <div class="card-sub">
            Choose a profile to inspect workspace, tools, skills, and jobs.
          </div>
        </div>
        <button
          class="btn btn--sm agents-refresh-btn"
          ?disabled=${params.loading}
          @click=${params.onRefresh}
        >
          ${params.loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>
      ${params.error ? html`<div class="callout danger">${params.error}</div>` : nothing}
      ${params.agents.length === 0
        ? html`
            <div class="agent-profiles-empty">
              <div class="card-title">No agent profiles</div>
              <div class="card-sub">Create an agent profile to manage its workspace and tools.</div>
            </div>
          `
        : html`
            <div class="agent-profile-grid">
              ${params.agents.map((agent) => {
                const identity = params.agentIdentityById[agent.id] ?? null;
                const context = buildAgentContext(
                  agent,
                  params.configForm,
                  params.agentFilesList,
                  params.defaultId,
                  identity,
                );
                const selected = agent.id === params.selectedId;
                const active = selected && params.runtimeSessionMatchesSelectedAgent;
                const isDefault = Boolean(params.defaultId && agent.id === params.defaultId);
                const deleteDisabled = agent.id === "main" || isDefault;
                return html`
                  <article
                    class="agent-profile-card ${selected ? "is-selected" : ""}"
                    @click=${() => params.onSelectAgent(agent.id)}
                    aria-current=${selected ? "true" : "false"}
                  >
                    <div class="agent-profile-card__top">
                      ${renderAgentAvatar({ agent, identity })}
                      <span class="agent-profile-card__state">
                        <span class="agent-status-dot ${active ? "is-active" : ""}"></span>
                        ${active ? "Active" : "Idle"}
                      </span>
                    </div>
                    <div class="agent-profile-card__body">
                      <div class="agent-profile-card__name">${context.identityName}</div>
                      <div class="agent-profile-card__id mono">${agent.id}</div>
                    </div>
                    <div class="agent-profile-card__meta">
                      <span>${context.model || "-"}</span>
                      <span>${context.skillsLabel}</span>
                    </div>
                    <div class="agent-profile-card__footer">
                      <span class="agent-profile-card__workspace">${context.workspace}</span>
                      ${agentBadgeText(agent.id, params.defaultId)
                        ? html`<span class="agent-pill"
                            >${agentBadgeText(agent.id, params.defaultId)}</span
                          >`
                        : nothing}
                    </div>
                    <div class="agent-profile-card__actions">
                      <button
                        class="btn btn--sm btn--ghost"
                        type="button"
                        @click=${(event: Event) => {
                          event.stopPropagation();
                          void navigator.clipboard.writeText(agent.id);
                        }}
                      >
                        Copy ID
                      </button>
                      <button
                        class="btn btn--sm btn--ghost"
                        type="button"
                        ?disabled=${deleteDisabled}
                        title=${deleteDisabled
                          ? "Default and main agents cannot be deleted here."
                          : "Delete this agent"}
                        @click=${(event: Event) => {
                          event.stopPropagation();
                          params.onDeleteAgent(agent.id);
                        }}
                      >
                        Delete
                      </button>
                      <button
                        class="btn btn--sm primary"
                        type="button"
                        @click=${(event: Event) => {
                          event.stopPropagation();
                          params.onOpenDetails(agent.id);
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </article>
                `;
              })}
            </div>
          `}
    </section>
  `;
}

function renderAgentAvatar(params: {
  agent: AgentsListResult["agents"][number];
  identity: AgentIdentityResult | null;
}) {
  const avatarUrl = resolveAgentAvatarUrl(params.agent, params.identity);
  const emoji = resolveAgentEmoji(params.agent, params.identity);
  const label = normalizeAgentLabel(params.agent);
  const fallback = emoji || label.slice(0, 1).toUpperCase() || params.agent.id.slice(0, 1);
  return html`
    <span class="agent-avatar agent-avatar--lg">
      ${avatarUrl
        ? html`<img src=${avatarUrl} alt="" />`
        : html`<span aria-hidden="true">${fallback}</span>`}
    </span>
  `;
}

function renderAgentStickyHeader(params: {
  agent: AgentsListResult["agents"][number];
  context: ReturnType<typeof buildAgentContext> | null;
  defaultId: string | null;
  identity: AgentIdentityResult | null;
  runtimeSessionMatchesSelectedAgent: boolean;
  onSelectPanel: (panel: AgentsPanel) => void;
  onSetDefault: (agentId: string) => void;
  onRefresh: () => void;
}) {
  const name = params.context?.identityName || normalizeAgentLabel(params.agent);
  const status = params.runtimeSessionMatchesSelectedAgent ? "Active" : "Idle";
  const model = params.context?.model || "-";
  const workspace = params.context?.workspace || params.agent.workspace || "default";
  const isDefault = Boolean(params.defaultId && params.agent.id === params.defaultId);
  return html`
    <section class="agent-sticky-header">
      ${renderAgentAvatar({
        agent: params.agent,
        identity: params.identity,
      })}
      <div class="agent-sticky-header__main">
        <div class="agent-sticky-header__title-row">
          <span class="agent-sticky-header__title">${name}</span>
          <span class="agent-pill">${params.agent.id}</span>
          ${isDefault ? html`<span class="agent-pill">Default</span>` : nothing}
        </div>
        <div class="agent-sticky-header__meta">
          <span
            class="agent-status-dot ${params.runtimeSessionMatchesSelectedAgent ? "is-active" : ""}"
          ></span>
          <span>${status}</span>
          <span aria-hidden="true">·</span>
          <span class="mono">${model}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            class="workspace-link workspace-link--button"
            @click=${() => params.onSelectPanel("files")}
            title="Open workspace files"
          >
            ${workspace}
          </button>
        </div>
      </div>
      <div class="agent-sticky-header__actions">
        <button
          type="button"
          class="btn btn--sm btn--ghost"
          @click=${() => void navigator.clipboard.writeText(params.agent.id)}
        >
          Copy ID
        </button>
        <button
          type="button"
          class="btn btn--sm btn--ghost"
          ?disabled=${isDefault}
          @click=${() => params.onSetDefault(params.agent.id)}
        >
          ${isDefault ? "Default" : "Set Default"}
        </button>
        <button type="button" class="btn btn--sm" @click=${params.onRefresh}>Refresh</button>
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
