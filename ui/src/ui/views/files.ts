import { html, nothing } from "lit";
import type { AgentsFilesListResult, AgentsListResult } from "../types.ts";
import { renderAgentFiles } from "./agents-panels-status-files.ts";
import { normalizeAgentLabel } from "./agents-utils.ts";

export type FilesProps = {
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  agentFiles: {
    list: AgentsFilesListResult | null;
    loading: boolean;
    error: string | null;
    active: string | null;
    contents: Record<string, string>;
    drafts: Record<string, string>;
    saving: boolean;
  };
  onRefreshAgents: () => void;
  onSelectAgent: (agentId: string) => void;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
};

export function renderFiles(props: FilesProps) {
  const agents = props.agentsList?.agents ?? [];
  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;

  return html`
    <div class="agents-layout">
      <section class="agents-toolbar">
        <div class="agents-toolbar-row">
          <div class="agents-control-select">
            <select
              class="agents-select"
              .value=${selectedId ?? ""}
              ?disabled=${props.loading || agents.length === 0}
              @change=${(e: Event) => props.onSelectAgent((e.target as HTMLSelectElement).value)}
            >
              ${agents.length === 0
                ? html`<option value="">No agents</option>`
                : agents.map(
                    (agent) => html`
                      <option value=${agent.id} ?selected=${agent.id === selectedId}>
                        ${normalizeAgentLabel(agent)}${agent.id === defaultId ? " (default)" : ""}
                      </option>
                    `,
                  )}
            </select>
          </div>
          <div class="agents-toolbar-actions">
            <button class="btn btn--sm" ?disabled=${props.loading} @click=${props.onRefreshAgents}>
              ${props.loading ? "Refreshing..." : "Refresh agents"}
            </button>
            ${selectedId
              ? html`
                  <button
                    class="btn btn--sm btn--ghost"
                    ?disabled=${props.agentFiles.loading}
                    @click=${() => props.onLoadFiles(selectedId)}
                  >
                    ${props.agentFiles.loading ? "Loading..." : "Load files"}
                  </button>
                `
              : nothing}
          </div>
        </div>
        ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}
      </section>

      ${selectedId
        ? renderAgentFiles({
            agentId: selectedId,
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
        : html`
            <section class="card">
              <div class="card-title">No agent selected</div>
              <div class="card-sub">Create or load an agent before editing workspace files.</div>
            </section>
          `}
    </div>
  `;
}
