import { truncateToWidth, type Component, visibleWidth } from "@mariozechner/pi-tui";
import { VERSION } from "../../version.js";
import { theme } from "../theme/theme.js";

export type KovaHeroTool = {
  id: string;
  label: string;
  description?: string;
};

export type KovaHeroToolGroup = {
  id: string;
  label: string;
  source: string;
  tools: KovaHeroTool[];
};

export type KovaHeroSkill = {
  name: string;
  description?: string;
  source?: string;
  eligible?: boolean;
  disabled?: boolean;
};

export type KovaHeroState = {
  title: string;
  connection: string;
  connectionStatus: string;
  activityStatus: string;
  agentLabel: string;
  sessionLabel: string;
  modelLabel: string;
  tokenLabel: string;
  toolGroups: KovaHeroToolGroup[];
  skills: KovaHeroSkill[];
  catalogStatus?: string;
};

const DEFAULT_STATE: KovaHeroState = {
  title: "Kova Agent",
  connection: "local",
  connectionStatus: "starting",
  activityStatus: "idle",
  agentLabel: "main",
  sessionLabel: "main",
  modelLabel: "unknown",
  tokenLabel: "tokens n/a",
  toolGroups: [],
  skills: [],
};

function countTools(groups: KovaHeroToolGroup[]): number {
  return groups.reduce((sum, group) => sum + group.tools.length, 0);
}

function padVisible(text: string, width: number): string {
  const padding = Math.max(0, width - visibleWidth(text));
  return text + " ".repeat(padding);
}

function clipped(text: string, width: number): string {
  return truncateToWidth(text, Math.max(0, width), "...", true);
}

function frameLine(left: string, right: string, leftWidth: number, rightWidth: number): string {
  return `${padVisible(left, leftWidth)}  ${padVisible(right, rightWidth)}`;
}

function statLine(label: string, value: string): string {
  return `${theme.accentSoft(`${label}:`)} ${value}`;
}

function compactTokenLabel(label: string): string {
  return label.replace(/^tokens\s+/i, "").trim() || "n/a";
}

function parseTokenPercent(label: string): number | null {
  const match = /\((\d+)%\)/.exec(label);
  if (!match?.[1]) {
    return null;
  }
  const percent = Number.parseInt(match[1], 10);
  return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null;
}

export function formatContextGauge(tokenLabel: string): string {
  const compact = compactTokenLabel(tokenLabel);
  const percent = parseTokenPercent(tokenLabel);
  if (percent === null) {
    return `ctx ${compact}`;
  }
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  const gauge = `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
  return `ctx ${compact} ${theme.dim(`[${gauge}]`)}`;
}

function formatToolGroups(groups: KovaHeroToolGroup[]): string[] {
  if (groups.length === 0) {
    return [theme.dim("tools loading")];
  }

  const toolCount = countTools(groups);
  const groupCount = groups.length;
  const groupPreview = groups
    .slice(0, 3)
    .map((group) => group.label)
    .filter(Boolean)
    .join(", ");
  const suffix = groupCount > 3 ? ` +${String(groupCount - 3)}` : "";
  return [
    theme.accent(`${String(toolCount)} tools ready`),
    theme.dim(
      groupPreview
        ? `${groupPreview}${suffix}`
        : `${String(groupCount)} group${groupCount === 1 ? "" : "s"} loaded`,
    ),
  ];
}

function formatSkills(skills: KovaHeroSkill[]): string[] {
  const visible = skills.filter((skill) => skill.disabled !== true);
  if (visible.length === 0) {
    return [theme.dim("skills loading")];
  }

  const offline = visible.filter((skill) => skill.eligible === false).length;
  return [
    theme.accent(`${String(visible.length)} skills available`),
    offline > 0 ? theme.dim(`${String(offline)} offline`) : theme.dim("loaded on demand"),
  ];
}

export function formatSkillSourceLabel(source?: string): string {
  switch ((source ?? "").trim()) {
    case "kova-bundled":
      return "kova-bundled";
    case "kova-extra":
      return "kova-extra";
    case "kova-managed":
      return "kova-managed";
    case "kova-workspace":
      return "kova-workspace";
    default:
      return source?.trim() ?? "";
  }
}

export class KovaHero implements Component {
  private state: KovaHeroState = { ...DEFAULT_STATE };

  setState(state: Partial<KovaHeroState>): void {
    this.state = {
      ...this.state,
      ...state,
    };
  }

  invalidate(): void {
    // KovaHero renders directly from state and has no cached child state.
  }

  render(width: number): string[] {
    if (width < 72) {
      return this.renderCompact(width);
    }
    return this.renderFull(width);
  }

  private renderCompact(width: number): string[] {
    const toolCount = countTools(this.state.toolGroups);
    const skillCount = this.state.skills.length;
    const lines = [
      theme.header(`KOVA v${VERSION} | ${this.state.connectionStatus}`),
      theme.dim(
        `agent ${this.state.agentLabel} | session ${this.state.sessionLabel} | ${this.state.modelLabel} | ${this.state.activityStatus}`,
      ),
      theme.accent(
        `${formatContextGauge(this.state.tokenLabel)} | ${String(toolCount)} tools | ${String(skillCount)} skills | /help`,
      ),
    ];
    return lines.map((line) => clipped(line, width));
  }

  private renderFull(width: number): string[] {
    const innerWidth = Math.max(1, width - 4);
    const leftWidth = Math.max(32, Math.min(56, Math.floor(innerWidth * 0.5)));
    const rightWidth = Math.max(20, innerWidth - leftWidth - 2);
    const title = ` KOVA TERMINAL v${VERSION} `;
    const topRight = Math.max(0, width - 2 - visibleWidth(title));
    const lines: string[] = [];

    lines.push(
      theme.border(
        `╭${"─".repeat(Math.max(0, Math.floor(topRight / 2)))}${title}${"─".repeat(Math.max(0, Math.ceil(topRight / 2)))}╮`,
      ),
    );

    const leftRows = [
      theme.header(this.state.title),
      statLine("state", `${this.state.connectionStatus} · ${this.state.activityStatus}`),
      statLine("model", this.state.modelLabel),
      statLine("context", formatContextGauge(this.state.tokenLabel)),
      statLine("session", `agent ${this.state.agentLabel} | session ${this.state.sessionLabel}`),
      statLine("link", this.state.connection),
      "",
      theme.dim("/help /model /sessions /busy /settings"),
    ];
    const rightRows = [
      theme.header("Live Surface"),
      ...formatToolGroups(this.state.toolGroups),
      "",
      ...formatSkills(this.state.skills),
      "",
      theme.accent(
        `${String(countTools(this.state.toolGroups))} tools | ${String(this.state.skills.length)} skills | terminal first`,
      ),
      ...(this.state.catalogStatus ? [theme.dim(this.state.catalogStatus)] : []),
    ];
    const rows = Math.max(leftRows.length, rightRows.length);

    for (let index = 0; index < rows; index++) {
      const left = clipped(leftRows[index] ?? "", leftWidth);
      const right = clipped(rightRows[index] ?? "", rightWidth);
      lines.push(
        theme.border("│ ") + frameLine(left, right, leftWidth, rightWidth) + theme.border(" │"),
      );
    }

    lines.push(theme.border(`╰${"─".repeat(Math.max(0, width - 2))}╯`));
    return lines.map((line) => clipped(line, width));
  }
}
