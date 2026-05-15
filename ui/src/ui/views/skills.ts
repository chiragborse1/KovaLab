import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type {
  KovaHubSearchResult,
  KovaHubSkillDetail,
  SkillMessageMap,
} from "../controllers/skills.ts";
import { clampText } from "../format.ts";
import { resolveSafeExternalUrl } from "../open-external-url.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import { groupSkills, type SkillGroup } from "./skills-grouping.ts";
import {
  computeSkillMissing,
  computeSkillReasons,
  renderSkillStatusChips,
} from "./skills-shared.ts";

function safeExternalHref(raw?: string): string | null {
  if (!raw) {
    return null;
  }
  return resolveSafeExternalUrl(raw, window.location.href);
}

function displaySkillSource(source: string): string {
  if (source === "workspace") {
    return "kova-workspace";
  }
  if (source === "managed") {
    return "kova-managed";
  }
  return source.replace(/^kova-/u, "kova-");
}

export type SkillsStatusFilter = "all" | "ready" | "needs-setup" | "disabled";
export type SkillsSourceFilter = "all" | "workspace" | "built-in" | "installed" | "extra" | "other";

export type SkillsProps = {
  connected: boolean;
  loading: boolean;
  report: SkillStatusReport | null;
  error: string | null;
  filter: string;
  statusFilter: SkillsStatusFilter;
  sourceFilter: SkillsSourceFilter;
  selectedKeys: string[];
  edits: Record<string, string>;
  busyKey: string | null;
  messages: SkillMessageMap;
  detailKey: string | null;
  kovahubQuery: string;
  kovahubResults: KovaHubSearchResult[] | null;
  kovahubSearchLoading: boolean;
  kovahubSearchError: string | null;
  kovahubDetail: KovaHubSkillDetail | null;
  kovahubDetailSlug: string | null;
  kovahubDetailLoading: boolean;
  kovahubDetailError: string | null;
  kovahubInstallSlug: string | null;
  kovahubInstallMessage: { kind: "success" | "error"; text: string } | null;
  onFilterChange: (next: string) => void;
  onStatusFilterChange: (next: SkillsStatusFilter) => void;
  onSourceFilterChange: (next: SkillsSourceFilter) => void;
  onSelectionChange: (next: string[]) => void;
  onRefresh: () => void;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onEdit: (skillKey: string, value: string) => void;
  onSaveKey: (skillKey: string) => void;
  onInstall: (skillKey: string, name: string, installId: string) => void;
  onDetailOpen: (skillKey: string) => void;
  onDetailClose: () => void;
  onKovaHubQueryChange: (query: string) => void;
  onKovaHubDetailOpen: (slug: string) => void;
  onKovaHubDetailClose: () => void;
  onKovaHubInstall: (slug: string) => void;
};

type StatusTabDef = { id: SkillsStatusFilter; label: string };
type SourceTabDef = { id: SkillsSourceFilter; label: string };

const STATUS_TABS: StatusTabDef[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs-setup", label: "Needs Setup" },
  { id: "disabled", label: "Disabled" },
];

const SOURCE_TABS: SourceTabDef[] = [
  { id: "all", label: "All Sources" },
  { id: "workspace", label: "Workspace" },
  { id: "built-in", label: "Built-in" },
  { id: "installed", label: "Installed" },
  { id: "extra", label: "Extra" },
  { id: "other", label: "Other" },
];

type SkillsStats = {
  total: number;
  ready: number;
  needsSetup: number;
  disabled: number;
  blocked: number;
  missingBins: number;
  missingEnv: number;
  installable: number;
};

function skillMatchesStatus(skill: SkillStatusEntry, status: SkillsStatusFilter): boolean {
  switch (status) {
    case "all":
      return true;
    case "ready":
      return !skill.disabled && skill.eligible;
    case "needs-setup":
      return !skill.disabled && !skill.eligible;
    case "disabled":
      return skill.disabled;
  }
  throw new Error("Unsupported skills status filter");
}

function skillSourceCategory(skill: SkillStatusEntry): SkillsSourceFilter {
  const source = skill.source.toLowerCase();
  if (skill.bundled || source.includes("bundled")) {
    return "built-in";
  }
  if (source.includes("workspace") || source === "workspace") {
    return "workspace";
  }
  if (source.includes("managed") || source === "managed") {
    return "installed";
  }
  if (source.includes("extra")) {
    return "extra";
  }
  return "other";
}

function skillMatchesSource(skill: SkillStatusEntry, source: SkillsSourceFilter): boolean {
  return source === "all" || skillSourceCategory(skill) === source;
}

function skillStatusClass(skill: SkillStatusEntry): string {
  if (skill.disabled) {
    return "muted";
  }
  return skill.eligible ? "ok" : "warn";
}

function skillStatusLabel(skill: SkillStatusEntry): string {
  if (skill.disabled) {
    return "Disabled";
  }
  return skill.eligible ? "Ready" : "Needs setup";
}

function collectStats(skills: SkillStatusEntry[]): SkillsStats {
  return skills.reduce<SkillsStats>(
    (stats, skill) => {
      stats.total += 1;
      if (skill.disabled) {
        stats.disabled += 1;
      } else if (skill.eligible) {
        stats.ready += 1;
      } else {
        stats.needsSetup += 1;
      }
      if (skill.blockedByAllowlist) {
        stats.blocked += 1;
      }
      if (skill.missing.bins.length > 0) {
        stats.missingBins += 1;
      }
      if (skill.missing.env.length > 0 || skill.missing.config.length > 0) {
        stats.missingEnv += 1;
      }
      if (skill.install.length > 0 && skill.missing.bins.length > 0) {
        stats.installable += 1;
      }
      return stats;
    },
    {
      total: 0,
      ready: 0,
      needsSetup: 0,
      disabled: 0,
      blocked: 0,
      missingBins: 0,
      missingEnv: 0,
      installable: 0,
    },
  );
}

function filterSkills(skills: SkillStatusEntry[], props: SkillsProps): SkillStatusEntry[] {
  const afterStatus =
    props.statusFilter === "all"
      ? skills
      : skills.filter((skill) => skillMatchesStatus(skill, props.statusFilter));
  const afterSource =
    props.sourceFilter === "all"
      ? afterStatus
      : afterStatus.filter((skill) => skillMatchesSource(skill, props.sourceFilter));
  const filter = normalizeLowercaseStringOrEmpty(props.filter);
  if (!filter) {
    return afterSource;
  }
  return afterSource.filter((skill) =>
    normalizeLowercaseStringOrEmpty(
      [
        skill.name,
        skill.description,
        skill.source,
        skill.primaryEnv,
        skill.requirements.bins.join(" "),
        skill.requirements.env.join(" "),
        skill.requirements.config.join(" "),
      ].join(" "),
    ).includes(filter),
  );
}

function selectedSkillSet(props: SkillsProps): Set<string> {
  return new Set(props.selectedKeys);
}

function selectedSkills(skills: SkillStatusEntry[], props: SkillsProps): SkillStatusEntry[] {
  const selected = selectedSkillSet(props);
  return skills.filter((skill) => selected.has(skill.skillKey));
}

function renderMetric(label: string, value: string | number, detail: string, tone = "") {
  return html`
    <div class=${`skills-metric ${tone ? `is-${tone}` : ""}`}>
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </div>
  `;
}

function renderFilterTab<T extends string>(
  tab: { id: T; label: string },
  active: T,
  count: number | null,
  onChange: (next: T) => void,
) {
  return html`
    <button
      class=${`skills-filter-tab ${active === tab.id ? "active" : ""}`}
      @click=${() => onChange(tab.id)}
    >
      <span>${tab.label}</span>
      ${count == null ? nothing : html`<small>${count}</small>`}
    </button>
  `;
}

export function renderSkills(props: SkillsProps) {
  const skills = props.report?.skills ?? [];
  const stats = collectStats(skills);
  const sourceCounts = SOURCE_TABS.reduce<Record<SkillsSourceFilter, number>>(
    (counts, tab) => {
      counts[tab.id] =
        tab.id === "all"
          ? skills.length
          : skills.filter((skill) => skillMatchesSource(skill, tab.id)).length;
      return counts;
    },
    {
      all: 0,
      workspace: 0,
      "built-in": 0,
      installed: 0,
      extra: 0,
      other: 0,
    },
  );
  const statusCounts: Record<SkillsStatusFilter, number> = {
    all: skills.length,
    ready: stats.ready,
    "needs-setup": stats.needsSetup,
    disabled: stats.disabled,
  };
  const filtered = filterSkills(skills, props);
  const groups = groupSkills(filtered);
  const detailSkill = props.detailKey
    ? (skills.find((skill) => skill.skillKey === props.detailKey) ?? null)
    : null;
  const setupQueue = skills
    .filter((skill) => !skill.disabled && !skill.eligible)
    .toSorted((a, b) => computeSkillMissing(b).length - computeSkillMissing(a).length);
  const selected = selectedSkills(skills, props);
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((skill) => props.selectedKeys.includes(skill.skillKey));

  return html`
    <section class="skills-console">
      <header class="card skills-command-center">
        <div class="skills-command-center__head">
          <div>
            <div class="card-title">Skills</div>
            <div class="card-sub">
              Manage local skills, missing requirements, API keys, and KovaHub installs.
            </div>
          </div>
          <div class="skills-command-center__actions">
            <button
              class="btn"
              ?disabled=${props.loading || !props.connected}
              @click=${props.onRefresh}
            >
              ${props.loading ? t("common.loading") : t("common.refresh")}
            </button>
          </div>
        </div>
        <div class="skills-metric-grid">
          ${renderMetric("Total", stats.total, "visible to gateway", "muted")}
          ${renderMetric("Ready", stats.ready, "eligible and enabled", "ok")}
          ${renderMetric(
            "Needs setup",
            stats.needsSetup,
            "missing requirements",
            stats.needsSetup > 0 ? "warn" : "ok",
          )}
          ${renderMetric(
            "Disabled",
            stats.disabled,
            "turned off",
            stats.disabled > 0 ? "muted" : "ok",
          )}
          ${renderMetric(
            "Installable",
            stats.installable,
            "has dependency installer",
            stats.installable > 0 ? "warn" : "muted",
          )}
        </div>
        ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}
      </header>

      <section class="skills-workspace">
        <div class="skills-main-column">
          <section class="card skills-library">
            <div class="skills-section-head">
              <div>
                <div class="card-title">Library</div>
                <div class="card-sub">
                  ${filtered.length} shown · workspace ${props.report?.workspaceDir ?? "unknown"}
                </div>
              </div>
              <label class="skills-select-visible">
                <input
                  type="checkbox"
                  .checked=${allVisibleSelected}
                  ?disabled=${filtered.length === 0}
                  @change=${(event: Event) => {
                    const checked = (event.target as HTMLInputElement).checked;
                    const visibleKeys = filtered.map((skill) => skill.skillKey);
                    if (checked) {
                      props.onSelectionChange(
                        Array.from(new Set([...props.selectedKeys, ...visibleKeys])),
                      );
                      return;
                    }
                    props.onSelectionChange(
                      props.selectedKeys.filter((key) => !visibleKeys.includes(key)),
                    );
                  }}
                />
                <span>Select shown</span>
              </label>
            </div>

            <div class="skills-filter-stack">
              <div class="skills-filter-row">
                ${STATUS_TABS.map((tab) =>
                  renderFilterTab(
                    tab,
                    props.statusFilter,
                    statusCounts[tab.id],
                    props.onStatusFilterChange,
                  ),
                )}
              </div>
              <div class="skills-filter-row skills-filter-row--sources">
                ${SOURCE_TABS.map((tab) =>
                  renderFilterTab(
                    tab,
                    props.sourceFilter,
                    sourceCounts[tab.id],
                    props.onSourceFilterChange,
                  ),
                )}
              </div>
              <label class="field skills-search-field">
                <input
                  .value=${props.filter}
                  @input=${(event: Event) =>
                    props.onFilterChange((event.target as HTMLInputElement).value)}
                  placeholder="Search by name, source, env, dependency..."
                  autocomplete="off"
                  name="skills-filter"
                />
              </label>
            </div>

            ${selected.length > 0 ? renderBulkBar(selected, props) : nothing}
            ${!props.connected && !props.report
              ? html`<div class="skills-empty">Not connected to gateway.</div>`
              : filtered.length === 0
                ? html`<div class="skills-empty">No skills match these filters.</div>`
                : html`<div class="agent-skills-groups skills-library-groups">
                    ${groups.map((group) => renderSkillGroup(group, props))}
                  </div>`}
          </section>

          <section class="card skills-discovery">
            <div class="skills-section-head">
              <div>
                <div class="card-title">KovaHub</div>
                <div class="card-sub">Search and install workspace skills from the registry.</div>
              </div>
              ${props.kovahubSearchLoading
                ? html`<span class="muted">Searching...</span>`
                : nothing}
            </div>
            <label class="field skills-search-field">
              <input
                .value=${props.kovahubQuery}
                @input=${(event: Event) =>
                  props.onKovaHubQueryChange((event.target as HTMLInputElement).value)}
                placeholder="Search KovaHub skills..."
                autocomplete="off"
                name="kovahub-search"
              />
            </label>
            ${props.kovahubSearchError
              ? html`<div class="callout danger">${props.kovahubSearchError}</div>`
              : nothing}
            ${props.kovahubInstallMessage
              ? html`<div
                  class="callout ${props.kovahubInstallMessage.kind === "error"
                    ? "danger"
                    : "success"}"
                >
                  ${props.kovahubInstallMessage.text}
                </div>`
              : nothing}
            ${renderKovaHubResults(props)}
          </section>
        </div>

        <aside class="skills-side-column">
          ${renderSetupQueue(setupQueue, props)}
          ${props.kovahubDetailSlug
            ? renderKovaHubInspector(props)
            : renderSkillInspector(detailSkill, props)}
        </aside>
      </section>
    </section>
  `;
}

function renderSkillGroup(group: SkillGroup, props: SkillsProps) {
  return html`
    <details class="agent-skills-group skills-source-group" open>
      <summary class="agent-skills-header skills-source-header">
        <span>${group.label}</span>
        <span class="muted">${group.skills.length}</span>
      </summary>
      <div class="list skills-grid">${group.skills.map((skill) => renderSkill(skill, props))}</div>
    </details>
  `;
}

function renderBulkBar(selected: SkillStatusEntry[], props: SkillsProps) {
  const installable = selected.filter(
    (skill) => skill.install.length > 0 && skill.missing.bins.length > 0,
  );
  const selectedKeys = selected.map((skill) => skill.skillKey);
  return html`
    <div class="skills-bulk-bar">
      <strong>${selected.length} selected</strong>
      <button class="btn btn--sm" @click=${() => props.onSelectionChange([])}>Clear</button>
      <button
        class="btn btn--sm"
        ?disabled=${props.busyKey !== null}
        @click=${() => {
          for (const skill of selected) {
            props.onToggle(skill.skillKey, true);
          }
        }}
      >
        Enable
      </button>
      <button
        class="btn btn--sm"
        ?disabled=${props.busyKey !== null}
        @click=${() => {
          for (const key of selectedKeys) {
            props.onToggle(key, false);
          }
        }}
      >
        Disable
      </button>
      <button
        class="btn btn--sm"
        ?disabled=${props.busyKey !== null || installable.length === 0}
        @click=${() => {
          for (const skill of installable) {
            props.onInstall(skill.skillKey, skill.name, skill.install[0].id);
          }
        }}
      >
        Install missing deps
      </button>
    </div>
  `;
}

function renderKovaHubResults(props: SkillsProps) {
  const results = props.kovahubResults;
  if (!results) {
    return html`<div class="skills-empty skills-empty--compact">
      Search for installable skills.
    </div>`;
  }
  if (results.length === 0) {
    return html`<div class="skills-empty skills-empty--compact">No skills found on KovaHub.</div>`;
  }
  return html`
    <div class="skills-kovahub-results">
      ${results.map(
        (result) => html`
          <div class="skills-kovahub-row" @click=${() => props.onKovaHubDetailOpen(result.slug)}>
            <span>
              <strong>${result.displayName}</strong>
              <small>${result.summary ? clampText(result.summary, 120) : result.slug}</small>
            </span>
            <span class="skills-kovahub-row__meta">
              ${result.version ? html`<small>v${result.version}</small>` : nothing}
              <button
                class="btn btn--sm"
                ?disabled=${props.kovahubInstallSlug !== null}
                @click=${(event: Event) => {
                  event.stopPropagation();
                  props.onKovaHubInstall(result.slug);
                }}
              >
                ${props.kovahubInstallSlug === result.slug ? "Installing..." : "Install"}
              </button>
            </span>
          </div>
        `,
      )}
    </div>
  `;
}

function renderSetupQueue(skills: SkillStatusEntry[], props: SkillsProps) {
  return html`
    <section class="card skills-setup-queue">
      <div class="skills-section-head">
        <div>
          <div class="card-title">Setup Queue</div>
          <div class="card-sub">
            ${skills.length} skill${skills.length === 1 ? "" : "s"} need attention.
          </div>
        </div>
      </div>
      ${skills.length === 0
        ? html`<div class="skills-empty skills-empty--compact">All enabled skills are ready.</div>`
        : html`
            <div class="skills-setup-list">
              ${skills.slice(0, 6).map((skill) => {
                const missing = computeSkillMissing(skill);
                const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0;
                return html`
                  <button
                    class="skills-setup-row"
                    type="button"
                    @click=${() => props.onDetailOpen(skill.skillKey)}
                  >
                    <span class="statusDot ${skillStatusClass(skill)}"></span>
                    <span>
                      <strong>${skill.name}</strong>
                      <small
                        >${missing.length > 0 ? missing.join(", ") : "Review skill settings"}</small
                      >
                    </span>
                    ${canInstall
                      ? html`<span class="skills-setup-row__action">Install</span>`
                      : nothing}
                  </button>
                `;
              })}
            </div>
          `}
    </section>
  `;
}

function renderSkill(skill: SkillStatusEntry, props: SkillsProps) {
  const busy = props.busyKey === skill.skillKey;
  const dotClass = skillStatusClass(skill);
  const selected = props.selectedKeys.includes(skill.skillKey);
  const missing = computeSkillMissing(skill);
  const reasons = computeSkillReasons(skill);

  return html`
    <div
      class=${`list-item list-item-clickable skills-row ${props.detailKey === skill.skillKey ? "list-item-selected" : ""}`}
      @click=${() => props.onDetailOpen(skill.skillKey)}
    >
      <label class="skills-row__select" @click=${(event: Event) => event.stopPropagation()}>
        <input
          type="checkbox"
          .checked=${selected}
          @change=${(event: Event) => {
            const checked = (event.target as HTMLInputElement).checked;
            const next = checked
              ? Array.from(new Set([...props.selectedKeys, skill.skillKey]))
              : props.selectedKeys.filter((key) => key !== skill.skillKey);
            props.onSelectionChange(next);
          }}
        />
      </label>
      <div class="list-main skills-row__main">
        <div class="list-title skills-row__title">
          <span class="statusDot ${dotClass}"></span>
          ${skill.emoji ? html`<span class="skills-row__emoji">${skill.emoji}</span>` : nothing}
          <span>${skill.name}</span>
        </div>
        <div class="list-sub">${clampText(skill.description, 140)}</div>
        <div class="skills-row__badges">
          <span class="chip">${displaySkillSource(skill.source)}</span>
          <span class=${`chip ${skill.eligible && !skill.disabled ? "chip-ok" : "chip-warn"}`}>
            ${skillStatusLabel(skill)}
          </span>
          ${missing.length > 0
            ? html`<span class="chip chip-warn">${missing.length} missing</span>`
            : nothing}
          ${reasons.map((reason) => html`<span class="chip">${reason}</span>`)}
        </div>
      </div>
      <div class="list-meta skills-row__meta">
        <label class="skill-toggle-wrap" @click=${(event: Event) => event.stopPropagation()}>
          <input
            type="checkbox"
            class="skill-toggle"
            .checked=${!skill.disabled}
            ?disabled=${busy}
            aria-label=${`${skill.disabled ? "Enable" : "Disable"} ${skill.name}`}
            @change=${(event: Event) => {
              event.stopPropagation();
              props.onToggle(skill.skillKey, skill.disabled);
            }}
          />
        </label>
      </div>
    </div>
  `;
}

function renderSkillInspector(skill: SkillStatusEntry | null, props: SkillsProps) {
  if (!skill) {
    return html`
      <section class="card skills-inspector">
        <div class="card-title">Skill Inspector</div>
        <div class="skills-empty skills-empty--compact">
          Select a skill to configure API keys, install missing dependencies, and inspect source
          details.
        </div>
      </section>
    `;
  }

  const busy = props.busyKey === skill.skillKey;
  const apiKey = props.edits[skill.skillKey] ?? "";
  const message = props.messages[skill.skillKey] ?? null;
  const canInstall = skill.install.length > 0 && skill.missing.bins.length > 0;
  const showBundledBadge = Boolean(skill.bundled && skill.source !== "kova-bundled");
  const missing = computeSkillMissing(skill);
  const reasons = computeSkillReasons(skill);

  return html`
    <section class="card skills-inspector">
      <div class="skills-inspector__header">
        <div>
          <div class="skills-inspector__eyebrow">${displaySkillSource(skill.source)}</div>
          <div class="card-title">
            <span class="statusDot ${skillStatusClass(skill)}"></span>
            ${skill.emoji ? html`<span>${skill.emoji}</span>` : nothing}
            <span>${skill.name}</span>
          </div>
          <div class="card-sub">${skill.description}</div>
        </div>
        <button class="btn btn--sm" @click=${props.onDetailClose}>Close</button>
      </div>

      ${renderSkillStatusChips({ skill, showBundledBadge })}

      <div class="skills-inspector__actions">
        <label class="skill-toggle-wrap">
          <input
            type="checkbox"
            class="skill-toggle"
            .checked=${!skill.disabled}
            ?disabled=${busy}
            @change=${() => props.onToggle(skill.skillKey, skill.disabled)}
          />
        </label>
        <span>${skill.disabled ? "Disabled" : "Enabled"}</span>
        ${canInstall
          ? html`<button
              class="btn"
              ?disabled=${busy}
              @click=${() => props.onInstall(skill.skillKey, skill.name, skill.install[0].id)}
            >
              ${busy ? "Installing..." : skill.install[0].label}
            </button>`
          : nothing}
      </div>

      ${message
        ? html`<div class="callout ${message.kind === "error" ? "danger" : "success"}">
            ${message.message}
          </div>`
        : nothing}
      ${missing.length > 0 || reasons.length > 0
        ? html`
            <div class="skills-warning-panel">
              <strong>Needs attention</strong>
              ${missing.length > 0 ? html`<span>${missing.join(", ")}</span>` : nothing}
              ${reasons.length > 0 ? html`<span>${reasons.join(", ")}</span>` : nothing}
            </div>
          `
        : nothing}
      ${skill.primaryEnv
        ? html`
            <div class="skills-inspector-section">
              <div class="skills-inspector-section__title">API Key</div>
              <label class="field">
                <span>${skill.primaryEnv}</span>
                <input
                  type="password"
                  .value=${apiKey}
                  @input=${(event: Event) =>
                    props.onEdit(skill.skillKey, (event.target as HTMLInputElement).value)}
                />
              </label>
              ${(() => {
                const href = safeExternalHref(skill.homepage);
                return href
                  ? html`<div class="muted" style="font-size: 13px;">
                      Get your key:
                      <a href=${href} target="_blank" rel="noopener noreferrer"
                        >${skill.homepage}</a
                      >
                    </div>`
                  : nothing;
              })()}
              <button
                class="btn primary"
                ?disabled=${busy}
                @click=${() => props.onSaveKey(skill.skillKey)}
              >
                Save key
              </button>
            </div>
          `
        : nothing}

      <div class="skills-inspector-section">
        <div class="skills-inspector-section__title">Requirements</div>
        ${renderRequirementRows(skill)}
      </div>

      <div class="skills-inspector-section">
        <div class="skills-inspector-section__title">Source</div>
        <div class="skills-meta-row">
          <span>Source</span>
          <strong>${displaySkillSource(skill.source)}</strong>
        </div>
        <div class="skills-meta-row">
          <span>File</span>
          <strong class="skills-path">${skill.filePath}</strong>
        </div>
        <div class="skills-meta-row">
          <span>Base</span>
          <strong class="skills-path">${skill.baseDir}</strong>
        </div>
        ${(() => {
          const href = safeExternalHref(skill.homepage);
          return href
            ? html`<div class="skills-meta-row">
                <span>Homepage</span>
                <strong
                  ><a href=${href} target="_blank" rel="noopener noreferrer"
                    >${skill.homepage}</a
                  ></strong
                >
              </div>`
            : nothing;
        })()}
      </div>
    </section>
  `;
}

function renderRequirementRows(skill: SkillStatusEntry) {
  const rows = [
    { label: "Binaries", required: skill.requirements.bins, missing: skill.missing.bins },
    { label: "Environment", required: skill.requirements.env, missing: skill.missing.env },
    { label: "Config", required: skill.requirements.config, missing: skill.missing.config },
    { label: "OS", required: skill.requirements.os, missing: skill.missing.os },
  ];
  const visible = rows.filter((row) => row.required.length > 0 || row.missing.length > 0);
  if (visible.length === 0 && skill.configChecks.length === 0) {
    return html`<div class="muted">No explicit requirements.</div>`;
  }
  return html`
    <div class="skills-requirements">
      ${visible.map(
        (row) => html`
          <div class="skills-meta-row">
            <span>${row.label}</span>
            <strong class=${row.missing.length > 0 ? "skills-requirement-missing" : ""}>
              ${row.required.length > 0 ? row.required.join(", ") : "none"}
              ${row.missing.length > 0 ? html` · missing: ${row.missing.join(", ")}` : nothing}
            </strong>
          </div>
        `,
      )}
      ${skill.configChecks.map(
        (check) => html`
          <div class="skills-meta-row">
            <span>${check.path}</span>
            <strong class=${check.satisfied ? "" : "skills-requirement-missing"}>
              ${check.satisfied ? "satisfied" : "missing"}
            </strong>
          </div>
        `,
      )}
    </div>
  `;
}

function renderKovaHubInspector(props: SkillsProps) {
  const detail = props.kovahubDetail;
  return html`
    <section class="card skills-inspector">
      <div class="skills-inspector__header">
        <div>
          <div class="skills-inspector__eyebrow">KovaHub</div>
          <div class="card-title">${detail?.skill?.displayName ?? props.kovahubDetailSlug}</div>
          <div class="card-sub">Registry detail and install status.</div>
        </div>
        <button class="btn btn--sm" @click=${props.onKovaHubDetailClose}>Close</button>
      </div>
      ${props.kovahubDetailLoading
        ? html`<div class="skills-empty skills-empty--compact">${t("common.loading")}</div>`
        : props.kovahubDetailError
          ? html`<div class="callout danger">${props.kovahubDetailError}</div>`
          : detail?.skill
            ? html`
                <div class="skills-inspector-section">
                  <div class="skills-inspector-section__title">Summary</div>
                  <div class="skills-inspector-text">${detail.skill.summary ?? "No summary."}</div>
                </div>
                <div class="skills-inspector-section">
                  <div class="skills-inspector-section__title">Registry</div>
                  ${detail.owner?.displayName
                    ? html`<div class="skills-meta-row">
                        <span>Owner</span>
                        <strong>
                          ${detail.owner.displayName}${detail.owner.handle
                            ? html` (@${detail.owner.handle})`
                            : nothing}
                        </strong>
                      </div>`
                    : nothing}
                  ${detail.latestVersion
                    ? html`<div class="skills-meta-row">
                        <span>Latest</span>
                        <strong>v${detail.latestVersion.version}</strong>
                      </div>`
                    : nothing}
                  ${detail.metadata?.os
                    ? html`<div class="skills-meta-row">
                        <span>Platforms</span>
                        <strong>${detail.metadata.os.join(", ")}</strong>
                      </div>`
                    : nothing}
                </div>
                ${detail.latestVersion?.changelog
                  ? html`
                      <div class="skills-inspector-section">
                        <div class="skills-inspector-section__title">Changelog</div>
                        <div class="skills-inspector-text">${detail.latestVersion.changelog}</div>
                      </div>
                    `
                  : nothing}
                <button
                  class="btn primary"
                  ?disabled=${props.kovahubInstallSlug !== null}
                  @click=${() => {
                    if (props.kovahubDetailSlug) {
                      props.onKovaHubInstall(props.kovahubDetailSlug);
                    }
                  }}
                >
                  ${props.kovahubInstallSlug === props.kovahubDetailSlug
                    ? "Installing..."
                    : `Install ${detail.skill.displayName}`}
                </button>
              `
            : html`<div class="skills-empty skills-empty--compact">Skill not found.</div>`}
    </section>
  `;
}
