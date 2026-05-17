import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { PERSONA_WORKSPACE_FILE_NAMES } from "../agent-persona-files.ts";
import { icons } from "../icons.ts";
import type {
  AgentFileEntry,
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
} from "../types.ts";
import {
  agentAvatarHue,
  formatBytes,
  normalizeAgentLabel,
  resolveAgentAvatarUrl,
  resolveAgentEmoji,
} from "./agents-utils.ts";

const IDENTITY_FILE = "IDENTITY.md";
const SOUL_FILE = "SOUL.md";
const USER_FILE = "USER.md";

const IDENTITY_FIELDS = [
  {
    label: "Name",
    placeholder: "Kova",
  },
  {
    label: "Creature",
    placeholder: "assistant, operator, companion",
  },
  {
    label: "Vibe",
    placeholder: "calm, direct, practical",
  },
  {
    label: "Emoji",
    placeholder: ":unicorn:",
  },
  {
    label: "Avatar",
    placeholder: "avatars/kova.png or https://...",
  },
] as const;

type PersonaFileState = {
  entry: AgentFileEntry | null;
  loaded: boolean;
  base: string;
  draft: string;
  dirty: boolean;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeIdentityFieldValue(value: string) {
  const normalized = value.trim();
  if (/^_\(.*\)_$/u.test(normalized)) {
    return "";
  }
  return normalized;
}

function readIdentityField(content: string, label: string) {
  const fieldPattern = new RegExp(`^\\s*-\\s*\\*\\*${escapeRegExp(label)}:\\*\\*\\s*(.*)$`, "imu");
  const match = fieldPattern.exec(content);
  return normalizeIdentityFieldValue(match?.[1] ?? "");
}

function ensureIdentityDraft(content: string) {
  if (content.trim()) {
    return content;
  }
  return [
    "# IDENTITY.md - Who Am I?",
    "",
    "- **Name:**",
    "- **Creature:**",
    "- **Vibe:**",
    "- **Emoji:**",
    "- **Avatar:**",
    "",
  ].join("\n");
}

function updateIdentityField(content: string, label: string, value: string) {
  const draft = ensureIdentityDraft(content);
  const replacement = `- **${label}:** ${value.trim()}`;
  const fieldPattern = new RegExp(`^(\\s*-\\s*\\*\\*${escapeRegExp(label)}:\\*\\*).*$`, "imu");
  if (fieldPattern.test(draft)) {
    return draft.replace(fieldPattern, replacement);
  }
  const lines = draft.replace(/\s*$/u, "").split(/\r?\n/u);
  const firstListIndex = lines.findIndex((line) => /^\s*-\s+\*\*.*:\*\*/u.test(line));
  if (firstListIndex >= 0) {
    lines.splice(firstListIndex + 1, 0, replacement);
  } else {
    lines.push("", replacement);
  }
  return `${lines.join("\n")}\n`;
}

function resolvePersonaFileState(
  list: AgentsFilesListResult | null,
  contents: Record<string, string>,
  drafts: Record<string, string>,
  name: string,
): PersonaFileState {
  const entry = list?.files.find((file) => file.name === name) ?? null;
  const loaded = Object.hasOwn(contents, name);
  const base = loaded ? (contents[name] ?? "") : "";
  const draft = Object.hasOwn(drafts, name) ? (drafts[name] ?? "") : base;
  return {
    entry,
    loaded,
    base,
    draft,
    dirty: loaded && draft !== base,
  };
}

function renderPersonaFileBadge(label: string, state: PersonaFileState) {
  const sizeLabel = state.entry?.missing
    ? "missing"
    : state.entry?.size != null
      ? formatBytes(state.entry.size)
      : "unknown";
  const status = state.dirty ? "draft" : state.loaded ? "loaded" : sizeLabel;
  return html`
    <div class="agent-persona-file-badge ${state.dirty ? "is-dirty" : ""}">
      <span>${label}</span>
      <strong>${status}</strong>
    </div>
  `;
}

function renderPersonaEditor(params: {
  title: string;
  eyebrow: string;
  description: string;
  fileName: string;
  state: PersonaFileState;
  placeholder: string;
  loading: boolean;
  saving: boolean;
  onDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onOpenFile: (name: string) => void;
}) {
  return html`
    <article class="card agent-persona-editor">
      <div class="agent-system-card__head">
        <div>
          <div class="agents-eyebrow">${params.eyebrow}</div>
          <div class="card-title">${params.title}</div>
          <div class="card-sub">${params.description}</div>
        </div>
        ${renderPersonaFileBadge(params.fileName, params.state)}
      </div>
      ${params.state.entry?.missing
        ? html`<div class="callout info">Saving creates ${params.fileName} in this workspace.</div>`
        : nothing}
      <label class="field agent-persona-markdown-field">
        <span>${params.fileName}</span>
        <textarea
          class="agent-persona-textarea"
          .value=${params.state.loaded ? params.state.draft : ""}
          placeholder=${params.placeholder}
          ?disabled=${params.loading || !params.state.loaded}
          @input=${(e: Event) =>
            params.onDraftChange(params.fileName, (e.target as HTMLTextAreaElement).value)}
        ></textarea>
      </label>
      <div class="agent-persona-actions">
        <button
          type="button"
          class="btn btn--sm btn--ghost"
          @click=${() => params.onOpenFile(params.fileName)}
        >
          ${icons.fileText} Open File
        </button>
        <button
          type="button"
          class="btn btn--sm"
          ?disabled=${!params.state.dirty}
          @click=${() => params.onFileReset(params.fileName)}
        >
          Reset
        </button>
        <button
          type="button"
          class="btn btn--sm primary"
          ?disabled=${params.saving || !params.state.dirty}
          @click=${() => params.onFileSave(params.fileName)}
        >
          ${params.saving ? "Saving..." : "Save"}
        </button>
      </div>
    </article>
  `;
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

function renderPersonaAgentAvatar(params: {
  agentId: string;
  label: string;
  avatarUrl: string | null;
  emoji: string;
}) {
  const initials = resolveAgentInitials(params.label, params.agentId);
  return html`
    <span
      class="agent-avatar agent-avatar--lg agent-avatar--reactor"
      style=${`--agent-hue: ${agentAvatarHue(params.agentId)};`}
      aria-hidden="true"
    >
      ${params.avatarUrl
        ? html`<img src=${params.avatarUrl} alt="" />`
        : params.emoji
          ? html`<span>${params.emoji}</span>`
          : html`<span>${initials}</span>`}
    </span>
  `;
}

export function renderPersonaPage(params: {
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentFilesList: AgentsFilesListResult | null;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onLoadPersonaFiles: (agentId: string) => void;
  onOpenFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onNavigateAgents: () => void;
}) {
  const agents = params.agentsList?.agents ?? [];
  const requestedId =
    params.selectedAgentId ?? params.agentsList?.defaultId ?? params.agentsList?.agents?.[0]?.id;
  const selectedAgent = requestedId
    ? (agents.find((agent) => agent.id === requestedId) ?? null)
    : null;
  const selectedId = selectedAgent?.id ?? null;
  const identity = selectedId ? (params.agentIdentityById[selectedId] ?? null) : null;
  const label = selectedAgent
    ? identity?.name?.trim() || normalizeAgentLabel(selectedAgent)
    : "No agent selected";
  const avatarUrl = selectedAgent ? resolveAgentAvatarUrl(selectedAgent, identity) : null;
  const emoji = selectedAgent ? resolveAgentEmoji(selectedAgent, identity) : "";
  const agentCount = agents.length;

  return html`
    <div class="persona-page">
      <section class="card persona-page-toolbar">
        <div class="persona-page-agent">
          ${selectedAgent && selectedId
            ? renderPersonaAgentAvatar({
                agentId: selectedId,
                label,
                avatarUrl,
                emoji,
              })
            : html`<span class="agent-avatar agent-avatar--lg" aria-hidden="true"
                >${icons.brain}</span
              >`}
          <div class="persona-page-title">
            <div class="agents-eyebrow">Persona workspace</div>
            <div class="card-title">${label}</div>
            <div class="card-sub">
              ${selectedAgent && selectedId
                ? html`<span class="mono">${selectedId}</span>`
                : "Select an agent before editing persona files."}
            </div>
          </div>
        </div>
        <div class="persona-page-actions">
          <select
            class="agents-select"
            aria-label="Select persona agent"
            ?disabled=${params.loading || agentCount === 0}
            .value=${selectedId ?? ""}
            @change=${(event: Event) =>
              params.onSelectAgent((event.target as HTMLSelectElement).value)}
          >
            ${agents.map(
              (agent) => html`
                <option value=${agent.id} ?selected=${agent.id === selectedId}>
                  ${params.agentIdentityById[agent.id]?.name?.trim() || normalizeAgentLabel(agent)}
                </option>
              `,
            )}
          </select>
          <button
            type="button"
            class="btn btn--sm"
            ?disabled=${params.loading || params.agentFilesLoading}
            @click=${params.onRefresh}
          >
            ${params.loading || params.agentFilesLoading
              ? t("common.loading")
              : t("common.refresh")}
          </button>
          <button type="button" class="btn btn--sm btn--ghost" @click=${params.onNavigateAgents}>
            Manage Agents
          </button>
        </div>
      </section>
      ${params.error ? html`<div class="callout danger">${params.error}</div>` : nothing}
      ${params.agentIdentityError
        ? html`<div class="callout danger">${params.agentIdentityError}</div>`
        : nothing}
      ${params.agentIdentityLoading && selectedAgent
        ? html`<div class="callout info">Loading identity details.</div>`
        : nothing}
      ${!selectedAgent
        ? html`
            <section class="card agent-persona-load-state">
              <strong>${params.loading ? "Loading agents" : "No agent selected"}</strong>
              <span>Persona files are scoped to a single agent workspace.</span>
            </section>
          `
        : renderAgentPersona({
            agentId: selectedAgent.id,
            agentFilesList: params.agentFilesList,
            agentFilesLoading: params.agentFilesLoading,
            agentFilesError: params.agentFilesError,
            agentFileContents: params.agentFileContents,
            agentFileDrafts: params.agentFileDrafts,
            agentFileSaving: params.agentFileSaving,
            showHero: false,
            onLoadPersonaFiles: params.onLoadPersonaFiles,
            onOpenFile: params.onOpenFile,
            onFileDraftChange: params.onFileDraftChange,
            onFileReset: params.onFileReset,
            onFileSave: params.onFileSave,
          })}
    </div>
  `;
}

export function renderAgentPersona(params: {
  agentId: string;
  agentFilesList: AgentsFilesListResult | null;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  showHero?: boolean;
  onLoadPersonaFiles: (agentId: string) => void;
  onOpenFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
}) {
  const list = params.agentFilesList?.agentId === params.agentId ? params.agentFilesList : null;
  const identity = resolvePersonaFileState(
    list,
    params.agentFileContents,
    params.agentFileDrafts,
    IDENTITY_FILE,
  );
  const soul = resolvePersonaFileState(
    list,
    params.agentFileContents,
    params.agentFileDrafts,
    SOUL_FILE,
  );
  const user = resolvePersonaFileState(
    list,
    params.agentFileContents,
    params.agentFileDrafts,
    USER_FILE,
  );
  const loadedCount = PERSONA_WORKSPACE_FILE_NAMES.filter((name) =>
    Object.hasOwn(params.agentFileContents, name),
  ).length;
  const bootstrapEntry = list?.files.find((file) => file.name === "BOOTSTRAP.md") ?? null;
  const bootstrapPending = Boolean(bootstrapEntry && !bootstrapEntry.missing);
  const bootstrapLabel = !list
    ? "bootstrap unknown"
    : bootstrapPending
      ? "bootstrap pending"
      : "bootstrap complete";
  const allLoaded = loadedCount === PERSONA_WORKSPACE_FILE_NAMES.length;

  return html`
    <section class="agent-persona-console">
      ${params.showHero === false
        ? nothing
        : html`
            <section class="card agent-persona-hero">
              <div>
                <div class="agents-eyebrow">Persona setup</div>
                <div class="card-title">Persona</div>
                <div class="card-sub">
                  Edit the agent identity, voice, boundaries, and user context used during runs.
                </div>
              </div>
              <div class="agent-persona-hero__actions">
                <span class="agent-pill ${bootstrapPending ? "warn" : ""}">
                  ${bootstrapLabel}
                </span>
                <button
                  type="button"
                  class="btn btn--sm"
                  ?disabled=${params.agentFilesLoading}
                  @click=${() => params.onLoadPersonaFiles(params.agentId)}
                >
                  ${params.agentFilesLoading
                    ? t("common.loading")
                    : allLoaded
                      ? t("common.refresh")
                      : "Load Persona"}
                </button>
              </div>
            </section>
          `}
      ${list
        ? html`
            <div class="agent-files-workspace mono">
              <span>Workspace</span>
              <strong>${list.workspace}</strong>
            </div>
          `
        : nothing}
      ${params.agentFilesError
        ? html`<div class="callout danger">${params.agentFilesError}</div>`
        : nothing}
      ${!allLoaded
        ? html`
            <section class="card agent-persona-load-state">
              <strong
                >${params.agentFilesLoading
                  ? "Loading persona files"
                  : "Persona files not loaded"}</strong
              >
              <span
                >${loadedCount}/${PERSONA_WORKSPACE_FILE_NAMES.length} persona files loaded.</span
              >
            </section>
          `
        : nothing}
      ${allLoaded
        ? html`
            <section class="agent-persona-grid">
              <article class="card agent-persona-identity">
                <div class="agent-system-card__head">
                  <div>
                    <div class="agents-eyebrow">Identity</div>
                    <div class="card-title">Agent Basics</div>
                    <div class="card-sub">These values mirror the bootstrap identity fields.</div>
                  </div>
                  ${renderPersonaFileBadge(IDENTITY_FILE, identity)}
                </div>
                ${identity.entry?.missing
                  ? html`<div class="callout info">
                      Saving creates ${IDENTITY_FILE} in this workspace.
                    </div>`
                  : nothing}
                <div class="agent-persona-fields">
                  ${IDENTITY_FIELDS.map(
                    (field) => html`
                      <label class="field agent-persona-field">
                        <span>${field.label}</span>
                        <input
                          .value=${identity.loaded
                            ? readIdentityField(identity.draft, field.label)
                            : ""}
                          placeholder=${field.placeholder}
                          ?disabled=${params.agentFilesLoading || !identity.loaded}
                          @input=${(e: Event) =>
                            params.onFileDraftChange(
                              IDENTITY_FILE,
                              updateIdentityField(
                                identity.draft,
                                field.label,
                                (e.target as HTMLInputElement).value,
                              ),
                            )}
                        />
                      </label>
                    `,
                  )}
                </div>
                <details class="agent-persona-raw">
                  <summary>Raw identity markdown</summary>
                  <textarea
                    class="agent-persona-textarea agent-persona-textarea--compact"
                    .value=${identity.loaded ? identity.draft : ""}
                    ?disabled=${params.agentFilesLoading || !identity.loaded}
                    @input=${(e: Event) =>
                      params.onFileDraftChange(
                        IDENTITY_FILE,
                        (e.target as HTMLTextAreaElement).value,
                      )}
                  ></textarea>
                </details>
                <div class="agent-persona-actions">
                  <button
                    type="button"
                    class="btn btn--sm btn--ghost"
                    @click=${() => params.onOpenFile(IDENTITY_FILE)}
                  >
                    ${icons.fileText} Open File
                  </button>
                  <button
                    type="button"
                    class="btn btn--sm"
                    ?disabled=${!identity.dirty}
                    @click=${() => params.onFileReset(IDENTITY_FILE)}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    class="btn btn--sm primary"
                    ?disabled=${params.agentFileSaving || !identity.dirty}
                    @click=${() => params.onFileSave(IDENTITY_FILE)}
                  >
                    ${params.agentFileSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </article>
              ${renderPersonaEditor({
                title: "Voice And Boundaries",
                eyebrow: "Soul",
                description:
                  "Tone, principles, behavior boundaries, and long-term operating style.",
                fileName: SOUL_FILE,
                state: soul,
                placeholder: "Describe how this agent should speak, decide, and behave.",
                loading: params.agentFilesLoading,
                saving: params.agentFileSaving,
                onDraftChange: params.onFileDraftChange,
                onFileReset: params.onFileReset,
                onFileSave: params.onFileSave,
                onOpenFile: params.onOpenFile,
              })}
              ${renderPersonaEditor({
                title: "User Context",
                eyebrow: "User",
                description: "Preferred name, timezone, working style, and persistent user notes.",
                fileName: USER_FILE,
                state: user,
                placeholder: "Capture stable user preferences and context.",
                loading: params.agentFilesLoading,
                saving: params.agentFileSaving,
                onDraftChange: params.onFileDraftChange,
                onFileReset: params.onFileReset,
                onFileSave: params.onFileSave,
                onOpenFile: params.onOpenFile,
              })}
            </section>
          `
        : nothing}
    </section>
  `;
}
