import type { SlashCommand } from "@mariozechner/pi-tui";
import {
  listChatCommands,
  listChatCommandsForConfig,
} from "../auto-reply/commands-registry-list.js";
import { formatThinkingLevels, listThinkingLevelLabels } from "../auto-reply/thinking.js";
import type { KovaConfig } from "../config/types.js";
import type { CommandEntry } from "../gateway/protocol/index.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";

const VERBOSE_LEVELS = ["on", "off"];
const TRACE_LEVELS = ["on", "off"];
const FAST_LEVELS = ["status", "on", "off"];
const REASONING_LEVELS = ["on", "off"];
const ELEVATED_LEVELS = ["on", "off", "ask", "full"];
const ACTIVATION_LEVELS = ["mention", "always"];
const USAGE_FOOTER_LEVELS = ["off", "tokens", "full"];
const BUSY_LEVELS = ["status", "queue", "steer", "interrupt", "clear"];
const SURFACE_LEVELS = ["compact", "verbose"];
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
    value: "help",
    label: "help",
    description: "Show memory command help",
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
  commands: "help",
  elev: "elevated",
  gwstatus: "gateway-status",
  quit: "exit",
};

const HIDDEN_ALIAS_NAMES = new Set([
  "abort",
  "commands",
  "elev",
  "export",
  "gwstatus",
  "id",
  "plugin",
  "quit",
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
      argumentHint: "status | sync [force] | search <query> | read <path[:line[-end]]>",
      getArgumentCompletions: (prefix) => {
        const normalizedPrefix = normalizeLowercaseStringOrEmpty(prefix);
        return MEMORY_COMMAND_COMPLETIONS.filter((item) => item.value.startsWith(normalizedPrefix));
      },
    });
    return;
  }
  commands.push({ name: normalizedName, description });
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.replace(/^\//, "").trim();
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
  const verboseCompletions = createLevelCompletion(VERBOSE_LEVELS);
  const traceCompletions = createLevelCompletion(TRACE_LEVELS);
  const fastCompletions = createLevelCompletion(FAST_LEVELS);
  const reasoningCompletions = createLevelCompletion(REASONING_LEVELS);
  const usageCompletions = createLevelCompletion(USAGE_FOOTER_LEVELS);
  const elevatedCompletions = createLevelCompletion(ELEVATED_LEVELS);
  const activationCompletions = createLevelCompletion(ACTIVATION_LEVELS);
  const busyCompletions = createLevelCompletion(BUSY_LEVELS);
  const surfaceCompletions = createLevelCompletion(SURFACE_LEVELS);
  const taskCompletions = createLevelCompletion(TASK_LEVELS);
  const recoverCompletions = createLevelCompletion(RECOVER_LEVELS);
  const rollbackCompletions = createLevelCompletion(ROLLBACK_LEVELS);
  const commands: SlashCommand[] = [
    { name: "help", description: "Show slash command help" },
    { name: "gateway-status", description: "Show gateway status summary" },
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
      name: "tasks",
      description: "Show background tasks and repair checks",
      argumentHint: "list | running | subagents | cron | audit | repair [apply]",
      getArgumentCompletions: taskCompletions,
    },
    {
      name: "subagents",
      description: "Show running subagents and recent summaries",
      argumentHint: "list",
      getArgumentCompletions: taskCompletions,
    },
    {
      name: "automation",
      description: "Show scheduled/background automation",
      argumentHint: "list | running | audit",
      getArgumentCompletions: taskCompletions,
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
      name: "think",
      description: "Set thinking level",
      getArgumentCompletions: (prefix) =>
        thinkLevels
          .filter((v) => v.startsWith(normalizeLowercaseStringOrEmpty(prefix)))
          .map((value) => ({ value, label: value })),
    },
    {
      name: "fast",
      description: "Set fast mode on/off",
      getArgumentCompletions: fastCompletions,
    },
    {
      name: "verbose",
      description: "Set verbose on/off",
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
      description: "Toggle per-response usage line",
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

export function helpText(options: SlashCommandOptions = {}): string {
  const thinkLevels = formatThinkingLevels(options.provider, options.model, "|");
  return [
    "Kova terminal controls:",
    "/help",
    "/status",
    "/gateway-status",
    ...(options.local ? ["/auth [provider]"] : []),
    "/agent <id> (or /agents)",
    "/crestodian [request]",
    "/session <key> (or /sessions [query])",
    "/model <provider/model> (or /models)",
    "/tools [compact|verbose]",
    "/skills [compact|verbose]",
    "/tasks [list|running|subagents|cron|audit|repair [apply]]",
    "/subagents [list]",
    "/automation [list|running|audit]",
    "/recover [status|apply]",
    "/rollback [list|show <id>|branch <id>|restore <id> confirm]",
    "/context [compact|verbose]",
    "/memory <status|sync [force]|search <query>|read <path[:line[-end]]>>",
    "/skill <name> [args]",
    "/plugins list",
    "",
    "Run controls:",
    `/think <${thinkLevels}>`,
    "/fast <status|on|off>",
    "/verbose <on|off>",
    "/trace <on|off>",
    "/reasoning <on|off>",
    "/usage <off|tokens|full>",
    "/elevated <on|off|ask|full>",
    "/activation <mention|always>",
    "/busy <status|queue|steer|interrupt|clear>",
    "/new",
    "/reset",
    "/stop",
    "/settings",
    "/exit",
    "",
    "Short aliases still work; the commands alias opens help.",
  ].join("\n");
}
