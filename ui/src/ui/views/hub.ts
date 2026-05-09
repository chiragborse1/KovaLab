import { html, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import { pathForTab, titleForTab, type Tab } from "../navigation.ts";

export type HubTab =
  | "files"
  | "terminal"
  | "tasks"
  | "conductor"
  | "operations"
  | "memory"
  | "mcp"
  | "profiles";

type HubCard = {
  tab: Tab;
  title: string;
  description: string;
  eyebrow?: string;
};

type HubConfig = {
  icon: TemplateResult;
  summary: string;
  primary: HubCard[];
  secondary?: HubCard[];
};

export type HubPageProps = {
  tab: HubTab;
  basePath: string;
  onNavigate: (tab: Tab) => void;
};

const hubConfigs: Record<HubTab, HubConfig> = {
  files: {
    icon: icons.folder,
    summary:
      "A cleaner home for workspace files, generated artifacts, session attachments, and agent-owned resources.",
    primary: [
      {
        tab: "agents",
        title: "Agent files",
        description: "Browse and edit files owned by each isolated agent workspace.",
        eyebrow: "Available",
      },
      {
        tab: "sessions",
        title: "Session artifacts",
        description: "Find conversations that produced files, attachments, or exports.",
        eyebrow: "Available",
      },
      {
        tab: "logs",
        title: "Exported diagnostics",
        description: "Inspect logs and copied traces when a run or tool needs investigation.",
        eyebrow: "Available",
      },
    ],
    secondary: [
      {
        tab: "operations",
        title: "File center roadmap",
        description:
          "A dedicated workspace/media browser can land here once the backend file index is exposed.",
        eyebrow: "Next",
      },
    ],
  },
  terminal: {
    icon: icons.terminal,
    summary:
      "Operator access for commands, approvals, node routing, and terminal-adjacent diagnostics.",
    primary: [
      {
        tab: "nodes",
        title: "Node commands",
        description: "Review paired nodes, command capability, and routing targets.",
        eyebrow: "Available",
      },
      {
        tab: "config",
        title: "Exec policy",
        description: "Tune tool profiles, command policy, and host execution boundaries.",
        eyebrow: "Available",
      },
      {
        tab: "debug",
        title: "Gateway RPC",
        description: "Run controlled debug calls without leaving the Control UI.",
        eyebrow: "Available",
      },
    ],
    secondary: [
      {
        tab: "logs",
        title: "Command logs",
        description: "Follow gateway logs while testing terminal or node behavior.",
      },
    ],
  },
  tasks: {
    icon: icons.fileText,
    summary:
      "A future-focused surface for durable background work, failed runs, retries, and long-running task state.",
    primary: [
      {
        tab: "cron",
        title: "Scheduled runs",
        description: "Manage recurring and isolated jobs that create durable work.",
        eyebrow: "Available",
      },
      {
        tab: "sessions",
        title: "Task sessions",
        description: "Review background and channel sessions connected to task execution.",
        eyebrow: "Available",
      },
      {
        tab: "logs",
        title: "Failure evidence",
        description: "Use logs to diagnose aborted, timed out, or failed background runs.",
        eyebrow: "Available",
      },
    ],
  },
  conductor: {
    icon: icons.brain,
    summary:
      "The orchestration layer: agents, delegation, routing, skills, jobs, and node execution boundaries.",
    primary: [
      {
        tab: "agents",
        title: "Agents",
        description: "Manage agent workspaces, identities, tools, and routing.",
        eyebrow: "Core",
      },
      {
        tab: "skills",
        title: "Capabilities",
        description: "Enable skills and connect the requirements each agent needs.",
        eyebrow: "Core",
      },
      {
        tab: "cron",
        title: "Automation",
        description: "Schedule recurring work and isolated runs for the conductor.",
        eyebrow: "Core",
      },
      {
        tab: "nodes",
        title: "Execution nodes",
        description: "Control where tool execution and paired node work should run.",
        eyebrow: "Core",
      },
    ],
  },
  operations: {
    icon: icons.settings,
    summary:
      "System operations for gateway health, channels, services, logs, updates, and low-level diagnostics.",
    primary: [
      {
        tab: "channels",
        title: "Channels",
        description: "Inspect Telegram and other connected messaging transports.",
        eyebrow: "Runtime",
      },
      {
        tab: "instances",
        title: "Instances",
        description: "Review gateway/client presence and connected hosts.",
        eyebrow: "Runtime",
      },
      {
        tab: "logs",
        title: "Logs",
        description: "Tail gateway logs and export the evidence needed for debugging.",
        eyebrow: "Runtime",
      },
      {
        tab: "debug",
        title: "Debug",
        description: "Inspect health snapshots, models, events, and manual RPC calls.",
        eyebrow: "Runtime",
      },
      {
        tab: "usage",
        title: "Usage",
        description: "Track token use, cost, and session-level usage pressure.",
        eyebrow: "Runtime",
      },
      {
        tab: "config",
        title: "Settings",
        description:
          "Edit raw or guided gateway configuration when a system setting needs changing.",
        eyebrow: "Admin",
      },
    ],
  },
  memory: {
    icon: icons.book,
    summary:
      "Knowledge storage, session memory, reflection, and future memory search should live here.",
    primary: [
      {
        tab: "dreams",
        title: "Dreaming",
        description: "Inspect memory consolidation, reflection, and dream diary output.",
        eyebrow: "Available",
      },
      {
        tab: "aiAgents",
        title: "Memory settings",
        description: "Tune memory, model, session, and agent defaults from the AI settings slice.",
        eyebrow: "Available",
      },
      {
        tab: "sessions",
        title: "Session history",
        description: "Find the conversations that created or used remembered context.",
        eyebrow: "Available",
      },
    ],
  },
  mcp: {
    icon: icons.plug,
    summary:
      "A dedicated place for MCP servers, bridge health, and tool exposure once the UI wiring is expanded.",
    primary: [
      {
        tab: "config",
        title: "MCP configuration",
        description: "Edit configured MCP servers through the gateway config surface.",
        eyebrow: "Available",
      },
      {
        tab: "infrastructure",
        title: "Bridge runtime",
        description: "Review gateway and infrastructure settings related to external bridges.",
        eyebrow: "Available",
      },
      {
        tab: "logs",
        title: "Bridge logs",
        description: "Inspect MCP bridge failures and server startup output.",
        eyebrow: "Available",
      },
    ],
  },
  profiles: {
    icon: icons.spark,
    summary:
      "Model profiles, provider auth, tool profiles, channel routing profiles, and agent defaults.",
    primary: [
      {
        tab: "aiAgents",
        title: "AI profiles",
        description: "Configure models, auth profiles, tools, memory, and agent defaults.",
        eyebrow: "Available",
      },
      {
        tab: "sessions",
        title: "Session profiles",
        description: "Inspect per-session model, thinking, and token behavior.",
        eyebrow: "Available",
      },
      {
        tab: "communications",
        title: "Channel profiles",
        description: "Tune routing, inbox, voice, and message delivery behavior.",
        eyebrow: "Available",
      },
      {
        tab: "appearance",
        title: "Operator profile",
        description: "Adjust UI identity, appearance, and setup wizard behavior.",
        eyebrow: "Available",
      },
    ],
  },
};

function renderHubCard(props: HubPageProps, card: HubCard) {
  return html`
    <a
      class="hub-card"
      href=${pathForTab(card.tab, props.basePath)}
      @click=${(event: MouseEvent) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        props.onNavigate(card.tab);
      }}
    >
      <span class="hub-card__eyebrow">${card.eyebrow ?? titleForTab(card.tab)}</span>
      <span class="hub-card__title">${card.title}</span>
      <span class="hub-card__description">${card.description}</span>
      <span class="hub-card__action">${t("hub.open")} ${titleForTab(card.tab)}</span>
    </a>
  `;
}

export function renderHubPage(props: HubPageProps) {
  const config = hubConfigs[props.tab];
  return html`
    <section class="hub-page">
      <div class="hub-hero">
        <div class="hub-hero__icon" aria-hidden="true">${config.icon}</div>
        <div class="hub-hero__copy">
          <div class="hub-hero__eyebrow">${t("hub.section")}</div>
          <h2 class="hub-hero__title">${titleForTab(props.tab)}</h2>
          <p class="hub-hero__summary">${config.summary}</p>
        </div>
      </div>

      <div class="hub-grid">${config.primary.map((card) => renderHubCard(props, card))}</div>

      ${config.secondary?.length
        ? html`
            <section class="hub-section">
              <div class="hub-section__title">${t("hub.next")}</div>
              <div class="hub-grid hub-grid--compact">
                ${config.secondary.map((card) => renderHubCard(props, card))}
              </div>
            </section>
          `
        : null}
    </section>
  `;
}
