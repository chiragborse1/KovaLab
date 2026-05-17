import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ModelCatalogEntry,
} from "../types.ts";
import {
  buildModelOptions,
  normalizeAgentLabel,
  normalizeModelValue,
  parseFallbackList,
  resolveAgentConfig,
  resolveModelFallbacks,
  resolveModelLabel,
  resolveModelPrimary,
} from "./agents-utils.ts";
import type { AgentsPanel } from "./agents.types.ts";

export function renderAgentOverview(params: {
  agent: AgentsListResult["agents"][number];
  basePath: string;
  defaultId: string | null;
  configForm: Record<string, unknown> | null;
  agentFilesList: AgentsFilesListResult | null;
  agentIdentity: AgentIdentityResult | null;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  modelCatalog: ModelCatalogEntry[];
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
}) {
  const {
    agent,
    configForm,
    agentFilesList,
    configLoading,
    configSaving,
    configDirty,
    onConfigReload,
    onConfigSave,
    onModelChange,
    onModelFallbacksChange,
    onSelectPanel,
  } = params;
  const config = resolveAgentConfig(configForm, agent.id);
  const agentModel = agent.model;
  const workspaceFromFiles =
    agentFilesList && agentFilesList.agentId === agent.id ? agentFilesList.workspace : null;
  const workspace =
    workspaceFromFiles ||
    config.entry?.workspace ||
    config.defaults?.workspace ||
    agent.workspace ||
    "default";
  const model = config.entry?.model
    ? resolveModelLabel(config.entry?.model)
    : config.defaults?.model
      ? resolveModelLabel(config.defaults?.model)
      : resolveModelLabel(agentModel);
  const defaultModel = resolveModelLabel(config.defaults?.model ?? agentModel);
  const entryPrimary = resolveModelPrimary(config.entry?.model);
  const defaultPrimary =
    resolveModelPrimary(config.defaults?.model) ||
    (defaultModel !== "-" ? normalizeModelValue(defaultModel) : null) ||
    (configForm ? null : resolveModelPrimary(agentModel));
  const effectivePrimary = entryPrimary ?? defaultPrimary ?? null;
  const modelFallbacks =
    resolveModelFallbacks(config.entry?.model) ??
    resolveModelFallbacks(config.defaults?.model) ??
    (configForm ? null : resolveModelFallbacks(agentModel));
  const fallbackChips = modelFallbacks ?? [];
  const skillFilter = Array.isArray(config.entry?.skills) ? config.entry?.skills : null;
  const skillCount = skillFilter?.length ?? null;
  const isDefault = Boolean(params.defaultId && agent.id === params.defaultId);
  const disabled = !configForm || configLoading || configSaving;

  const removeChip = (index: number) => {
    const next = fallbackChips.filter((_, i) => i !== index);
    onModelFallbacksChange(agent.id, next);
  };

  const handleChipKeydown = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const parsed = parseFallbackList(input.value);
      if (parsed.length > 0) {
        onModelFallbacksChange(agent.id, [...fallbackChips, ...parsed]);
        input.value = "";
      }
    }
  };

  return html`
    <section class="agent-overview-console">
      <div class="agent-overview-summary card">
        <div class="agent-overview-hero__main">
          <div class="agents-eyebrow">Overview</div>
          <h3>${params.agentIdentity?.name ?? normalizeAgentLabel(agent)}</h3>
          <p>
            ${params.agentIdentityLoading
              ? "Resolving runtime identity…"
              : params.agentIdentityError
                ? params.agentIdentityError
                : "Identity, model, workspace, and skill configuration for the selected agent."}
          </p>
        </div>
        <div class="agent-overview-status-grid">
          ${renderOverviewMetric("Default", isDefault ? "Yes" : "No", agent.id)}
          ${renderOverviewMetric("Model", model, defaultModel)}
          ${renderOverviewMetric(
            "Skills",
            skillFilter ? `${skillCount} selected` : "All",
            "visibility filter",
          )}
          ${renderOverviewMetric("Config", configDirty ? "Unsaved" : "Synced", "gateway config")}
        </div>
      </div>

      ${configDirty
        ? html`<div class="callout warn">You have unsaved agent config changes.</div>`
        : nothing}

      <div class="agent-overview-systems">
        <section class="card agent-system-card agent-system-card--workspace">
          <div class="agent-system-card__head">
            <div>
              <div class="card-title">Workspace</div>
              <div class="card-sub">Files, identity, user profile, and local context.</div>
            </div>
            <button class="btn btn--sm" type="button" @click=${() => onSelectPanel("files")}>
              Open Files
            </button>
          </div>
          <button
            type="button"
            class="agent-workspace-path mono"
            @click=${() => onSelectPanel("files")}
            title="Open Files tab"
          >
            ${workspace}
          </button>
          <div class="agent-system-strip">
            <span>AGENTS.md</span>
            <span>SOUL.md</span>
            <span>IDENTITY.md</span>
            <span>USER.md</span>
          </div>
        </section>

        <section class="card agent-system-card agent-system-card--model">
          <div class="agent-system-card__head">
            <div>
              <div class="card-title">Model</div>
              <div class="card-sub">Primary model and fallback order for this agent.</div>
            </div>
            <div class="agent-model-actions">
              <button
                type="button"
                class="btn btn--sm"
                ?disabled=${configLoading}
                @click=${onConfigReload}
              >
                ${t("common.reloadConfig")}
              </button>
              <button
                type="button"
                class="btn btn--sm primary"
                ?disabled=${configSaving || !configDirty}
                @click=${onConfigSave}
              >
                ${configSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          <div class="agent-model-control-grid">
            <label class="field">
              <span>Primary model${isDefault ? " (default)" : ""}</span>
              <select
                .value=${isDefault ? (effectivePrimary ?? "") : (entryPrimary ?? "")}
                ?disabled=${disabled}
                @change=${(e: Event) =>
                  onModelChange(agent.id, (e.target as HTMLSelectElement).value || null)}
              >
                ${isDefault
                  ? html` <option value="">Not set</option> `
                  : html`
                      <option value="">
                        ${defaultPrimary
                          ? `Inherit default (${defaultPrimary})`
                          : "Inherit default"}
                      </option>
                    `}
                ${buildModelOptions(configForm, effectivePrimary ?? undefined, params.modelCatalog)}
              </select>
            </label>
            <div class="field">
              <span>Fallbacks</span>
              <div
                class="agent-chip-input agent-chip-input--fallbacks"
                @click=${(e: Event) => {
                  const container = e.currentTarget as HTMLElement;
                  const input = container.querySelector("input");
                  if (input) {
                    input.focus();
                  }
                }}
              >
                ${fallbackChips.map(
                  (chip, i) => html`
                    <span class="chip">
                      ${chip}
                      <button
                        type="button"
                        class="chip-remove"
                        ?disabled=${disabled}
                        @click=${() => removeChip(i)}
                      >
                        &times;
                      </button>
                    </span>
                  `,
                )}
                <input
                  ?disabled=${disabled}
                  placeholder=${fallbackChips.length === 0 ? "provider/model" : ""}
                  @keydown=${handleChipKeydown}
                  @blur=${(e: Event) => {
                    const input = e.target as HTMLInputElement;
                    const parsed = parseFallbackList(input.value);
                    if (parsed.length > 0) {
                      onModelFallbacksChange(agent.id, [...fallbackChips, ...parsed]);
                      input.value = "";
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderOverviewMetric(label: string, value: string, note: string) {
  return html`
    <div class="agent-overview-metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </div>
  `;
}
