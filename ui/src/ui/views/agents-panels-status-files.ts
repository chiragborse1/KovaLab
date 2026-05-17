import { applyPreviewTheme } from "@create-markdown/preview";
import DOMPurify from "dompurify";
import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { icons } from "../icons.ts";
import {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatNextRun,
} from "../presenter.ts";
import type {
  AgentsFilesListResult,
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
} from "../types.ts";
import { formatBytes, type AgentContext } from "./agents-utils.ts";
import type { AgentsPanel } from "./agents.types.ts";
import { resolveChannelExtras as resolveChannelExtrasFromConfig } from "./channel-config-extras.ts";

function countWords(text: string) {
  const normalized = text.trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}

function countLines(text: string) {
  return text.length === 0 ? 0 : text.split(/\r?\n/).length;
}

function estimateReadingTimeLabel(wordCount: number) {
  if (wordCount <= 0) {
    return "Empty draft";
  }
  return `${Math.max(1, Math.round(wordCount / 220))} min read`;
}

function getExtensionLabel(fileName: string) {
  const ext = fileName.split(".").pop()?.trim().toLowerCase();
  if (ext === "md" || ext === "markdown") {
    return "Markdown Preview";
  }
  return ext ? `${ext.toUpperCase()} Preview` : "Preview";
}

function formatWorkspaceRelativePath(filePath: string, workspace: string | null | undefined) {
  const normalizedPath = filePath.trim();
  const normalizedWorkspace = workspace?.trim();
  if (!normalizedPath) {
    return "";
  }
  if (normalizedWorkspace && normalizedPath === normalizedWorkspace) {
    return ".";
  }
  if (normalizedWorkspace && normalizedPath.startsWith(`${normalizedWorkspace}/`)) {
    return normalizedPath.slice(normalizedWorkspace.length + 1) || ".";
  }
  const pathParts = normalizedPath.split(/[\\/]+/);
  for (let index = pathParts.length - 1; index >= 0; index -= 1) {
    const pathPart = pathParts[index];
    if (pathPart) {
      return pathPart;
    }
  }
  return normalizedPath;
}

function toDomId(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "preview";
}

function setPreviewExpandButtonState(button: Element | null | undefined, isFullscreen: boolean) {
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const label = isFullscreen ? "Collapse preview" : "Expand preview";
  button.classList.toggle("is-fullscreen", isFullscreen);
  button.setAttribute("aria-pressed", String(isFullscreen));
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

function renderAgentContextCard(
  context: AgentContext,
  subtitle: string,
  onSelectPanel: (panel: AgentsPanel) => void,
) {
  return html`
    <section class="card agent-context-matrix">
      <div class="agents-eyebrow">Context</div>
      <div class="card-title">${context.identityName}</div>
      <div class="card-sub">${subtitle}</div>
      <div class="agent-context-matrix__grid">
        ${renderContextCell("Workspace", context.workspace, "files", () => onSelectPanel("files"))}
        ${renderContextCell("Model", context.model)}
        ${renderContextCell("Avatar", context.identityAvatar)}
        ${renderContextCell("Skills", context.skillsLabel)}
        ${renderContextCell("Default", context.isDefault ? "yes" : "no")}
      </div>
    </section>
  `;
}

function renderContextCell(
  label: string,
  value: string,
  actionLabel?: string,
  action?: () => void,
) {
  return html`
    <div class="agent-context-cell">
      <span>${label}</span>
      ${action
        ? html`
            <button class="workspace-link mono" type="button" @click=${action}>${value}</button>
          `
        : html`<strong class="mono">${value}</strong>`}
      ${actionLabel ? html`<small>${actionLabel}</small>` : nothing}
    </div>
  `;
}

type ChannelSummaryEntry = {
  id: string;
  label: string;
  accounts: ChannelAccountSnapshot[];
};

function resolveChannelLabel(snapshot: ChannelsStatusSnapshot, id: string) {
  const meta = snapshot.channelMeta?.find((entry) => entry.id === id);
  if (meta?.label) {
    return meta.label;
  }
  return snapshot.channelLabels?.[id] ?? id;
}

function resolveChannelEntries(snapshot: ChannelsStatusSnapshot | null): ChannelSummaryEntry[] {
  if (!snapshot) {
    return [];
  }
  const ids = new Set<string>();
  for (const id of snapshot.channelOrder ?? []) {
    ids.add(id);
  }
  for (const entry of snapshot.channelMeta ?? []) {
    ids.add(entry.id);
  }
  for (const id of Object.keys(snapshot.channelAccounts ?? {})) {
    ids.add(id);
  }
  const ordered: string[] = [];
  const seed = snapshot.channelOrder?.length ? snapshot.channelOrder : Array.from(ids);
  for (const id of seed) {
    if (!ids.has(id)) {
      continue;
    }
    ordered.push(id);
    ids.delete(id);
  }
  for (const id of ids) {
    ordered.push(id);
  }
  return ordered.map((id) => ({
    id,
    label: resolveChannelLabel(snapshot, id),
    accounts: snapshot.channelAccounts?.[id] ?? [],
  }));
}

const CHANNEL_EXTRA_FIELDS = ["groupPolicy", "streamMode", "dmPolicy"] as const;

function summarizeChannelAccounts(accounts: ChannelAccountSnapshot[]) {
  let connected = 0;
  let configured = 0;
  let enabled = 0;
  for (const account of accounts) {
    const probeOk =
      account.probe && typeof account.probe === "object" && "ok" in account.probe
        ? Boolean((account.probe as { ok?: unknown }).ok)
        : false;
    const isConnected = account.connected === true || account.running === true || probeOk;
    if (isConnected) {
      connected += 1;
    }
    if (account.configured) {
      configured += 1;
    }
    if (account.enabled) {
      enabled += 1;
    }
  }
  return {
    total: accounts.length,
    connected,
    configured,
    enabled,
  };
}

export function renderAgentChannels(params: {
  context: AgentContext;
  configForm: Record<string, unknown> | null;
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  lastSuccess: number | null;
  onRefresh: () => void;
  onSelectPanel: (panel: AgentsPanel) => void;
}) {
  const entries = resolveChannelEntries(params.snapshot);
  const lastSuccessLabel = params.lastSuccess
    ? formatRelativeTimestamp(params.lastSuccess)
    : "never";
  return html`
    <section class="agent-channels-console">
      ${renderAgentContextCard(
        params.context,
        "Workspace, identity, and model configuration.",
        params.onSelectPanel,
      )}
      <section class="card agent-channel-command">
        <div class="agent-system-card__head">
          <div>
            <div class="agents-eyebrow">Channels</div>
            <div class="card-title">Channels</div>
            <div class="card-sub">Gateway channel status for this agent context.</div>
          </div>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? t("common.refreshing") : t("common.refresh")}
          </button>
        </div>
        <div class="agent-channel-meta">
          <span>Last refresh</span>
          <strong>${lastSuccessLabel}</strong>
        </div>
        ${params.error ? html`<div class="callout danger">${params.error}</div>` : nothing}
        ${!params.snapshot
          ? html`<div class="callout info">Load channels to see live status.</div>`
          : nothing}
        ${entries.length === 0
          ? html` <div class="muted">No channels found.</div> `
          : html`
              <div class="agent-channel-grid">
                ${entries.map((entry) => {
                  const summary = summarizeChannelAccounts(entry.accounts);
                  const status = summary.total
                    ? `${summary.connected}/${summary.total} connected`
                    : "no accounts";
                  const configLabel = summary.configured
                    ? `${summary.configured} configured`
                    : "not configured";
                  const enabled = summary.total ? `${summary.enabled} enabled` : "disabled";
                  const extras = resolveChannelExtrasFromConfig({
                    configForm: params.configForm,
                    channelId: entry.id,
                    fields: CHANNEL_EXTRA_FIELDS,
                  });
                  return html`
                    <article class="agent-channel-card">
                      <div class="agent-channel-card__signal">
                        <span class=${summary.connected > 0 ? "is-live" : ""}></span>
                      </div>
                      <div class="agent-channel-card__body">
                        <div class="list-title">${entry.label}</div>
                        <div class="list-sub mono">${entry.id}</div>
                        <div class="agent-channel-card__facts">
                          <span>${status}</span>
                          <span>${configLabel}</span>
                          <span>${enabled}</span>
                          ${extras.map(
                            (extra) => html`<span>${extra.label}: ${extra.value}</span>`,
                          )}
                        </div>
                      </div>
                      ${summary.configured === 0
                        ? html`
                            <a
                              class="agent-channel-card__link"
                              href="https://docs.neuralstudio.in/channels"
                              target="_blank"
                              rel="noopener"
                              >Setup</a
                            >
                          `
                        : nothing}
                    </article>
                  `;
                })}
              </div>
            `}
      </section>
    </section>
  `;
}

export function renderAgentCron(params: {
  context: AgentContext;
  agentId: string;
  jobs: CronJob[];
  status: CronStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onRunNow: (jobId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
}) {
  const jobs = params.jobs.filter((job) => job.agentId === params.agentId);
  return html`
    <section class="agent-cron-console">
      <div class="agent-cron-topology">
        ${renderAgentContextCard(
          params.context,
          "Workspace and scheduling targets.",
          params.onSelectPanel,
        )}
        <section class="card agent-cron-scheduler">
          <div class="agent-system-card__head">
            <div>
              <div class="agents-eyebrow">Scheduler</div>
              <div class="card-title">Scheduler</div>
              <div class="card-sub">Gateway cron status and next wake for this agent.</div>
            </div>
            <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
              ${params.loading ? t("common.refreshing") : t("common.refresh")}
            </button>
          </div>
          <div class="agent-cron-radar">
            <div>
              <span>${t("common.enabled")}</span>
              <strong>
                ${params.status
                  ? params.status.enabled
                    ? t("common.yes")
                    : t("common.no")
                  : t("common.na")}
              </strong>
            </div>
            <div>
              <span>Jobs</span>
              <strong>${params.status?.jobs ?? t("common.na")}</strong>
            </div>
            <div>
              <span>Next wake</span>
              <strong>${formatNextRun(params.status?.nextWakeAtMs ?? null)}</strong>
            </div>
          </div>
          ${params.error ? html`<div class="callout danger">${params.error}</div>` : nothing}
        </section>
      </div>
      <section class="card agent-cron-board">
        <div class="agent-system-card__head">
          <div>
            <div class="card-title">Agent Cron Jobs</div>
            <div class="card-sub">Scheduled jobs targeting this agent.</div>
          </div>
          <span class="agent-pill">${jobs.length} jobs</span>
        </div>
        ${jobs.length === 0
          ? html` <div class="agent-files-empty">No jobs assigned.</div> `
          : html`
              <div class="agent-cron-lanes">
                ${jobs.map(
                  (job) => html`
                    <article class="agent-cron-card ${job.enabled ? "is-enabled" : "is-paused"}">
                      <div class="agent-cron-card__main">
                        <div class="list-title">${job.name}</div>
                        ${job.description
                          ? html`<div class="list-sub">${job.description}</div>`
                          : nothing}
                        <div class="chip-row">
                          <span class="chip">${formatCronSchedule(job)}</span>
                          <span class="chip ${job.enabled ? "chip-ok" : "chip-warn"}">
                            ${job.enabled ? "enabled" : "disabled"}
                          </span>
                          <span class="chip">${job.sessionTarget}</span>
                        </div>
                      </div>
                      <div class="agent-cron-card__side">
                        <strong class="mono">${formatCronState(job)}</strong>
                        <span>${formatCronPayload(job)}</span>
                        <button
                          class="btn btn--sm"
                          ?disabled=${!job.enabled}
                          @click=${() => params.onRunNow(job.id)}
                        >
                          Run Now
                        </button>
                      </div>
                    </article>
                  `,
                )}
              </div>
            `}
      </section>
    </section>
  `;
}

export function renderAgentFiles(params: {
  agentId: string;
  agentFilesList: AgentsFilesListResult | null;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFileActive: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
}) {
  const list = params.agentFilesList?.agentId === params.agentId ? params.agentFilesList : null;
  const files = list?.files ?? [];
  const active = params.agentFileActive ?? null;
  const activeEntry = active ? (files.find((file) => file.name === active) ?? null) : null;
  const baseContent = active ? (params.agentFileContents[active] ?? "") : "";
  const draft = active ? (params.agentFileDrafts[active] ?? baseContent) : "";
  const isDirty = active ? draft !== baseContent : false;
  const previewHtml = activeEntry
    ? applyPreviewTheme(marked.parse(draft, { gfm: true, breaks: true }) as string, {
        sanitize: (h: string) => DOMPurify.sanitize(h),
      })
    : "";
  const draftByteSize = formatBytes(new TextEncoder().encode(draft).length);
  const draftWordCount = countWords(draft);
  const draftLineCount = countLines(draft);
  const activePathLabel = activeEntry
    ? formatWorkspaceRelativePath(activeEntry.path, list?.workspace)
    : "";
  const previewTitleId = activeEntry ? `agent-file-preview-title-${toDomId(activeEntry.name)}` : "";
  const previewStatusLabel = activeEntry?.missing
    ? "Will Create on Save"
    : isDirty
      ? "Live Draft Preview"
      : "Saved Preview";
  const previewStatusClass = activeEntry?.missing
    ? "is-missing"
    : isDirty
      ? "is-dirty"
      : "is-synced";
  const previewUpdatedLabel = activeEntry?.updatedAtMs
    ? `Updated ${formatRelativeTimestamp(activeEntry.updatedAtMs)}`
    : activeEntry?.missing
      ? "Not Created Yet"
      : "Updated Unknown";

  return html`
    <section class="agent-files-console">
      <section class="card agent-files-hero">
        <div>
          <div class="agents-eyebrow">Workspace</div>
          <div class="card-title">Files</div>
          <div class="card-sub">Edit agent workspace instructions and profile files.</div>
        </div>
        <div class="agent-file-actions">
          <button
            class="btn btn--sm"
            ?disabled=${params.agentFilesLoading}
            @click=${() => params.onLoadFiles(params.agentId)}
          >
            ${params.agentFilesLoading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>
      </section>
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
      ${!list
        ? html`
            <section class="card agent-files-empty">
              <strong>Workspace files not loaded</strong>
              <span>Load the agent workspace files to edit core instructions.</span>
            </section>
          `
        : files.length === 0
          ? html` <section class="card agent-files-empty">No files found.</section> `
          : html`
              <section class="card agent-file-workbench">
                <div class="agent-file-switchboard">
                  ${files.map((file) => {
                    const isActive = active === file.name;
                    const label = file.name.replace(/\.md$/i, "");
                    return html`
                      <button
                        class="agent-file-tab ${isActive ? "active" : ""} ${file.missing
                          ? "agent-file-tab--missing"
                          : ""}"
                        @click=${() => params.onSelectFile(file.name)}
                      >
                        <span>${label}</span>
                        <small>${file.missing ? "missing" : formatBytes(file.size)}</small>
                      </button>
                    `;
                  })}
                </div>
                ${!activeEntry
                  ? html` <div class="muted">Select a file to edit.</div> `
                  : html`
                      <div class="agent-file-stage">
                        <div class="agent-file-header">
                          <div>
                            <div class="agents-eyebrow">${previewStatusLabel}</div>
                            <div class="agent-file-sub mono">${activeEntry.path}</div>
                          </div>
                          <div class="agent-file-actions">
                            <button
                              class="btn btn--sm"
                              title="Preview rendered markdown"
                              @click=${(e: Event) => {
                                const btn = e.currentTarget as HTMLElement;
                                const dialog = btn
                                  .closest(".agent-file-workbench")
                                  ?.querySelector("dialog");
                                if (dialog) {
                                  dialog.showModal();
                                }
                              }}
                            >
                              ${icons.eye} Preview
                            </button>
                            <button
                              class="btn btn--sm"
                              ?disabled=${!isDirty}
                              @click=${() => params.onFileReset(activeEntry.name)}
                            >
                              Reset
                            </button>
                            <button
                              class="btn btn--sm primary"
                              ?disabled=${params.agentFileSaving || !isDirty}
                              @click=${() => params.onFileSave(activeEntry.name)}
                            >
                              ${params.agentFileSaving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                        <div class="agent-file-telemetry">
                          <span>${draftWordCount} words</span>
                          <span>${draftLineCount} lines</span>
                          <span>${draftByteSize}</span>
                          <span>${previewUpdatedLabel}</span>
                        </div>
                        ${activeEntry.missing
                          ? html`
                              <div class="callout info">
                                This file is missing. Saving will create it in the agent workspace.
                              </div>
                            `
                          : nothing}
                        <label class="field agent-file-field">
                          <span>Content</span>
                          <textarea
                            class="agent-file-textarea"
                            .value=${draft}
                            @input=${(e: Event) =>
                              params.onFileDraftChange(
                                activeEntry.name,
                                (e.target as HTMLTextAreaElement).value,
                              )}
                          ></textarea>
                        </label>
                      </div>
                      <dialog
                        class="md-preview-dialog"
                        aria-labelledby=${previewTitleId}
                        @click=${(e: Event) => {
                          const dialog = e.currentTarget as HTMLDialogElement;
                          if (e.target === dialog) {
                            dialog.close();
                          }
                        }}
                        @close=${(e: Event) => {
                          const dialog = e.currentTarget as HTMLElement;
                          dialog
                            .querySelector(".md-preview-dialog__panel")
                            ?.classList.remove("fullscreen");
                          setPreviewExpandButtonState(
                            dialog.querySelector(".md-preview-expand-btn"),
                            false,
                          );
                        }}
                      >
                        <div class="md-preview-dialog__panel">
                          <div class="md-preview-dialog__header">
                            <div class="md-preview-dialog__header-main">
                              <div class="md-preview-dialog__eyebrow">
                                ${icons.scrollText}
                                <span>${getExtensionLabel(activeEntry.name)}</span>
                              </div>
                              <div class="md-preview-dialog__title-wrap">
                                <div
                                  id=${previewTitleId}
                                  class="md-preview-dialog__title"
                                  translate="no"
                                >
                                  ${activeEntry.name}
                                </div>
                                <div class="md-preview-dialog__path mono" translate="no">
                                  ${activePathLabel}
                                </div>
                              </div>
                            </div>
                            <div class="md-preview-dialog__actions">
                              <button
                                type="button"
                                class="btn btn--sm md-preview-icon-btn md-preview-expand-btn"
                                title="Expand preview"
                                aria-label="Expand preview"
                                aria-pressed="false"
                                @click=${(e: Event) => {
                                  const btn = e.currentTarget as HTMLElement;
                                  const panel = btn.closest(".md-preview-dialog__panel");
                                  if (!panel) {
                                    return;
                                  }
                                  const isFullscreen = panel.classList.toggle("fullscreen");
                                  setPreviewExpandButtonState(btn, isFullscreen);
                                }}
                              >
                                <span class="when-normal" aria-hidden="true">${icons.maximize}</span
                                ><span class="when-fullscreen" aria-hidden="true"
                                  >${icons.minimize}</span
                                >
                              </button>
                              <button
                                type="button"
                                class="btn btn--sm md-preview-icon-btn"
                                title="Edit file"
                                aria-label="Edit file"
                                @click=${(e: Event) => {
                                  (e.currentTarget as HTMLElement).closest("dialog")?.close();
                                  const textarea =
                                    document.querySelector<HTMLElement>(".agent-file-textarea");
                                  textarea?.focus();
                                }}
                              >
                                <span aria-hidden="true">${icons.edit}</span>
                              </button>
                              <button
                                type="button"
                                class="btn btn--sm md-preview-icon-btn"
                                title="Close preview"
                                aria-label="Close preview"
                                @click=${(e: Event) => {
                                  (e.currentTarget as HTMLElement).closest("dialog")?.close();
                                }}
                              >
                                <span aria-hidden="true">${icons.x}</span>
                              </button>
                            </div>
                          </div>
                          <div class="md-preview-dialog__meta">
                            <div class="md-preview-dialog__chip ${previewStatusClass}">
                              <strong>${previewStatusLabel}</strong>
                            </div>
                            <div class="md-preview-dialog__chip">
                              <strong>${estimateReadingTimeLabel(draftWordCount)}</strong>
                              <span>${draftWordCount} words</span>
                            </div>
                            <div class="md-preview-dialog__chip">
                              <strong>${draftLineCount}</strong>
                              <span>lines</span>
                            </div>
                            <div class="md-preview-dialog__chip">
                              <strong>${draftByteSize}</strong>
                              <span>${previewUpdatedLabel}</span>
                            </div>
                          </div>
                          <div class="md-preview-dialog__body">
                            <article class="md-preview-dialog__reader sidebar-markdown">
                              ${unsafeHTML(previewHtml)}
                            </article>
                          </div>
                        </div>
                      </dialog>
                    `}
              </section>
            `}
    </section>
  `;
}
