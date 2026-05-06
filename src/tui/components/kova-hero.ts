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
  source: "core" | "plugin" | string;
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

const KOVA_BANNER = [
  "██╗  ██╗ ██████╗ ██╗   ██╗ █████╗",
  "██║ ██╔╝██╔═══██╗██║   ██║██╔══██╗",
  "█████╔╝ ██║   ██║██║   ██║███████║",
  "██╔═██╗ ██║   ██║╚██╗ ██╔╝██╔══██║",
  "██║  ██╗╚██████╔╝ ╚████╔╝ ██║  ██║",
  "╚═╝  ╚═╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝",
];

const KOVA_MARK = [
  "        /\\",
  "       /  \\",
  "   ___/____\\___",
  "      ( o  o )",
  "       \\_==_/",
  "       /|  |\\",
  "      //|  |\\\\",
  "        /__\\",
];

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

function formatToolGroups(groups: KovaHeroToolGroup[], maxRows: number): string[] {
  if (groups.length === 0) {
    return [theme.dim("catalog loading...")];
  }

  const rows: string[] = [];
  for (const group of groups) {
    const names = group.tools
      .slice(0, 4)
      .map((tool) => tool.label || tool.id)
      .join(", ");
    if (!names) {
      continue;
    }
    rows.push(`${theme.accentSoft(`${group.label}:`)} ${names}`);
    if (rows.length >= maxRows) {
      break;
    }
  }

  if (groups.length > rows.length) {
    rows.push(theme.dim(`and ${String(groups.length - rows.length)} more tool groups...`));
  }
  return rows.length > 0 ? rows : [theme.dim("no tools visible")];
}

function formatSkills(skills: KovaHeroSkill[], maxRows: number): string[] {
  const visible = skills.filter((skill) => skill.disabled !== true);
  if (visible.length === 0) {
    return [theme.dim("skills loading...")];
  }

  const rows = visible.slice(0, maxRows).map((skill) => {
    const sourceLabel = formatSkillSourceLabel(skill.source);
    const source = sourceLabel ? theme.dim(` (${sourceLabel})`) : "";
    const marker = skill.eligible === false ? theme.dim("offline ") : "";
    return `${marker}${skill.name}${source}`;
  });
  if (visible.length > rows.length) {
    rows.push(theme.dim(`and ${String(visible.length - rows.length)} more skills...`));
  }
  return rows;
}

export function formatSkillSourceLabel(source?: string): string {
  switch ((source ?? "").trim()) {
    case "openclaw-bundled":
      return "kova-bundled";
    case "openclaw-extra":
      return "kova-extra";
    case "openclaw-managed":
      return "kova-managed";
    case "openclaw-workspace":
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
      theme.header(`KOVA AGENT v${VERSION}`),
      theme.dim(
        `${this.state.connectionStatus} | agent ${this.state.agentLabel} | session ${this.state.sessionLabel}`,
      ),
      theme.accent(
        `${String(toolCount)} tools · ${String(skillCount)} skills · /help for commands`,
      ),
    ];
    return lines.map((line) => clipped(line, width));
  }

  private renderFull(width: number): string[] {
    const innerWidth = Math.max(1, width - 4);
    const leftWidth = Math.max(24, Math.min(36, Math.floor(innerWidth * 0.28)));
    const rightWidth = Math.max(20, innerWidth - leftWidth - 2);
    const title = ` ${this.state.title} v${VERSION} · ${this.state.connectionStatus} `;
    const topRight = Math.max(0, width - 2 - visibleWidth(title));
    const lines: string[] = [];

    for (const bannerLine of KOVA_BANNER) {
      lines.push(clipped(theme.header(bannerLine), width));
    }

    lines.push(
      theme.border(
        `╭${"─".repeat(Math.max(0, Math.floor(topRight / 2)))}${title}${"─".repeat(Math.max(0, Math.ceil(topRight / 2)))}╮`,
      ),
    );

    const leftRows = [
      ...KOVA_MARK.map((line) => theme.accent(line)),
      "",
      theme.accentSoft(`agent: ${this.state.agentLabel}`),
      theme.dim(`session: ${this.state.sessionLabel}`),
      theme.dim(`model: ${this.state.modelLabel}`),
      theme.dim(`tokens: ${this.state.tokenLabel}`),
      theme.dim(`link: ${this.state.connection}`),
    ];
    const rightRows = [
      theme.header("Available Tools"),
      ...formatToolGroups(this.state.toolGroups, 8),
      "",
      theme.header("Available Skills"),
      ...formatSkills(this.state.skills, 8),
      "",
      theme.accent(
        `${String(countTools(this.state.toolGroups))} tools · ${String(this.state.skills.length)} skills · /help for commands`,
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
