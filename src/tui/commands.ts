import type { SlashCommand } from "@mariozechner/pi-tui";
import {
  listChatCommands,
  listChatCommandsForConfig,
} from "../auto-reply/commands-registry-list.js";
import { normalizeCommandBody } from "../auto-reply/commands-registry-normalize.js";
import { formatThinkingLevels, listThinkingLevelLabels } from "../auto-reply/thinking.js";
import type { KovaConfig } from "../config/types.js";
import type { CommandEntry } from "../gateway/protocol/index.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";

const VERBOSE_LEVELS = ["on", "off", "full"];
const TRACE_LEVELS = ["on", "off"];
const FAST_LEVELS = ["status", "on", "off", "default"];
const REASONING_LEVELS = ["on", "off"];
const ELEVATED_LEVELS = ["on", "off", "ask", "full"];
const ACTIVATION_LEVELS = ["mention", "always"];
const USAGE_FOOTER_LEVELS = ["off", "tokens", "full", "cost"];
const BUSY_LEVELS = ["status", "queue", "steer", "interrupt", "clear"];
const SURFACE_LEVELS = ["compact", "verbose"];
const CONTEXT_LEVELS = ["list", "detail", "json"];
const TASK_LEVELS = [
  "list",
  "running",
  "queued",
  "failed",
  "subagents",
  "cron",
  "audit",
  "repair",
  "repair apply",
];
const SUBAGENT_LEVELS = ["list", "running", "queued", "failed", "lost", "all"];
const AUTOMATION_LEVELS = ["list", "running", "queued", "failed", "audit"];
const RECOVER_LEVELS = ["status", "apply"];
const ROLLBACK_LEVELS = ["list", "show ", "branch ", "restore "];
const MEMORY_COMMAND_COMPLETIONS = [
  {
    value: "status",
    label: "status",
    description: "Check memory backend and index health",
  },
  {
    value: "sync",
    label: "sync",
    description: "Refresh the active memory index",
  },
  {
    value: "sync force",
    label: "sync force",
    description: "Rebuild the active memory index",
  },
  {
    value: "search ",
    label: "search <query>",
    description: "Search recalled memory snippets",
  },
  {
    value: "read ",
    label: "read <path[:line[-end]]>",
    description: "Read a cited memory source excerpt",
  },
  {
    value: "dreams",
    label: "dreams",
    description: "Review the Dream Diary",
  },
  {
    value: "help",
    label: "help",
    description: "Show memory command help",
  },
];
const PERSONA_COMMAND_COMPLETIONS = [
  {
    value: "status",
    label: "status",
    description: "Show SOUL.md status and edit command",
  },
  {
    value: "show",
    label: "show",
    description: "Read SOUL.md",
  },
  {
    value: "show lines=80",
    label: "show lines=80",
    description: "Read the first 80 lines",
  },
  {
    value: "show all",
    label: "show all",
    description: "Read the full persona file",
  },
  {
    value: "path",
    label: "path",
    description: "Show the SOUL.md path",
  },
  {
    value: "help",
    label: "help",
    description: "Show persona command help",
  },
];
const PLUGIN_COMMAND_COMPLETIONS = [
  {
    value: "list",
    label: "list",
    description: "List discovered plugins",
  },
  {
    value: "verbose",
    label: "verbose",
    description: "Show discovered plugin details",
  },
  {
    value: "show ",
    label: "show <plugin>",
    description: "Inspect plugin details",
  },
];

export type ParsedCommand = {
  name: string;
  args: string;
};

export type SlashCommandOptions = {
  cfg?: KovaConfig;
  provider?: string;
  model?: string;
  local?: boolean;
  dynamicCommands?: CommandEntry[];
};

const COMMAND_ALIASES: Record<string, string> = {
  abort: "stop",
  elev: "elevated",
  gwstatus: "gateway-status",
  limit: "limits",
  plugin: "plugins",
  quit: "exit",
};

const HIDDEN_ALIAS_NAMES = new Set([
  "abort",
  "elev",
  "export",
  "footer",
  "gwstatus",
  "id",
  "limit",
  "plugin",
  "provider",
  "quit",
  "q",
  "reason",
  "t",
  "tell",
  "thinking",
  "trajectory",
  "v",
]);

function createLevelCompletion(
  levels: string[],
): NonNullable<SlashCommand["getArgumentCompletions"]> {
  return (prefix) =>
    levels
      .filter((value) => value.startsWith(normalizeLowercaseStringOrEmpty(prefix)))
      .map((value) => ({
        value,
        label: value,
      }));
}

function normalizeSlashCommandName(value: string): string {
  return value.replace(/^\//, "").trim();
}

function appendSlashCommand(
  commands: SlashCommand[],
  seen: Set<string>,
  name: string,
  description: string,
) {
  const normalizedName = normalizeSlashCommandName(name);
  if (!normalizedName || seen.has(normalizedName)) {
    return;
  }
  if (HIDDEN_ALIAS_NAMES.has(normalizedName)) {
    return;
  }
  seen.add(normalizedName);
  if (normalizedName === "memory") {
    commands.push({
      name: normalizedName,
      description,
      argumentHint: "status | sync [force] | search <query> | read <path[:line[-end]]> | dreams",
      getArgumentCompletions: (prefix) => {
        const normalizedPrefix = normalizeLowercaseStringOrEmpty(prefix);
        return MEMORY_COMMAND_COMPLETIONS.filter((item) => item.value.startsWith(normalizedPrefix));
      },
    });
    return;
  }
  if (normalizedName === "persona") {
    commands.push({
      name: normalizedName,
      description,
      argumentHint: "status | show [lines=<count>|all] | path",
      getArgumentCompletions: (prefix) => {
        const normalizedPrefix = normalizeLowercaseStringOrEmpty(prefix);
        return PERSONA_COMMAND_COMPLETIONS.filter((item) =>
          item.value.startsWith(normalizedPrefix),
        );
      },
    });
    return;
  }
  if (normalizedName === "plugins") {
    commands.push({
      name: normalizedName,
      description,
      argumentHint: "list | verbose | show <plugin>",
      getArgumentCompletions: (prefix) => {
        const normalizedPrefix = normalizeLowercaseStringOrEmpty(prefix);
        return PLUGIN_COMMAND_COMPLETIONS.filter((item) => item.value.startsWith(normalizedPrefix));
      },
    });
    return;
  }
  if (normalizedName === "context") {
    commands.push({
      name: normalizedName,
      description,
      argumentHint: "list | detail | json",
      getArgumentCompletions: createLevelCompletion(CONTEXT_LEVELS),
    });
    return;
  }
  commands.push({ name: normalizedName, description });
}

export function parseCommand(input: string): ParsedCommand {
  const normalizedBody = normalizeCommandBody(input);
  const trimmed = normalizedBody.replace(/^\//, "").trim();
  if (!trimmed) {
    return { name: "", args: "" };
  }
  const [name, ...rest] = trimmed.split(/\s+/);
  const normalized = normalizeLowercaseStringOrEmpty(name);
  return {
    name: COMMAND_ALIASES[normalized] ?? normalized,
    args: rest.join(" ").trim(),
  };
}

export function getSlashCommands(options: SlashCommandOptions = {}): SlashCommand[] {
  const thinkLevels = listThinkingLevelLabels(options.provider, options.model);
  const thinkCommandLevels = ["default", ...thinkLevels.filter((level) => level !== "default")];
  const verboseCompletions = createLevelCompletion(VERBOSE_LEVELS);
  const traceCompletions = createLevelCompletion(TRACE_LEVELS);
  const fastCompletions = createLevelCompletion(FAST_LEVELS);
  const reasoningCompletions = createLevelCompletion(REASONING_LEVELS);
  const usageCompletions = createLevelCompletion(USAGE_FOOTER_LEVELS);
  const elevatedCompletions = createLevelCompletion(ELEVATED_LEVELS);
  const activationCompletions = createLevelCompletion(ACTIVATION_LEVELS);
  const busyCompletions = createLevelCompletion(BUSY_LEVELS);
  const surfaceCompletions = createLevelCompletion(SURFACE_LEVELS);
  const contextCompletions = createLevelCompletion(CONTEXT_LEVELS);
  const taskCompletions = createLevelCompletion(TASK_LEVELS);
  const subagentCompletions = createLevelCompletion(SUBAGENT_LEVELS);
  const automationCompletions = createLevelCompletion(AUTOMATION_LEVELS);
  const recoverCompletions = createLevelCompletion(RECOVER_LEVELS);
  const rollbackCompletions = createLevelCompletion(ROLLBACK_LEVELS);
  const commands: SlashCommand[] = [
    {
      name: "help",
      description: "Show terminal command help",
      argumentHint: "[all]",
      getArgumentCompletions: createLevelCompletion(["all"]),
    },
    { name: "commands", description: "Show the full terminal command catalog" },
    { name: "gateway-status", description: "Show gateway status summary" },
    { name: "limits", description: "Explain context usage vs provider quotas" },
    ...(options.local ? [{ name: "auth", description: "Run provider auth/login flow" }] : []),
    { name: "agent", description: "Switch agent (or open picker)" },
    { name: "agents", description: "Open agent picker" },
    { name: "crestodian", description: "Return to Crestodian" },
    { name: "session", description: "Switch session (or open picker)" },
    {
      name: "sessions",
      description: "Open session picker",
      argumentHint: "[query]",
    },
    {
      name: "tools",
      description: "Show terminal tool catalog",
      argumentHint: "compact | verbose",
      getArgumentCompletions: surfaceCompletions,
    },
    {
      name: "skills",
      description: "Show terminal skill catalog",
      argumentHint: "compact | verbose",
      getArgumentCompletions: surfaceCompletions,
    },
    {
      name: "plugins",
      description: "Show terminal plugin status",
      argumentHint: "list | verbose | show <plugin>",
      getArgumentCompletions: (prefix) => {
        const normalizedPrefix = normalizeLowercaseStringOrEmpty(prefix);
        return PLUGIN_COMMAND_COMPLETIONS.filter((item) => item.value.startsWith(normalizedPrefix));
      },
    },
    {
      name: "tasks",
      description: "Show background tasks and repair checks",
      argumentHint: "list | running | subagents | cron | audit | repair [apply]",
      getArgumentCompletions: taskCompletions,
    },
    {
      name: "subagents",
      description: "Show running subagents and recent summaries",
      argumentHint: "list | running | queued | failed | lost | all",
      getArgumentCompletions: subagentCompletions,
    },
    {
      name: "automation",
      description: "Show scheduled/background automation",
      argumentHint: "list | running | queued | failed | audit",
      getArgumentCompletions: automationCompletions,
    },
    {
      name: "recover",
      description: "Run self-healing task and Task Flow recovery",
      argumentHint: "status | apply",
      getArgumentCompletions: recoverCompletions,
    },
    {
      name: "rollback",
      description: "Inspect or restore session checkpoints",
      argumentHint: "list | show <id> | branch <id> | restore <id> confirm",
      getArgumentCompletions: rollbackCompletions,
    },
    {
      name: "model",
      description: "Set model (or open picker)",
    },
    { name: "models", description: "Open model picker" },
    {
      name: "context",
      description: "Explain assembled context",
      argumentHint: "list | detail | json",
      getArgumentCompletions: contextCompletions,
    },
    {
      name: "think",
      description: "Set thinking level or reset to default",
      argumentHint: "default | " + formatThinkingLevels(options.provider, options.model, " | "),
      getArgumentCompletions: (prefix) =>
        thinkCommandLevels
          .filter((v) => v.startsWith(normalizeLowercaseStringOrEmpty(prefix)))
          .map((value) => ({ value, label: value })),
    },
    {
      name: "fast",
      description: "Set fast mode on/off/default",
      getArgumentCompletions: fastCompletions,
    },
    {
      name: "verbose",
      description: "Set verbose on/off/full",
      getArgumentCompletions: verboseCompletions,
    },
    {
      name: "trace",
      description: "Set trace on/off",
      getArgumentCompletions: traceCompletions,
    },
    {
      name: "reasoning",
      description: "Set reasoning on/off",
      getArgumentCompletions: reasoningCompletions,
    },
    {
      name: "usage",
      description: "Show usage or configure the per-response usage line",
      argumentHint: "[off|tokens|full|cost]",
      getArgumentCompletions: usageCompletions,
    },
    {
      name: "elevated",
      description: "Set elevated on/off/ask/full",
      getArgumentCompletions: elevatedCompletions,
    },
    {
      name: "activation",
      description: "Set group activation",
      getArgumentCompletions: activationCompletions,
    },
    {
      name: "busy",
      description: "Control input while a run is active",
      getArgumentCompletions: busyCompletions,
    },
    { name: "stop", description: "Stop active run" },
    { name: "new", description: "Start a new session" },
    { name: "reset", description: "Reset the session" },
    { name: "settings", description: "Open settings" },
    { name: "exit", description: "Exit the TUI" },
  ];

  const seen = new Set(commands.map((command) => command.name));
  const gatewayCommands = options.cfg ? listChatCommandsForConfig(options.cfg) : listChatCommands();
  for (const command of gatewayCommands) {
    const aliases = command.textAliases.length > 0 ? command.textAliases : [`/${command.key}`];
    appendSlashCommand(commands, seen, aliases[0] ?? `/${command.key}`, command.description);
  }

  for (const command of options.dynamicCommands ?? []) {
    const aliases = command.textAliases?.length ? command.textAliases : [command.name];
    appendSlashCommand(commands, seen, aliases[0] ?? command.name, command.description);
  }

  return commands;
}

export function commandCatalogText(options: SlashCommandOptions = {}): string {
  const commands = getSlashCommands(options).toSorted((left, right) =>
    left.name.localeCompare(right.name),
  );
  const lines = [
    `Kova command catalog (${commands.length})`,
    "Use /help for essentials; aliases still work.",
    "",
  ];
  for (const command of commands) {
    const hint = command.argumentHint ? ` ${command.argumentHint}` : "";
    lines.push(`/${command.name}${hint} - ${command.description}`);
  }
  return lines.join("\n");
}

export function helpText(options: SlashCommandOptions & { verbose?: boolean } = {}): string {
  const thinkLevels = formatThinkingLevels(options.provider, options.model, "|");
  if (!options.verbose) {
    return [
      "Kova terminal controls",
      "",
      "Core:",
      "/status - current session and runtime state",
      "/new - start a fresh session",
      "/stop - stop the active run",
      "/settings - terminal preferences",
      "",
      "Navigate:",
      "/agent <id> or /agents",
      "/session <key> or /sessions [query]",
      "/model <provider/model> or /models",
      "",
      "Inspect:",
      "/memory - memory health and commands",
      "/limits - context window vs provider quota",
      "/tools - runtime tools",
      "/skills - loaded skills",
      "/tasks - background work",
      "/plugins - plugin status",
      "",
      "Control:",
      `/think <default|${thinkLevels}>`,
      "/fast <status|on|off|default>",
      "/busy <status|queue|steer|interrupt|clear>",
      "",
      "More: /commands, /help all, /gateway-status, /automation, /recover, /rollback",
      "Short aliases still work; /commands opens the full catalog.",
    ].join("\n");
  }
  return [
    "Kova terminal controls:",
    "/help",
    "/commands",
    "/status",
    "/gateway-status",
    "/limits",
    ...(options.local ? ["/auth [provider]"] : []),
    "/agent <id> (or /agents)",
    "/crestodian [request]",
    "/session <key> (or /sessions [query])",
    "/model <provider/model> (or /models)",
    "/tools [compact|verbose]",
    "/skills [compact|verbose]",
    "/tasks [list|running|subagents|cron|audit|repair [apply]]",
    "/subagents [list|running|queued|failed|lost|all]",
    "/automation [list|running|queued|failed|audit]",
    "/recover [status|apply]",
    "/rollback [list|show <id>|branch <id>|restore <id> confirm]",
    "/context [list|detail|json]",
    "/memory [status|help|sync [force]|search <query>|read <path[:line[-end]]>|dreams]",
    "/persona <status|show [lines=<count>|all]|path>",
    "/skill <name> [args]",
    "/plugins [list|verbose|show <plugin>]",
    "",
    "Run controls:",
    `/think <default|${thinkLevels}>`,
    "/fast <status|on|off|default>",
    "/verbose <on|off|full>",
    "/trace <on|off>",
    "/reasoning <on|off>",
    "/usage [off|tokens|full|cost] (alias: /footer)",
    "/elevated <on|off|ask|full>",
    "/activation <mention|always>",
    "/busy <status|queue|steer|interrupt|clear>",
    "/new",
    "/reset",
    "/stop",
    "/settings",
    "/exit",
    "",
    "Short aliases still work.",
  ].join("\n");
}
