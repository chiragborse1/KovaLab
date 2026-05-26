import { randomUUID } from "node:crypto";
import type { Component, SelectItem, TUI } from "@mariozechner/pi-tui";
import { normalizeGroupActivation } from "../auto-reply/group-activation.js";
import {
  formatThinkingLevels,
  isSessionDefaultDirectiveValue,
  normalizeUsageDisplay,
  resolveResponseUsageMode,
} from "../auto-reply/thinking.js";
import type { SessionsPatchResult } from "../gateway/protocol/index.js";
import { formatRelativeTimestamp } from "../infra/format-time/format-relative.ts";
import { formatPermissionSummary } from "../permissions/summary.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { formatTokenCount } from "../utils/usage-format.js";
import { commandCatalogText, helpText, parseCommand } from "./commands.js";
import type { ApprovalDecision } from "./components/approval-event.js";
import type { ChatLog } from "./components/chat-log.js";
import {
  createFilterableSelectList,
  createSearchableSelectList,
  createSettingsList,
} from "./components/selectors.js";
import type { TuiBackend } from "./tui-backend.js";
import { formatContextUsageLine, sanitizeRenderableText } from "./tui-formatters.js";
import {
  formatMaintenanceSummary,
  formatSelfHealingReport,
  formatTaskAudit,
  normalizeRecoveryAction,
} from "./tui-self-healing.js";
import { formatStatusSummary } from "./tui-status-summary.js";
import type {
  AgentSummary,
  GatewayStatusSummary,
  QueuedMessage,
  TuiBusyInputMode,
  TuiResult,
  TuiOptions,
  TuiStateAccess,
} from "./tui-types.js";

type TuiToolCatalog = Awaited<ReturnType<NonNullable<TuiBackend["listTools"]>>>;
type TuiSkillStatus = Awaited<ReturnType<NonNullable<TuiBackend["listSkills"]>>>;
type TuiPluginStatus = Awaited<ReturnType<NonNullable<TuiBackend["listPlugins"]>>>;
type TuiTasksList = Awaited<ReturnType<NonNullable<TuiBackend["listTasks"]>>>;
type TuiConfigSnapshot = Awaited<ReturnType<NonNullable<TuiBackend["getConfig"]>>>;
type TuiSessionCheckpointList = Awaited<
  ReturnType<NonNullable<TuiBackend["listSessionCheckpoints"]>>
>;
type TuiSessionCheckpointResult = Awaited<
  ReturnType<NonNullable<TuiBackend["getSessionCheckpoint"]>>
>;
type TuiSessionPatch = Parameters<TuiBackend["patchSession"]>[0];

type PermissionPresetName = "locked" | "reviewed" | "balanced" | "trusted";
type PermissionSessionPatch = Pick<TuiSessionPatch, "execHost" | "execSecurity" | "execAsk">;

const PERMISSION_PRESETS: Record<
  PermissionPresetName,
  {
    label: string;
    description: string;
    patch: Required<PermissionSessionPatch>;
  }
> = {
  locked: {
    label: "Locked",
    description: "Deny host exec for this session",
    patch: { execHost: "gateway", execSecurity: "deny", execAsk: "off" },
  },
  reviewed: {
    label: "Reviewed",
    description: "Ask before every host exec",
    patch: { execHost: "gateway", execSecurity: "allowlist", execAsk: "always" },
  },
  balanced: {
    label: "Balanced",
    description: "Allow trusted commands, ask on misses",
    patch: { execHost: "gateway", execSecurity: "allowlist", execAsk: "on-miss" },
  },
  trusted: {
    label: "Trusted",
    description: "No exec prompts for this trusted session",
    patch: { execHost: "gateway", execSecurity: "full", execAsk: "off" },
  },
};

const PERMISSION_PRESET_ALIASES: Record<string, PermissionPresetName> = {
  balanced: "balanced",
  cautious: "balanced",
  deny: "locked",
  "deny-all": "locked",
  full: "trusted",
  locked: "locked",
  reviewed: "reviewed",
  safe: "reviewed",
  trusted: "trusted",
  yolo: "trusted",
};

type CommandHandlerContext = {
  client: TuiBackend;
  chatLog: ChatLog;
  tui: TUI;
  opts: TuiOptions;
  state: TuiStateAccess;
  deliverDefault: boolean;
  openOverlay: (component: Component) => void;
  closeOverlay: () => void;
  refreshSessionInfo: () => Promise<void>;
  loadHistory: () => Promise<void>;
  setSession: (key: string) => Promise<void>;
  refreshAgents: () => Promise<void>;
  abortActive: () => Promise<void>;
  setActivityStatus: (text: string) => void;
  formatSessionKey: (key: string) => string;
  applySessionInfoFromPatch: (result: SessionsPatchResult) => void;
  noteLocalRunId?: (runId: string) => void;
  noteLocalBtwRunId?: (runId: string) => void;
  forgetLocalRunId?: (runId: string) => void;
  forgetLocalBtwRunId?: (runId: string) => void;
  runAuthFlow?: (params: {
    provider?: string;
  }) => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
  requestExit: (result?: Partial<TuiResult>) => void;
};

function isBtwCommand(text: string): boolean {
  return /^\/btw(?::|\s|$)/i.test(text.trim());
}

function normalizeBusyInputMode(value: string): TuiBusyInputMode | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "queue" || normalized === "followup" || normalized === "follow-up") {
    return "queue";
  }
  if (normalized === "steer" || normalized === "steering") {
    return "steer";
  }
  if (normalized === "interrupt" || normalized === "abort") {
    return "interrupt";
  }
  return null;
}

function formatQueuedFollowUpCount(count: number): string {
  return `${count} queued follow-up${count === 1 ? "" : "s"}`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

function truncateLine(text: string, maxLength = 120): string {
  const cleaned = sanitizeRenderableText(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatNamePreview(names: string[], limit: number): string {
  const visible = names
    .map((name) => sanitizeRenderableText(name).trim())
    .filter((name) => name.length > 0)
    .slice(0, limit);
  if (visible.length === 0) {
    return "";
  }
  const remaining = names.length - visible.length;
  return remaining > 0 ? `${visible.join(", ")}, +${String(remaining)} more` : visible.join(", ");
}

function normalizePermissionPresetName(value: string): PermissionPresetName | null {
  const normalized = normalizeLowercaseStringOrEmpty(value);
  return PERMISSION_PRESET_ALIASES[normalized] ?? null;
}

function formatPermissionPatch(patch: PermissionSessionPatch): string {
  return [
    patch.execHost ? `host=${patch.execHost}` : "",
    patch.execSecurity ? `security=${patch.execSecurity}` : "",
    patch.execAsk ? `ask=${patch.execAsk}` : "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");
}

function formatApprovalDecisionLabel(decision: ApprovalDecision): string {
  switch (decision) {
    case "allow-once":
      return "Allow once";
    case "allow-always":
      return "Allow always";
    case "deny":
      return "Deny";
  }
  return sanitizeRenderableText(decision);
}

function normalizeSurfaceMode(args: string): "compact" | "verbose" | null {
  const normalized = args.trim().toLowerCase();
  if (!normalized || normalized === "compact") {
    return "compact";
  }
  if (normalized === "verbose") {
    return "verbose";
  }
  return null;
}

type DetailsMode = "hidden" | "collapsed" | "expanded";

function normalizeDetailsMode(value: string): DetailsMode | "cycle" | "status" | null {
  const normalized = normalizeLowercaseStringOrEmpty(value);
  if (!normalized || normalized === "status") {
    return "status";
  }
  if (normalized === "hide" || normalized === "hidden" || normalized === "off") {
    return "hidden";
  }
  if (normalized === "collapse" || normalized === "collapsed" || normalized === "on") {
    return "collapsed";
  }
  if (normalized === "expand" || normalized === "expanded" || normalized === "full") {
    return "expanded";
  }
  if (normalized === "cycle" || normalized === "toggle") {
    return "cycle";
  }
  return null;
}

function normalizeVerboseDetailsMode(value: string): DetailsMode | "cycle" | null {
  const normalized = normalizeLowercaseStringOrEmpty(value);
  if (!normalized || normalized === "cycle" || normalized === "toggle") {
    return "cycle";
  }
  if (normalized === "off" || normalized === "hidden" || normalized === "silent") {
    return "hidden";
  }
  if (
    normalized === "on" ||
    normalized === "new" ||
    normalized === "all" ||
    normalized === "collapsed"
  ) {
    return "collapsed";
  }
  if (normalized === "full" || normalized === "verbose" || normalized === "expanded") {
    return "expanded";
  }
  return null;
}

function formatToolCatalog(result: TuiToolCatalog, mode: "compact" | "verbose"): string {
  const groups = Array.isArray(result.groups) ? result.groups : [];
  const totalTools = groups.reduce((sum, group) => sum + group.tools.length, 0);
  const lines = [
    `Tools: ${plural(totalTools, "tool")} across ${plural(groups.length, "group")} for agent ${result.agentId}`,
  ];
  if (groups.length === 0) {
    lines.push("No tools are currently exposed.");
    return lines.join("\n");
  }

  for (const group of groups) {
    const preview =
      mode === "compact"
        ? formatNamePreview(
            group.tools.map((tool) => tool.id),
            6,
          )
        : "";
    lines.push(
      `- ${group.label}: ${plural(group.tools.length, "tool")}${preview ? ` (${preview})` : ""}`,
    );
    if (mode !== "verbose") {
      continue;
    }
    for (const tool of group.tools.slice(0, 12)) {
      const description = tool.description ? ` - ${truncateLine(tool.description, 96)}` : "";
      lines.push(`  ${tool.label}${description}`);
    }
    if (group.tools.length > 12) {
      lines.push(`  and ${plural(group.tools.length - 12, "more tool")}`);
    }
  }
  if (mode === "compact") {
    lines.push("Use /tools verbose for names and short descriptions.");
  }
  return lines.join("\n");
}

function formatSkillCatalog(result: TuiSkillStatus, mode: "compact" | "verbose"): string {
  const skills = Array.isArray(result.skills) ? result.skills : [];
  const visible = skills.filter((skill) => !skill.disabled);
  const eligible = visible.filter((skill) => skill.eligible).length;
  const offline = visible.length - eligible;
  const disabled = skills.length - visible.length;
  const lines = [
    `Skills: ${plural(visible.length, "skill")} visible (${String(eligible)} ready, ${String(offline)} offline, ${String(disabled)} disabled)`,
  ];
  if (visible.length === 0) {
    lines.push("No skills are currently visible for this agent.");
    return lines.join("\n");
  }

  if (mode === "compact") {
    const bySource = new Map<string, number>();
    for (const skill of visible) {
      const source = skill.source || "workspace";
      bySource.set(source, (bySource.get(source) ?? 0) + 1);
    }
    for (const [source, count] of [...bySource.entries()].toSorted((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const names = visible
        .filter((skill) => (skill.source || "workspace") === source)
        .map((skill) => skill.name);
      const preview = formatNamePreview(names, 6);
      lines.push(`- ${source}: ${plural(count, "skill")}${preview ? ` (${preview})` : ""}`);
    }
    lines.push("Use /skills verbose for names and status.");
    return lines.join("\n");
  }

  for (const skill of visible.slice(0, 30)) {
    const status = skill.eligible ? "ready" : "offline";
    const description = skill.description ? ` - ${truncateLine(skill.description, 96)}` : "";
    lines.push(`- ${skill.name}: ${status}${description}`);
  }
  if (visible.length > 30) {
    lines.push(`- and ${plural(visible.length - 30, "more skill")}`);
  }
  return lines.join("\n");
}

type PluginsCommand =
  | { action: "list"; mode: "compact" | "verbose" }
  | { action: "show"; pluginId: string }
  | { action: "write"; command: string }
  | { action: "error"; message: string };

function parsePluginsCommand(args: string): PluginsCommand {
  const tokens = args
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  const action = (tokens[0] ?? "list").toLowerCase();
  if (tokens.length === 0 || action === "list" || action === "compact") {
    if (tokens.length > 1 && tokens[1] !== "compact" && tokens[1] !== "verbose") {
      return { action: "error", message: "usage: /plugins [list|verbose|show <plugin>]" };
    }
    return {
      action: "list",
      mode: tokens.includes("verbose") ? "verbose" : "compact",
    };
  }
  if (action === "verbose") {
    return { action: "list", mode: "verbose" };
  }
  if (action === "show" || action === "inspect" || action === "get") {
    const pluginId = tokens.slice(1).join(" ").trim();
    if (!pluginId || pluginId.toLowerCase() === "all") {
      return { action: "list", mode: "verbose" };
    }
    return { action: "show", pluginId };
  }
  if (["install", "update", "enable", "disable", "uninstall", "remove"].includes(action)) {
    return { action: "write", command: args.trim() };
  }
  return { action: "error", message: "usage: /plugins [list|verbose|show <plugin>]" };
}

function formatPluginKind(kind: string | string[] | undefined): string {
  if (Array.isArray(kind)) {
    return kind.length > 0 ? kind.join(", ") : "none";
  }
  return kind?.trim() || "none";
}

function formatPluginList(result: TuiPluginStatus, mode: "compact" | "verbose"): string {
  const lines = [
    `Plugins: ${plural(result.totals.total, "plugin")} (${String(
      result.totals.enabled,
    )} enabled, ${String(result.totals.disabled)} disabled, ${String(
      result.totals.errors,
    )} error${result.totals.errors === 1 ? "" : "s"})`,
    `Registry: ${result.registrySource}`,
  ];
  if (result.plugins.length === 0) {
    lines.push("No plugins discovered.");
    return lines.join("\n");
  }

  const plugins = result.plugins.toSorted((left, right) => {
    const leftRank = left.status === "error" ? 0 : left.status === "loaded" ? 1 : 2;
    const rightRank = right.status === "error" ? 0 : right.status === "loaded" ? 1 : 2;
    return leftRank - rightRank || left.id.localeCompare(right.id);
  });
  const visible = mode === "verbose" ? plugins : plugins.slice(0, 14);
  for (const plugin of visible) {
    const details =
      mode === "verbose"
        ? `; kind ${formatPluginKind(plugin.kind)}; ${String(plugin.toolNames.length)} tools; ${String(
            plugin.commands.length,
          )} commands`
        : "";
    lines.push(`- ${plugin.id}: ${plugin.status}${plugin.enabled ? "" : " disabled"}${details}`);
  }
  if (visible.length < plugins.length) {
    lines.push(`- and ${plural(plugins.length - visible.length, "more plugin")}`);
  }
  if (result.diagnostics.length > 0) {
    lines.push(`Diagnostics: ${plural(result.diagnostics.length, "item")}; use /plugins verbose.`);
  }
  lines.push("Use /plugins show <id> for details.");
  return lines.join("\n");
}

function formatPluginDetails(result: TuiPluginStatus, pluginId: string): string {
  const normalized = pluginId.trim().toLowerCase();
  const plugin = result.plugins.find(
    (entry) => entry.id.toLowerCase() === normalized || entry.name.toLowerCase() === normalized,
  );
  if (!plugin) {
    return `Plugin not found: ${pluginId}`;
  }
  const lines = [
    `Plugin: ${plugin.name} (${plugin.id})`,
    `Status: ${plugin.status}${plugin.enabled ? " enabled" : " disabled"}`,
    `Origin: ${plugin.origin}${plugin.version ? ` ${plugin.version}` : ""}`,
    `Kind: ${formatPluginKind(plugin.kind)}`,
    `Format: ${plugin.format ?? "kova"}${plugin.bundleFormat ? `/${plugin.bundleFormat}` : ""}`,
    `Config: ${plugin.configured ? "configured" : "not configured"}; schema ${
      plugin.configSchema ? "yes" : "no"
    }`,
    `Installed: ${plugin.installed ? "yes" : "no"}; removable ${plugin.removable ? "yes" : "no"}`,
  ];
  if (plugin.description) {
    lines.push(`Description: ${truncateLine(plugin.description, 160)}`);
  }
  if (plugin.channelIds.length > 0) {
    lines.push(`Channels: ${plugin.channelIds.join(", ")}`);
  }
  if (plugin.providerIds.length > 0) {
    lines.push(`Providers: ${plugin.providerIds.join(", ")}`);
  }
  if (plugin.toolNames.length > 0) {
    lines.push(`Tools: ${plugin.toolNames.slice(0, 18).join(", ")}`);
  }
  if (plugin.commands.length > 0) {
    lines.push(`Commands: ${plugin.commands.slice(0, 18).join(", ")}`);
  }
  if (plugin.error) {
    lines.push(`Error: ${truncateLine(plugin.error, 180)}`);
  }
  return lines.join("\n");
}

function formatLimitsSummary(state: TuiStateAccess): string {
  const info = state.sessionInfo;
  const total = info.totalTokens ?? null;
  const context = info.contextTokens ?? null;
  const remaining =
    typeof total === "number" && typeof context === "number" ? Math.max(0, context - total) : null;
  const percent =
    typeof total === "number" && typeof context === "number" && context > 0
      ? (total / context) * 100
      : null;
  const model = [info.modelProvider, info.model].filter(Boolean).join("/") || "current model";
  return [
    "Limits",
    `- Context window: ${formatContextUsageLine({ total, context, remaining, percent })}`,
    `- Model: ${model}`,
    "- This is the model context window, not your provider account quota.",
    "- Provider quotas/rate limits come from the provider and may not be exposed to Kova.",
    "- Shell check when available: kova status --usage",
  ].join("\n");
}

function formatUsageTokenCount(value?: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? formatTokenCount(value) : "?";
}

function formatUsageSummary(state: TuiStateAccess): string {
  const info = state.sessionInfo;
  const total = info.totalTokens ?? null;
  const context = info.contextTokens ?? null;
  const remaining =
    typeof total === "number" && typeof context === "number" ? Math.max(0, context - total) : null;
  const percent =
    typeof total === "number" && typeof context === "number" && context > 0
      ? (total / context) * 100
      : null;
  const model = [info.modelProvider, info.model].filter(Boolean).join("/") || "current model";
  const footerMode = resolveResponseUsageMode(info.responseUsage);
  return [
    "Usage",
    `- Footer: ${footerMode}`,
    `- Last turn: ${formatUsageTokenCount(info.inputTokens)} in / ${formatUsageTokenCount(
      info.outputTokens,
    )} out`,
    `- Context: ${formatContextUsageLine({ total, context, remaining, percent })}`,
    `- Model: ${model}`,
    "- Configure footer: /usage tokens, /usage full, /usage off",
    "- Cost summary: /usage cost",
    "- Full runtime status: /status full",
  ].join("\n");
}

function formatPulseSummary(status: unknown): string {
  const lines = ["Kova Pulse"];
  if (typeof status === "string") {
    lines.push(`- runtime: ${status}`);
  } else if (status && typeof status === "object") {
    const heartbeat = (status as GatewayStatusSummary).heartbeat;
    const agents = heartbeat?.agents ?? [];
    if (agents.length === 0) {
      lines.push("- schedule: disabled");
    } else {
      for (const agent of agents) {
        const agentId = agent.agentId ?? "unknown";
        const state = agent.enabled && agent.everyMs ? (agent.every ?? "enabled") : "disabled";
        lines.push(`- ${agentId}: ${state}`);
      }
    }
  } else {
    lines.push("- status: unavailable");
  }
  lines.push("- rules: edit PULSE.md in your workspace");
  lines.push('- run now: kova system event --mode now --text "Manual Pulse check"');
  lines.push("- controls: kova system pulse last | enable | disable");
  lines.push("- legacy heartbeat config still works as an alias");
  return lines.join("\n");
}

type TuiUpdateAction = "help" | "run" | "status";

function parseTuiUpdateAction(args: string): TuiUpdateAction | null {
  const first = normalizeLowercaseStringOrEmpty(args.trim().split(/\s+/)[0]);
  if (!first || first === "status" || first === "check" || first === "info") {
    return "status";
  }
  if (first === "run" || first === "now" || first === "yes") {
    return "run";
  }
  if (first === "help" || first === "?") {
    return "help";
  }
  return null;
}

async function formatTuiUpdateStatus(): Promise<string> {
  try {
    const { formatUpdateAvailableHint, formatUpdateOneLiner, getUpdateCheckResult } =
      await import("../commands/status.update.js");
    const update = await getUpdateCheckResult({
      timeoutMs: 3500,
      fetchGit: true,
      includeRegistry: true,
    });
    const hint = formatUpdateAvailableHint(update);
    return [
      "Kova update status",
      `- ${formatUpdateOneLiner(update).replace(/^Update:\s*/i, "")}`,
      hint ? `- ${hint}` : "- Run kova update or /update run to update.",
    ].join("\n");
  } catch (err) {
    return [
      "Kova update status",
      `- Check failed: ${sanitizeRenderableText(String(err))}`,
      "- Shell check: kova update status",
    ].join("\n");
  }
}

function formatTuiUpdateHelp(): string {
  return [
    "Usage: /update [status|run]",
    "- /update status checks the current install.",
    "- /update run starts the updater.",
    "- CLI with progress: kova update",
  ].join("\n");
}

function formatTaskAge(timestamp?: number): string {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "unknown";
  }
  return formatRelativeTimestamp(timestamp, { dateFallback: true, fallback: "unknown" });
}

function formatTaskSnapshot(result: TuiTasksList, label = "Tasks"): string {
  const tasks = Array.isArray(result.tasks) ? result.tasks : [];
  const summary = result.summary;
  const lines = [
    `${label}: ${plural(summary.total, "task")} (${String(summary.active)} active, ${String(
      summary.failures,
    )} issue${summary.failures === 1 ? "" : "s"})`,
    `Status: ${String(summary.byStatus.queued)} queued, ${String(
      summary.byStatus.running,
    )} running, ${String(summary.byStatus.failed + summary.byStatus.timed_out + summary.byStatus.lost)} failed/lost`,
    `Runtime: ${String(summary.byRuntime.subagent)} subagent, ${String(
      summary.byRuntime.cron,
    )} cron, ${String(summary.byRuntime.acp)} acp, ${String(summary.byRuntime.cli)} cli`,
  ];
  if (tasks.length === 0) {
    lines.push("No matching background work.");
    return lines.join("\n");
  }

  const priority = tasks
    .toSorted((left, right) => {
      const leftActive = left.status === "queued" || left.status === "running" ? 0 : 1;
      const rightActive = right.status === "queued" || right.status === "running" ? 0 : 1;
      if (leftActive !== rightActive) {
        return leftActive - rightActive;
      }
      return (
        (right.lastEventAt ?? right.startedAt ?? right.createdAt) -
        (left.lastEventAt ?? left.startedAt ?? left.createdAt)
      );
    })
    .slice(0, 8);
  for (const task of priority) {
    const title = truncateLine(
      task.progressSummary || task.terminalSummary || task.label || task.title,
      80,
    );
    const when = formatTaskAge(task.lastEventAt ?? task.startedAt ?? task.createdAt);
    const child = task.childSessionKey ? ` child ${truncateLine(task.childSessionKey, 34)}` : "";
    lines.push(`- ${task.id}: ${task.runtime} ${task.status} ${when}${child} - ${title}`);
  }
  if (tasks.length > priority.length) {
    lines.push(`- and ${plural(tasks.length - priority.length, "more task")}`);
  }
  if (label === "Subagents" && summary.active > 0) {
    lines.push("Completion is push-based; wait for the parent summary instead of polling.");
  }
  return lines.join("\n");
}

function formatCheckpointTokens(checkpoint: TuiSessionCheckpointResult["checkpoint"]): string {
  const before =
    typeof checkpoint.tokensBefore === "number" && Number.isFinite(checkpoint.tokensBefore)
      ? String(checkpoint.tokensBefore)
      : "?";
  const after =
    typeof checkpoint.tokensAfter === "number" && Number.isFinite(checkpoint.tokensAfter)
      ? String(checkpoint.tokensAfter)
      : "?";
  return `${before} -> ${after}`;
}

function formatCheckpointAge(timestamp: number): string {
  return formatRelativeTimestamp(timestamp, { dateFallback: true, fallback: "unknown" });
}

function formatCheckpointList(
  result: TuiSessionCheckpointList,
  formatSessionKey: (key: string) => string,
): string {
  const checkpoints = Array.isArray(result.checkpoints) ? result.checkpoints : [];
  const lines = [
    `Rollback checkpoints: ${plural(checkpoints.length, "checkpoint")} for ${formatSessionKey(
      result.key,
    )}`,
  ];
  if (checkpoints.length === 0) {
    lines.push("No checkpoints found for this session.");
    return lines.join("\n");
  }
  for (const checkpoint of checkpoints.toReversed().slice(0, 8)) {
    const summary = checkpoint.summary?.trim() ? ` - ${truncateLine(checkpoint.summary, 84)}` : "";
    lines.push(
      `- ${checkpoint.checkpointId}: ${checkpoint.reason}, ${formatCheckpointAge(
        checkpoint.createdAt,
      )}, tokens ${formatCheckpointTokens(checkpoint)}${summary}`,
    );
  }
  if (checkpoints.length > 8) {
    lines.push(`- and ${plural(checkpoints.length - 8, "older checkpoint")}`);
  }
  lines.push("Use /rollback show <id>, /rollback branch <id>, or /rollback restore <id> confirm.");
  return lines.join("\n");
}

function formatCheckpointDetails(
  result: TuiSessionCheckpointResult,
  formatSessionKey: (key: string) => string,
): string {
  const checkpoint = result.checkpoint;
  const lines = [
    `Checkpoint: ${checkpoint.checkpointId}`,
    `Session: ${formatSessionKey(result.key)}`,
    `Created: ${formatCheckpointAge(checkpoint.createdAt)}`,
    `Reason: ${checkpoint.reason}`,
    `Tokens: ${formatCheckpointTokens(checkpoint)}`,
    `Snapshot session: ${checkpoint.preCompaction.sessionId}`,
    `Current compacted session: ${checkpoint.postCompaction.sessionId}`,
  ];
  if (checkpoint.summary?.trim()) {
    lines.push(`Summary: ${truncateLine(checkpoint.summary, 180)}`);
  }
  lines.push("No changes made. Use /rollback branch <id> or /rollback restore <id> confirm.");
  return lines.join("\n");
}

type RollbackCommand =
  | { action: "list" }
  | { action: "show"; checkpointId: string }
  | { action: "branch"; checkpointId: string }
  | { action: "restore-preview"; checkpointId: string }
  | { action: "restore-confirm"; checkpointId: string };

function parseRollbackCommand(args: string): RollbackCommand | null {
  const tokens = args
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return { action: "list" };
  }
  const [firstRaw, secondRaw] = tokens;
  const first = firstRaw?.toLowerCase() ?? "";
  if (first === "list" || first === "status") {
    return { action: "list" };
  }
  if (first === "show" || first === "get" || first === "view") {
    return secondRaw ? { action: "show", checkpointId: secondRaw } : null;
  }
  if (first === "branch" || first === "fork") {
    return secondRaw ? { action: "branch", checkpointId: secondRaw } : null;
  }
  if (first === "restore") {
    if (!secondRaw) {
      return null;
    }
    const confirmed = tokens
      .slice(2)
      .some((token) => token.toLowerCase() === "confirm" || /^--?confirm$/i.test(token));
    return {
      action: confirmed ? "restore-confirm" : "restore-preview",
      checkpointId: secondRaw,
    };
  }
  if (first === "confirm") {
    return secondRaw ? { action: "restore-confirm", checkpointId: secondRaw } : null;
  }
  if (tokens.length === 1) {
    return { action: "show", checkpointId: tokens[0] ?? "" };
  }
  return null;
}

type TaskCommandTarget = "tasks" | "subagents" | "automation";

function resolveTaskListOptions(target: TaskCommandTarget, args: string) {
  const tokens = args
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  let runtime: string | undefined;
  let status: string | undefined;
  if (target === "subagents") {
    runtime = "subagent";
  }
  if (target === "automation") {
    runtime = "cron";
  }
  for (const token of tokens) {
    if (token === "list" || token === "all") {
      continue;
    }
    if (token === "subagent" || token === "subagents") {
      runtime = "subagent";
      continue;
    }
    if (token === "cron" || token === "automation") {
      runtime = "cron";
      continue;
    }
    if (token === "acp" || token === "cli") {
      runtime = token;
      continue;
    }
    if (
      token === "queued" ||
      token === "running" ||
      token === "succeeded" ||
      token === "failed" ||
      token === "timed_out" ||
      token === "cancelled" ||
      token === "lost"
    ) {
      status = token;
    }
  }
  return { runtime, status, limit: 50 };
}

export function createCommandHandlers(context: CommandHandlerContext) {
  const {
    client,
    chatLog,
    tui,
    opts,
    state,
    deliverDefault,
    openOverlay,
    closeOverlay,
    refreshSessionInfo,
    loadHistory,
    setSession,
    refreshAgents,
    abortActive,
    setActivityStatus,
    formatSessionKey,
    applySessionInfoFromPatch,
    noteLocalBtwRunId,
    forgetLocalRunId,
    forgetLocalBtwRunId,
    runAuthFlow,
    requestExit,
  } = context;

  const getQueuedMessages = () => {
    if (!Array.isArray(state.queuedMessages)) {
      state.queuedMessages = [];
    }
    return state.queuedMessages;
  };

  const getBusyInputMode = (): TuiBusyInputMode => state.busyInputMode ?? "queue";

  const queueMessage = (text: string, origin: "busy" | "manual" = "manual") => {
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }
    const queued: QueuedMessage = {
      runId: `queued-${randomUUID()}`,
      text: trimmed,
      mode: "followUp",
    };
    const queue = getQueuedMessages();
    queue.push(queued);
    state.queuedMessages = queue;
    const count = queue.length;
    const prefix = origin === "busy" ? "run active; " : "";
    chatLog.addSystem(`${prefix}queued follow-up (${count}). /busy status shows the queue.`);
    setActivityStatus(formatQueuedFollowUpCount(count));
    tui.requestRender();
    return true;
  };

  const dequeueQueuedMessage = () => {
    const queue = getQueuedMessages();
    const next = queue.pop();
    state.queuedMessages = queue;
    const count = queue.length;
    setActivityStatus(next ? `restored queued follow-up (${count} left)` : "no queued follow-ups");
    tui.requestRender();
    return next?.text ?? null;
  };

  const clearQueuedMessages = () => {
    const count = getQueuedMessages().length;
    state.queuedMessages = [];
    chatLog.addSystem(
      count ? `cleared ${formatQueuedFollowUpCount(count)}` : "no queued follow-ups",
    );
    setActivityStatus("queue cleared");
    tui.requestRender();
  };

  const steerMessage = async (text: string) => {
    const steerChat = client.steerChat;
    if (typeof steerChat !== "function") {
      return false;
    }
    try {
      const result = await steerChat({
        sessionKey: state.currentSessionKey,
        message: text,
      });
      if (!result.ok) {
        const reason = result.reason ? ` (${result.reason})` : "";
        chatLog.addSystem(`steer unavailable${reason}; queued follow-up instead`);
        return false;
      }
      chatLog.addSystem("steered active run");
      setActivityStatus("steered active run");
      tui.requestRender();
      return true;
    } catch (err) {
      chatLog.addSystem(`steer failed: ${sanitizeRenderableText(String(err))}`);
      return false;
    }
  };

  const setAgent = async (id: string) => {
    state.currentAgentId = normalizeAgentId(id);
    await setSession("");
    chatLog.addSystem(`agent set to ${state.currentAgentId}`);
  };

  const closeOverlayAndRender = () => {
    closeOverlay();
    tui.requestRender();
  };

  const openSelector = (
    selector: {
      onSelect?: (item: SelectItem) => void;
      onCancel?: () => void;
    },
    onSelect: (value: string) => Promise<void>,
  ) => {
    selector.onSelect = (item) => {
      void (async () => {
        await onSelect(item.value);
        closeOverlayAndRender();
      })();
    };
    selector.onCancel = closeOverlayAndRender;
    openOverlay(selector as Component);
    tui.requestRender();
  };

  const openModelSelector = async () => {
    try {
      const models = await client.listModels();
      if (models.length === 0) {
        chatLog.addSystem("no models available");
        tui.requestRender();
        return;
      }
      const items = models.map((model) => ({
        value: `${model.provider}/${model.id}`,
        label: `${model.provider}/${model.id}`,
        description: model.name && model.name !== model.id ? model.name : "",
      }));
      const selector = createSearchableSelectList(items, 9);
      openSelector(selector, async (value) => {
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            model: value,
          });
          chatLog.addSystem(`model set to ${value}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`model set failed: ${String(err)}`);
        }
      });
    } catch (err) {
      chatLog.addSystem(`model list failed: ${String(err)}`);
      tui.requestRender();
    }
  };

  const openAgentSelector = async () => {
    await refreshAgents();
    if (state.agents.length === 0) {
      chatLog.addSystem("no agents found");
      tui.requestRender();
      return;
    }
    const items = state.agents.map((agent: AgentSummary) => ({
      value: agent.id,
      label: agent.name ? `${agent.id} (${agent.name})` : agent.id,
      description: agent.id === state.agentDefaultId ? "default" : "",
    }));
    const selector = createSearchableSelectList(items, 9);
    openSelector(selector, async (value) => {
      await setAgent(value);
    });
  };

  const openContextModeSelector = () => {
    const items = [
      {
        value: "list",
        label: "list",
        description: "Short context breakdown",
      },
      {
        value: "detail",
        label: "detail",
        description: "Per-file, per-tool, per-skill, and system prompt size",
      },
      {
        value: "json",
        label: "json",
        description: "Machine-readable context report",
      },
    ];
    const selector = createSearchableSelectList(items, 9);
    openSelector(selector, async (value) => {
      await sendMessage(`/context ${value}`);
    });
  };

  const sendApprovalDecision = async (approvalId: string, decision: ApprovalDecision) => {
    await sendMessage(`/approve ${approvalId} ${decision}`, { queueIfBusy: false });
  };

  const openApprovalDecisionSelector = (approvalId: string) => {
    const approval = chatLog.findPendingApproval(approvalId);
    if (!approval) {
      chatLog.addSystem(`no pending approval found for ${sanitizeRenderableText(approvalId)}`);
      tui.requestRender();
      return;
    }
    const items = approval.allowedDecisions.map((decision) => ({
      value: decision,
      label: formatApprovalDecisionLabel(decision),
      description:
        decision === "allow-once"
          ? "Allow this command one time"
          : decision === "allow-always"
            ? "Add durable trust for matching future commands"
            : "Block this command",
    }));
    const selector = createSearchableSelectList(items, Math.min(5, Math.max(3, items.length)));
    openSelector(selector, async (value) => {
      await sendApprovalDecision(approval.commandId, value as ApprovalDecision);
    });
  };

  const openApprovalSelector = () => {
    const approvals = chatLog.listPendingApprovals();
    if (approvals.length === 0) {
      chatLog.addSystem("no pending approvals");
      tui.requestRender();
      return;
    }
    if (approvals.length === 1) {
      openApprovalDecisionSelector(approvals[0]?.commandId ?? "");
      return;
    }
    const items = approvals.map((approval) => ({
      value: approval.commandId,
      label: `${approval.commandId} - ${approval.title}`,
      description: truncateLine(approval.command ?? approval.message ?? approval.host ?? "", 90),
    }));
    const selector = createSearchableSelectList(items, 9);
    selector.onSelect = (item) => {
      closeOverlayAndRender();
      openApprovalDecisionSelector(item.value);
    };
    selector.onCancel = closeOverlayAndRender;
    openOverlay(selector);
    tui.requestRender();
  };

  const showToolsCatalog = async (args: string) => {
    const mode = normalizeSurfaceMode(args);
    if (!mode) {
      chatLog.addSystem("usage: /tools [compact|verbose]");
      return;
    }
    if (!client.listTools) {
      await sendMessage(args ? `/tools ${args}` : "/tools", { queueIfBusy: false });
      return;
    }
    try {
      const result = await client.listTools({
        agentId: state.currentAgentId,
        includePlugins: mode === "verbose",
      });
      chatLog.addSystem(formatToolCatalog(result, mode));
    } catch (err) {
      chatLog.addSystem(`tools catalog failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const showSkillCatalog = async (args: string) => {
    const mode = normalizeSurfaceMode(args);
    if (!mode) {
      chatLog.addSystem("usage: /skills [compact|verbose]");
      return;
    }
    if (!client.listSkills) {
      await sendMessage(args ? `/skills ${args}` : "/skills", { queueIfBusy: false });
      return;
    }
    try {
      const result = await client.listSkills({ agentId: state.currentAgentId });
      chatLog.addSystem(formatSkillCatalog(result, mode));
    } catch (err) {
      chatLog.addSystem(`skills catalog failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const showPlugins = async (args: string) => {
    const command = parsePluginsCommand(args);
    if (command.action === "error") {
      chatLog.addSystem(command.message);
      return;
    }
    if (command.action === "write") {
      const suffix = command.command ? ` ${command.command}` : "";
      chatLog.addSystem(
        `plugin writes are CLI-owned in the terminal for now; use: kova plugins${suffix}`,
      );
      return;
    }
    if (!client.listPlugins) {
      chatLog.addSystem("plugins status is unavailable in this backend");
      return;
    }
    try {
      const result = await client.listPlugins();
      chatLog.addSystem(
        command.action === "show"
          ? formatPluginDetails(result, command.pluginId)
          : formatPluginList(result, command.mode),
      );
    } catch (err) {
      chatLog.addSystem(`plugins status failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const showPulse = async (args: string) => {
    const action = normalizeLowercaseStringOrEmpty(args.trim().split(/\s+/)[0] ?? "");
    if (action === "last" || action === "enable" || action === "disable" || action === "run") {
      const command =
        action === "run"
          ? 'kova system event --mode now --text "Manual Pulse check"'
          : `kova system pulse ${action}`;
      chatLog.addSystem(`Pulse ${action} is CLI-owned for now.\nUse: ${command}`);
      return;
    }
    try {
      const status = await client.getGatewayStatus();
      chatLog.addSystem(formatPulseSummary(status));
    } catch (err) {
      chatLog.addSystem(`Pulse status failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const showPermissions = async () => {
    let configSnapshot: TuiConfigSnapshot | null = null;
    let tools: TuiToolCatalog | null = null;
    let plugins: TuiPluginStatus | null = null;
    try {
      configSnapshot = client.getConfig ? await client.getConfig() : null;
    } catch (err) {
      chatLog.addSystem(`permissions config failed: ${sanitizeRenderableText(String(err))}`);
      return;
    }
    if (!configSnapshot) {
      chatLog.addSystem("permissions unavailable: backend cannot read config");
      return;
    }
    const cfg = configSnapshot.runtimeConfig ?? configSnapshot.config;
    if (!cfg) {
      chatLog.addSystem("permissions unavailable: config snapshot missing");
      return;
    }
    try {
      tools = client.listTools
        ? await client.listTools({
            agentId: state.currentAgentId,
            includePlugins: true,
          })
        : null;
    } catch {
      tools = null;
    }
    try {
      plugins = client.listPlugins ? await client.listPlugins() : null;
    } catch {
      plugins = null;
    }
    const toolCount =
      tools?.groups.reduce((sum, group) => sum + group.tools.length, 0) ?? undefined;
    chatLog.addSystem(
      formatPermissionSummary({
        cfg,
        configPath: configSnapshot.path,
        runtime: {
          ...(tools
            ? {
                tools: {
                  count: toolCount ?? 0,
                  groups: tools.groups.length,
                },
              }
            : {}),
          ...(plugins
            ? {
                plugins: {
                  total: plugins.totals.total,
                  enabled: plugins.totals.enabled,
                  errors: plugins.totals.errors,
                },
              }
            : {}),
        },
      }),
    );
  };

  const showPermissionsHelp = () => {
    chatLog.addSystem(
      [
        "usage: /permissions [edit|preset <locked|reviewed|balanced|trusted|default>]",
        "",
        "Session presets",
        "- locked: deny host exec",
        "- reviewed: ask before every host exec",
        "- balanced: allow trusted commands, ask on misses",
        "- trusted: no exec prompts for this trusted session",
        "- default: clear session exec overrides and use config defaults",
        "",
        "Durable config still lives in CLI: kova exec-policy preset cautious|yolo|deny-all",
      ].join("\n"),
    );
  };

  const applyPermissionSessionPatch = async (label: string, patch: PermissionSessionPatch) => {
    try {
      const result = await client.patchSession({
        key: state.currentSessionKey,
        ...patch,
      });
      const detail = formatPermissionPatch(patch);
      chatLog.addSystem(
        `permissions updated: ${label}${detail ? ` (${detail})` : " (config defaults)"}`,
      );
      applySessionInfoFromPatch(result);
      await refreshSessionInfo();
    } catch (err) {
      chatLog.addSystem(`permissions update failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const applyPermissionPreset = async (presetName: PermissionPresetName) => {
    const preset = PERMISSION_PRESETS[presetName];
    await applyPermissionSessionPatch(preset.label.toLowerCase(), preset.patch);
  };

  const resetPermissionSessionOverrides = async () => {
    await applyPermissionSessionPatch("default", {
      execHost: null,
      execSecurity: null,
      execAsk: null,
    });
  };

  const setElevatedMode = async (mode: "on" | "off" | "ask" | "full") => {
    try {
      const result = await client.patchSession({
        key: state.currentSessionKey,
        elevatedLevel: mode,
      });
      chatLog.addSystem(`elevated set to ${mode}`);
      applySessionInfoFromPatch(result);
      await refreshSessionInfo();
    } catch (err) {
      chatLog.addSystem(`elevated failed: ${String(err)}`);
    }
  };

  const openPermissionsEditor = () => {
    const presetItems = (
      Object.entries(PERMISSION_PRESETS) as Array<
        [PermissionPresetName, (typeof PERMISSION_PRESETS)[PermissionPresetName]]
      >
    ).map(([value, preset]) => ({
      value: `preset:${value}`,
      label: `Preset: ${preset.label}`,
      description: preset.description,
    }));
    const items = [
      ...presetItems,
      {
        value: "preset:default",
        label: "Preset: Config default",
        description: "Clear session exec overrides",
      },
      {
        value: "elevated:off",
        label: "Elevated: off",
        description: "Disable elevated exec for this session",
      },
      {
        value: "elevated:on",
        label: "Elevated: on",
        description: "Use elevated exec when requested",
      },
      {
        value: "elevated:ask",
        label: "Elevated: ask",
        description: "Ask before elevated exec",
      },
      {
        value: "elevated:full",
        label: "Elevated: full",
        description: "Allow elevated exec when policy permits it",
      },
      {
        value: "show",
        label: "Show current permissions",
        description: "Render the current policy summary",
      },
    ];
    const selector = createSearchableSelectList(items, 10);
    openSelector(selector, async (value) => {
      if (value === "show") {
        await showPermissions();
        return;
      }
      if (value === "preset:default") {
        await resetPermissionSessionOverrides();
        return;
      }
      if (value.startsWith("preset:")) {
        const presetName = normalizePermissionPresetName(value.slice("preset:".length));
        if (!presetName) {
          chatLog.addSystem("unknown permissions preset");
          return;
        }
        await applyPermissionPreset(presetName);
        return;
      }
      if (
        value === "elevated:off" ||
        value === "elevated:on" ||
        value === "elevated:ask" ||
        value === "elevated:full"
      ) {
        await setElevatedMode(value.slice("elevated:".length) as "on" | "off" | "ask" | "full");
      }
    });
  };

  const handlePermissionsCommand = async (args: string) => {
    const parts = args.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      await showPermissions();
      return;
    }
    const action = normalizeLowercaseStringOrEmpty(parts[0] ?? "");
    if (action === "edit" || action === "settings" || action === "choose") {
      openPermissionsEditor();
      return;
    }
    if (action === "help" || action === "?") {
      showPermissionsHelp();
      return;
    }
    if (action === "preset") {
      const presetArg = normalizeLowercaseStringOrEmpty(parts[1] ?? "");
      if (presetArg === "default" || presetArg === "reset") {
        await resetPermissionSessionOverrides();
        return;
      }
      const presetName = normalizePermissionPresetName(presetArg);
      if (presetName) {
        await applyPermissionPreset(presetName);
        return;
      }
      showPermissionsHelp();
      return;
    }
    if (action === "default" || action === "reset") {
      await resetPermissionSessionOverrides();
      return;
    }
    const presetName = normalizePermissionPresetName(action);
    if (presetName) {
      await applyPermissionPreset(presetName);
      return;
    }
    showPermissionsHelp();
  };

  const currentDetailsMode = (): DetailsMode => {
    const verbose = state.sessionInfo.verboseLevel ?? "off";
    if (verbose === "full" || state.toolsExpanded) {
      return "expanded";
    }
    return verbose === "off" ? "hidden" : "collapsed";
  };

  const setDetailsMode = async (mode: DetailsMode) => {
    const verboseLevel = mode === "hidden" ? "off" : mode === "expanded" ? "full" : "on";
    const previousToolsExpanded = state.toolsExpanded;
    const previousVerboseLevel = state.sessionInfo.verboseLevel;
    state.toolsExpanded = mode === "expanded";
    state.sessionInfo.verboseLevel = verboseLevel;
    chatLog.setToolsExpanded(state.toolsExpanded);
    try {
      const result = await client.patchSession({
        key: state.currentSessionKey,
        verboseLevel,
      });
      chatLog.addSystem(
        `details ${mode} (${mode === "hidden" ? "tool activity off" : mode === "collapsed" ? "tool activity rail on" : "tool rail and output expanded"})`,
      );
      applySessionInfoFromPatch(result);
      await loadHistory();
    } catch (err) {
      state.toolsExpanded = previousToolsExpanded;
      state.sessionInfo.verboseLevel = previousVerboseLevel;
      chatLog.setToolsExpanded(state.toolsExpanded);
      chatLog.addSystem(`details failed: ${String(err)}`);
    }
  };

  const showOrSetDetails = async (args: string) => {
    const mode = normalizeDetailsMode(args);
    if (!mode) {
      chatLog.addSystem("usage: /details [status|hidden|collapsed|expanded|cycle]");
      return;
    }
    if (mode === "status") {
      chatLog.addSystem(
        `details: ${currentDetailsMode()} (verbose ${state.sessionInfo.verboseLevel ?? "off"}, tool output ${state.toolsExpanded ? "expanded" : "collapsed"})`,
      );
      return;
    }
    if (mode === "cycle") {
      const current = currentDetailsMode();
      await setDetailsMode(
        current === "hidden" ? "collapsed" : current === "collapsed" ? "expanded" : "hidden",
      );
      return;
    }
    await setDetailsMode(mode);
  };

  const showTaskAudit = async () => {
    if (!client.auditTasks) {
      await sendMessage("/tasks audit", { queueIfBusy: false });
      return;
    }
    try {
      const result = await client.auditTasks();
      chatLog.addSystem(formatTaskAudit(result));
    } catch (err) {
      chatLog.addSystem(`task audit failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const runTaskMaintenance = async (apply: boolean) => {
    if (!client.maintainTasks) {
      chatLog.addSystem(
        apply
          ? "local recovery apply is unavailable here; run !kova tasks maintenance --apply"
          : "local recovery preview is unavailable here; run !kova tasks maintenance",
      );
      return;
    }
    try {
      const result = await client.maintainTasks({ apply });
      chatLog.addSystem(formatMaintenanceSummary(result));
    } catch (err) {
      chatLog.addSystem(`task maintenance failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const showTaskSnapshot = async (target: TaskCommandTarget, args: string) => {
    const normalized = args.trim().toLowerCase();
    if (target === "tasks" && normalized.startsWith("audit")) {
      await showTaskAudit();
      return;
    }
    if (
      target === "tasks" &&
      (normalized.startsWith("repair") || normalized.startsWith("recover"))
    ) {
      await runTaskMaintenance(/\bapply\b/.test(normalized));
      return;
    }
    if (!client.listTasks) {
      await sendMessage(args ? `/${target} ${args}` : `/${target}`, { queueIfBusy: false });
      return;
    }
    try {
      const result = await client.listTasks(resolveTaskListOptions(target, args));
      const label =
        target === "subagents" ? "Subagents" : target === "automation" ? "Automation" : "Tasks";
      chatLog.addSystem(formatTaskSnapshot(result, label));
    } catch (err) {
      chatLog.addSystem(`tasks list failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const showRecovery = async (args: string) => {
    const action = normalizeRecoveryAction(args);
    if (!action) {
      chatLog.addSystem("usage: /recover [status|apply]");
      return;
    }
    const missing = [
      !client.auditTasks ? "task audit" : "",
      !client.maintainTasks ? "task maintenance" : "",
    ].filter((value) => value.length > 0);
    if (missing.length > 0 || !client.auditTasks || !client.maintainTasks) {
      chatLog.addSystem(
        `self-healing runtime unavailable (${missing.join(", ")}); use !kova tasks audit and !kova tasks maintenance`,
      );
      return;
    }
    try {
      const auditBefore = await client.auditTasks();
      const maintenance = await client.maintainTasks({ apply: action === "apply" });
      const auditAfter = action === "apply" ? await client.auditTasks() : auditBefore;
      chatLog.addSystem(
        formatSelfHealingReport({
          action,
          auditBefore,
          maintenance,
          auditAfter,
        }),
      );
    } catch (err) {
      chatLog.addSystem(`self-healing scan failed: ${sanitizeRenderableText(String(err))}`);
    }
  };

  const showRollback = async (args: string) => {
    const command = parseRollbackCommand(args);
    if (!command) {
      chatLog.addSystem("usage: /rollback [list|show <id>|branch <id>|restore <id> confirm]");
      return;
    }
    const missing = [
      !client.listSessionCheckpoints ? "checkpoint list" : "",
      !client.getSessionCheckpoint ? "checkpoint read" : "",
    ].filter((value) => value.length > 0);
    if (missing.length > 0 || !client.listSessionCheckpoints || !client.getSessionCheckpoint) {
      chatLog.addSystem(
        `rollback unavailable (${missing.join(", ")}); use !kova sessions checkpoints ${state.currentSessionKey}`,
      );
      return;
    }
    try {
      if (command.action === "list") {
        const result = await client.listSessionCheckpoints({ key: state.currentSessionKey });
        chatLog.addSystem(formatCheckpointList(result, formatSessionKey));
        return;
      }
      if (command.action === "show" || command.action === "restore-preview") {
        const result = await client.getSessionCheckpoint({
          key: state.currentSessionKey,
          checkpointId: command.checkpointId,
        });
        chatLog.addSystem(formatCheckpointDetails(result, formatSessionKey));
        if (command.action === "restore-preview") {
          chatLog.addSystem(
            `restore preview only; run /rollback restore ${command.checkpointId} confirm to replace this session`,
          );
        }
        return;
      }
      if (command.action === "branch") {
        if (!client.branchSessionCheckpoint) {
          chatLog.addSystem("checkpoint branching is unavailable in this backend");
          return;
        }
        setActivityStatus("branching checkpoint");
        const result = await client.branchSessionCheckpoint({
          key: state.currentSessionKey,
          checkpointId: command.checkpointId,
        });
        chatLog.addSystem(`created checkpoint branch: ${formatSessionKey(result.key)}`);
        await setSession(result.key);
        return;
      }
      if (command.action === "restore-confirm") {
        if (!client.restoreSessionCheckpoint) {
          chatLog.addSystem("checkpoint restore is unavailable in this backend");
          return;
        }
        if (state.activeChatRunId || state.pendingOptimisticUserMessage) {
          chatLog.addSystem("stop the active run before restoring a checkpoint");
          return;
        }
        setActivityStatus("restoring checkpoint");
        const result = await client.restoreSessionCheckpoint({
          key: state.currentSessionKey,
          checkpointId: command.checkpointId,
        });
        chatLog.addSystem(
          `restored ${formatSessionKey(result.key)} from checkpoint ${result.checkpoint.checkpointId}`,
        );
        await setSession(result.key);
      }
    } catch (err) {
      chatLog.addSystem(`rollback failed: ${sanitizeRenderableText(String(err))}`);
      setActivityStatus("error");
    }
  };

  const openSessionSelector = async (query = "") => {
    const normalizedQuery = query.trim();
    try {
      const result = await client.listSessions({
        includeGlobal: false,
        includeUnknown: false,
        includeDerivedTitles: true,
        includeLastMessage: true,
        agentId: state.currentAgentId,
        ...(normalizedQuery ? { search: normalizedQuery } : {}),
      });
      const items = result.sessions.map((session) => {
        const title = session.derivedTitle ?? session.displayName;
        const formattedKey = formatSessionKey(session.key);
        // Avoid redundant "title (key)" when title matches key
        const label = title && title !== formattedKey ? `${title} (${formattedKey})` : formattedKey;
        // Build description: time + message preview
        const timePart = session.updatedAt
          ? formatRelativeTimestamp(session.updatedAt, { dateFallback: true, fallback: "" })
          : "";
        const preview = session.lastMessagePreview?.replace(/\s+/g, " ").trim();
        const description =
          timePart && preview ? `${timePart} · ${preview}` : (preview ?? timePart);
        return {
          value: session.key,
          label,
          description,
          searchText: [
            session.displayName,
            session.label,
            session.subject,
            session.sessionId,
            session.key,
            session.lastMessagePreview,
          ]
            .filter((value): value is string => typeof value === "string" && value.length > 0)
            .join(" "),
        };
      });
      const selector = createFilterableSelectList(items, 9, normalizedQuery);
      openSelector(selector, async (value) => {
        await setSession(value);
      });
    } catch (err) {
      chatLog.addSystem(`sessions list failed: ${String(err)}`);
      tui.requestRender();
    }
  };

  const openSettings = () => {
    const items = [
      {
        id: "tools",
        label: "Tool output",
        currentValue: state.toolsExpanded ? "expanded" : "collapsed",
        values: ["collapsed", "expanded"],
      },
      {
        id: "thinking",
        label: "Show thinking",
        currentValue: state.showThinking ? "on" : "off",
        values: ["off", "on"],
      },
    ];
    const settings = createSettingsList(
      items,
      (id, value) => {
        if (id === "tools") {
          state.toolsExpanded = value === "expanded";
          chatLog.setToolsExpanded(state.toolsExpanded);
        }
        if (id === "thinking") {
          state.showThinking = value === "on";
          void loadHistory();
        }
        tui.requestRender();
      },
      () => {
        closeOverlay();
        tui.requestRender();
      },
    );
    openOverlay(settings);
    tui.requestRender();
  };

  const handleCommand = async (raw: string) => {
    const { name, args } = parseCommand(raw);
    if (!name) {
      return;
    }
    let commandEchoed = false;
    const echoCommand = () => {
      if (commandEchoed) {
        return;
      }
      chatLog.addUser(raw);
      commandEchoed = true;
    };
    switch (name) {
      case "help":
        echoCommand();
        chatLog.addSystem(
          helpText({
            local: opts.local,
            provider: state.sessionInfo.modelProvider,
            model: state.sessionInfo.model,
            verbose: /^(all|full|verbose)$/i.test(args.trim()),
          }),
        );
        break;
      case "commands":
        echoCommand();
        chatLog.addSystem(
          commandCatalogText({
            local: opts.local,
            provider: state.sessionInfo.modelProvider,
            model: state.sessionInfo.model,
          }),
        );
        break;
      case "auth": {
        if (!runAuthFlow) {
          chatLog.addSystem("auth login is only available in local embedded mode");
          break;
        }
        if (state.activeChatRunId || state.pendingOptimisticUserMessage) {
          chatLog.addSystem("abort the current run before /auth");
          break;
        }
        const provider = args.trim() || state.sessionInfo.modelProvider || undefined;
        chatLog.addSystem(
          provider
            ? `opening auth flow for ${provider}; TUI will resume when it exits`
            : "opening auth flow; TUI will resume when it exits",
        );
        tui.requestRender();
        setActivityStatus("auth");
        try {
          const result = await runAuthFlow({ provider });
          await refreshSessionInfo();
          if (result.exitCode === 0 && !result.signal) {
            chatLog.addSystem(
              provider ? `auth flow finished for ${provider}` : "auth flow finished",
            );
            setActivityStatus("idle");
          } else {
            const failureSuffix = result.signal
              ? ` (signal ${result.signal})`
              : typeof result.exitCode === "number"
                ? ` (exit ${String(result.exitCode)})`
                : "";
            chatLog.addSystem(`auth flow failed${failureSuffix}`);
            setActivityStatus("error");
          }
        } catch (err) {
          chatLog.addSystem(`auth flow failed: ${sanitizeRenderableText(String(err))}`);
          setActivityStatus("error");
        }
        break;
      }
      case "gateway-status":
        try {
          const status = await client.getGatewayStatus();
          if (typeof status === "string") {
            chatLog.addSystem(status);
            break;
          }
          if (status && typeof status === "object") {
            const lines = formatStatusSummary(status as GatewayStatusSummary);
            for (const line of lines) {
              chatLog.addSystem(line);
            }
            break;
          }
          chatLog.addSystem("status: unknown response");
        } catch (err) {
          chatLog.addSystem(`status failed: ${String(err)}`);
        }
        break;
      case "limits":
        echoCommand();
        chatLog.addSystem(formatLimitsSummary(state));
        break;
      case "agent":
        if (!args) {
          await openAgentSelector();
        } else {
          await setAgent(args);
        }
        break;
      case "agents":
        await openAgentSelector();
        break;
      case "context":
        if (!args) {
          openContextModeSelector();
        } else {
          await sendMessage(raw);
        }
        break;
      case "tools":
        echoCommand();
        await showToolsCatalog(args);
        break;
      case "skills":
        echoCommand();
        await showSkillCatalog(args);
        break;
      case "plugins":
        echoCommand();
        await showPlugins(args);
        break;
      case "permissions":
        echoCommand();
        await handlePermissionsCommand(args);
        break;
      case "approve": {
        const parts = args.split(/\s+/).filter(Boolean);
        const approvalAction = normalizeLowercaseStringOrEmpty(args);
        if (parts.length === 0 || approvalAction === "pending" || approvalAction === "choose") {
          echoCommand();
          openApprovalSelector();
          break;
        }
        if (parts.length === 1 && chatLog.findPendingApproval(parts[0] ?? "")) {
          echoCommand();
          openApprovalDecisionSelector(parts[0] ?? "");
          break;
        }
        await sendMessage(raw, { queueIfBusy: false });
        break;
      }
      case "tasks":
        echoCommand();
        await showTaskSnapshot("tasks", args);
        break;
      case "subagents":
        if (args && !/^(list|running|queued|failed|lost|all)$/i.test(args.trim())) {
          await sendMessage(raw, { queueIfBusy: false });
        } else {
          echoCommand();
          await showTaskSnapshot("subagents", args);
        }
        break;
      case "automation":
        echoCommand();
        if (args.trim().toLowerCase().startsWith("audit")) {
          await showTaskAudit();
        } else {
          await showTaskSnapshot("automation", args);
        }
        break;
      case "pulse":
        echoCommand();
        await showPulse(args);
        break;
      case "recover":
        echoCommand();
        await showRecovery(args);
        break;
      case "rollback":
        echoCommand();
        await showRollback(args);
        break;
      case "session":
        if (!args) {
          await openSessionSelector();
        } else if (/^(?:idle|max-age)(?:\s|$)/i.test(args.trim())) {
          await sendMessage(raw, { queueIfBusy: false });
        } else {
          await setSession(args);
        }
        break;
      case "sessions":
        await openSessionSelector(args);
        break;
      case "model":
        if (!args) {
          await openModelSelector();
        } else {
          try {
            const result = await client.patchSession({
              key: state.currentSessionKey,
              model: args,
            });
            chatLog.addSystem(`model set to ${args}`);
            applySessionInfoFromPatch(result);
            await refreshSessionInfo();
          } catch (err) {
            chatLog.addSystem(`model set failed: ${String(err)}`);
          }
        }
        break;
      case "models":
        if (args) {
          await sendMessage(raw, { queueIfBusy: false });
        } else {
          await openModelSelector();
        }
        break;
      case "think":
        if (!args) {
          const levels = formatThinkingLevels(
            state.sessionInfo.modelProvider,
            state.sessionInfo.model,
            "|",
          );
          chatLog.addSystem(`usage: /think <default|${levels}>`);
          break;
        }
        try {
          const resetToDefault = isSessionDefaultDirectiveValue(args);
          const result = await client.patchSession({
            key: state.currentSessionKey,
            thinkingLevel: resetToDefault ? null : args,
          });
          if (resetToDefault) {
            state.sessionInfo.thinkingLevel = undefined;
            chatLog.addSystem("thinking reset to default");
          } else {
            chatLog.addSystem(`thinking set to ${args}`);
          }
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`think failed: ${String(err)}`);
        }
        break;
      case "verbose": {
        const mode = normalizeVerboseDetailsMode(args);
        if (!mode) {
          chatLog.addSystem("usage: /verbose [off|new|all|verbose]");
          break;
        }
        await showOrSetDetails(mode);
        break;
      }
      case "details":
        await showOrSetDetails(args);
        break;
      case "trace":
        if (!args) {
          chatLog.addSystem("usage: /trace <on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            traceLevel: args,
          });
          chatLog.addSystem(`trace set to ${args}`);
          applySessionInfoFromPatch(result);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`trace failed: ${String(err)}`);
        }
        break;
      case "fast": {
        const fastModeArg = normalizeLowercaseStringOrEmpty(args);
        if (!fastModeArg || fastModeArg === "status") {
          chatLog.addSystem(`fast mode: ${state.sessionInfo.fastMode ? "on" : "off"}`);
          break;
        }
        if (isSessionDefaultDirectiveValue(fastModeArg)) {
          try {
            const result = await client.patchSession({
              key: state.currentSessionKey,
              fastMode: null,
            });
            state.sessionInfo.fastMode = undefined;
            chatLog.addSystem("fast mode reset to default");
            applySessionInfoFromPatch(result);
            await refreshSessionInfo();
          } catch (err) {
            chatLog.addSystem(`fast failed: ${String(err)}`);
          }
          break;
        }
        if (fastModeArg !== "on" && fastModeArg !== "off") {
          chatLog.addSystem("usage: /fast <status|on|off|default>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            fastMode: fastModeArg === "on",
          });
          chatLog.addSystem(`fast mode ${fastModeArg === "on" ? "enabled" : "disabled"}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`fast failed: ${String(err)}`);
        }
        break;
      }
      case "reasoning":
        if (!args) {
          chatLog.addSystem("usage: /reasoning <on|off>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            reasoningLevel: args,
          });
          chatLog.addSystem(`reasoning set to ${args}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`reasoning failed: ${String(err)}`);
        }
        break;
      case "usage": {
        const usageArgs = args.trim();
        if (!usageArgs) {
          echoCommand();
          chatLog.addSystem(formatUsageSummary(state));
          break;
        }
        if (usageArgs === "status" || usageArgs === "show") {
          echoCommand();
          chatLog.addSystem(formatUsageSummary(state));
          break;
        }
        if (/^cost(?:\s|$)/i.test(usageArgs)) {
          await sendMessage(raw, { queueIfBusy: false });
          break;
        }
        const normalized = normalizeUsageDisplay(usageArgs);
        if (!normalized) {
          chatLog.addSystem("usage: /usage <off|tokens|full|cost>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            responseUsage: normalized === "off" ? null : normalized,
          });
          chatLog.addSystem(`usage footer: ${normalized}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`usage failed: ${String(err)}`);
        }
        break;
      }
      case "elevated":
        if (!args) {
          chatLog.addSystem("usage: /elevated <on|off|ask|full>");
          break;
        }
        if (!["on", "off", "ask", "full"].includes(args)) {
          chatLog.addSystem("usage: /elevated <on|off|ask|full>");
          break;
        }
        await setElevatedMode(args as "on" | "off" | "ask" | "full");
        break;
      case "activation": {
        if (!args) {
          chatLog.addSystem("usage: /activation <mention|always>");
          break;
        }
        const activation = normalizeGroupActivation(args);
        if (!activation) {
          chatLog.addSystem("usage: /activation <mention|always>");
          break;
        }
        try {
          const result = await client.patchSession({
            key: state.currentSessionKey,
            groupActivation: activation,
          });
          chatLog.addSystem(`activation set to ${activation}`);
          applySessionInfoFromPatch(result);
          await refreshSessionInfo();
        } catch (err) {
          chatLog.addSystem(`activation failed: ${String(err)}`);
        }
        break;
      }
      case "busy": {
        const action = args || "status";
        if (action === "status") {
          const mode = getBusyInputMode();
          const explanation =
            mode === "queue"
              ? "new messages wait for the active run to finish"
              : mode === "steer"
                ? "new messages try to steer the active run, then queue if steering is unavailable"
                : "new messages replace the active run";
          chatLog.addSystem(
            [
              `busy input: ${mode}`,
              `queue: ${formatQueuedFollowUpCount(getQueuedMessages().length)}`,
              `meaning: ${explanation}`,
              "actions: /busy queue, /busy steer, /busy interrupt, /busy clear",
            ].join("\n"),
          );
          break;
        }
        if (action === "clear") {
          clearQueuedMessages();
          break;
        }
        const nextMode = normalizeBusyInputMode(action);
        if (!nextMode) {
          chatLog.addSystem("usage: /busy status|queue|steer|interrupt|clear");
          break;
        }
        state.busyInputMode = nextMode;
        chatLog.addSystem(
          nextMode === "queue"
            ? "busy input set to queue; new messages wait for the active run to finish"
            : nextMode === "steer"
              ? "busy input set to steer; new messages are injected into the active run when possible"
              : "busy input set to interrupt; new messages replace the active run",
        );
        setActivityStatus(`busy ${nextMode}`);
        break;
      }
      case "new":
        try {
          // Clear token counts immediately to avoid stale display (#1523)
          state.sessionInfo.inputTokens = null;
          state.sessionInfo.outputTokens = null;
          state.sessionInfo.totalTokens = null;
          tui.requestRender();

          // Generate unique session key to isolate this TUI client (#39217)
          // This ensures /new creates a fresh session that doesn't broadcast
          // to other connected TUI clients sharing the original session key.
          const uniqueKey = `tui-${randomUUID()}`;
          await setSession(uniqueKey);
          if (args) {
            const result = await client.patchSession({
              key: uniqueKey,
              model: args,
            });
            applySessionInfoFromPatch(result);
            await refreshSessionInfo();
          }
          chatLog.addSystem(`new session: ${uniqueKey}`);
        } catch (err) {
          chatLog.addSystem(`new session failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "reset":
        try {
          // Clear token counts immediately to avoid stale display (#1523)
          state.sessionInfo.inputTokens = null;
          state.sessionInfo.outputTokens = null;
          state.sessionInfo.totalTokens = null;
          tui.requestRender();

          await client.resetSession(state.currentSessionKey, name);
          chatLog.addSystem(`session ${state.currentSessionKey} reset`);
          await loadHistory();
        } catch (err) {
          chatLog.addSystem(`reset failed: ${sanitizeRenderableText(String(err))}`);
        }
        break;
      case "stop":
        await abortActive();
        break;
      case "update": {
        const action = parseTuiUpdateAction(args);
        if (action === "status") {
          echoCommand();
          chatLog.addSystem(await formatTuiUpdateStatus());
          break;
        }
        if (action === "help") {
          echoCommand();
          chatLog.addSystem(formatTuiUpdateHelp());
          break;
        }
        if (action === "run") {
          await sendMessage(raw, { queueIfBusy: false });
          break;
        }
        echoCommand();
        chatLog.addSystem(formatTuiUpdateHelp());
        break;
      }
      case "settings":
        openSettings();
        break;
      case "exit":
      case "quit":
        requestExit();
        break;
      default:
        await sendMessage(raw, { queueIfBusy: !raw.trim().startsWith("/") });
        break;
    }
    tui.requestRender();
  };

  const sendMessage = async (text: string, options?: { queueIfBusy?: boolean }) => {
    if (!state.isConnected) {
      chatLog.addSystem(
        opts.local
          ? "local runtime not ready — message not sent"
          : "not connected to gateway — message not sent",
      );
      setActivityStatus("disconnected");
      tui.requestRender();
      return;
    }
    const isBtw = isBtwCommand(text);
    const queueIfBusy = options?.queueIfBusy ?? true;
    if (!isBtw && queueIfBusy && (state.activeChatRunId || state.pendingOptimisticUserMessage)) {
      const busyMode = getBusyInputMode();
      if (busyMode === "steer" && state.activeChatRunId) {
        const steered = await steerMessage(text);
        if (steered) {
          return;
        }
      }
      if (busyMode === "queue" || busyMode === "steer") {
        queueMessage(text, "busy");
        return;
      }
    }
    const runId = randomUUID();
    try {
      if (!isBtw) {
        chatLog.addUser(text);
        state.pendingOptimisticUserMessage = true;
        setActivityStatus("sending");
      } else {
        noteLocalBtwRunId?.(runId);
      }
      tui.requestRender();
      const result = await client.sendChat({
        sessionKey: state.currentSessionKey,
        message: text,
        thinking: opts.thinking,
        deliver: deliverDefault,
        timeoutMs: opts.timeoutMs,
        runId,
      });
      if (!isBtw) {
        const effectiveRunId = result.runId || runId;
        const shouldKeepWaiting =
          state.pendingOptimisticUserMessage ||
          (state.activeChatRunId === effectiveRunId && state.activityStatus === "sending");
        if (shouldKeepWaiting) {
          setActivityStatus("waiting");
          tui.requestRender();
        }
      }
    } catch (err) {
      if (isBtw) {
        forgetLocalBtwRunId?.(runId);
      }
      if (!isBtw && state.activeChatRunId) {
        forgetLocalRunId?.(state.activeChatRunId);
      }
      if (!isBtw) {
        state.pendingOptimisticUserMessage = false;
        state.activeChatRunId = null;
      }
      chatLog.addSystem(`${isBtw ? "btw failed" : "send failed"}: ${String(err)}`);
      if (!isBtw) {
        setActivityStatus("error");
      }
      tui.requestRender();
    }
  };

  return {
    handleCommand,
    sendMessage,
    queueMessage,
    dequeueQueuedMessage,
    openModelSelector,
    openAgentSelector,
    openSessionSelector,
    openSettings,
    setAgent,
  };
}
