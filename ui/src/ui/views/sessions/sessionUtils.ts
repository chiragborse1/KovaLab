import { formatRelativeTimestamp, parseSessionKeyParts } from "../../format.ts";
import { formatSessionTokens } from "../../presenter.ts";
import { normalizeLowercaseStringOrEmpty, normalizeOptionalString } from "../../string-coerce.ts";
import { normalizeThinkLevel } from "../../thinking.ts";
import type {
  AgentIdentityResult,
  GatewaySessionRow,
  GatewayThinkingLevelOption,
} from "../../types.ts";
import type { Session, SessionGroup, SessionSource, SessionStatus } from "./types.ts";

const DEFAULT_THINK_LEVELS = ["off", "minimal", "low", "medium", "high"] as const;
export const VERBOSE_LEVELS = [
  { value: "", label: "inherit" },
  { value: "off", label: "off (explicit)" },
  { value: "on", label: "on" },
  { value: "full", label: "full" },
] as const;
export const FAST_LEVELS = [
  { value: "", label: "inherit" },
  { value: "on", label: "on" },
  { value: "off", label: "off" },
] as const;
export const REASONING_LEVELS = ["", "off", "on", "stream"] as const;

export const SOURCE_ORDER: SessionSource[] = ["direct", "telegram", "discord", "cron", "other"];

export const SOURCE_LABELS: Record<SessionSource, string> = {
  direct: "Direct Sessions",
  telegram: "Telegram",
  discord: "Discord",
  cron: "Cron",
  other: "Other",
};

export function getAgentIdentity(
  agentIdentityById: Record<string, AgentIdentityResult>,
  agentId: string,
): AgentIdentityResult | null {
  return Object.prototype.hasOwnProperty.call(agentIdentityById, agentId)
    ? (agentIdentityById[agentId] ?? null)
    : null;
}

export function detectSource(key: string): SessionSource {
  const lower = normalizeLowercaseStringOrEmpty(key);
  if (lower.includes(":telegram:")) {
    return "telegram";
  }
  if (lower.includes(":discord:")) {
    return "discord";
  }
  if (lower.includes(":cron:")) {
    return "cron";
  }
  if (lower.includes(":main") || lower.includes(":tui-") || lower.includes(":direct:")) {
    return "direct";
  }
  if (lower.includes("dreaming-narrative")) {
    return "direct";
  }
  return "other";
}

export function deriveTitle(key: string, label: string | null): string {
  const normalizedLabel = normalizeOptionalString(label);
  if (normalizedLabel) {
    return normalizedLabel;
  }
  const parts = key.split(":");
  const lower = key.toLowerCase();
  if (key === "agent:main:main") {
    return "Main Session";
  }
  if (lower.includes(":telegram:")) {
    const recipient = parts.at(-1) ?? "unknown";
    return `Telegram · @${recipient}`;
  }
  if (lower.includes(":discord:")) {
    const recipient = parts.at(-1) ?? "unknown";
    return `Discord · ${recipient}`;
  }
  if (lower.includes(":cron:")) {
    const maybeLabel = parts.slice(3).join(":").replace(/[-_]+/g, " ").trim();
    return maybeLabel && !/^[0-9a-f-]{12,}$/i.test(maybeLabel) ? `Cron: ${maybeLabel}` : "Cron Job";
  }
  if (lower.includes("dreaming-narrative-rem")) {
    return "Memory Dream · rem";
  }
  if (lower.includes("dreaming-narrative-light")) {
    return "Memory Dream · light";
  }
  if (lower.includes(":tui-")) {
    return "TUI Session";
  }
  const fallback = parts.at(-1) || key;
  return fallback.length > 40 ? `${fallback.slice(0, 37)}…` : fallback;
}

function parseCompactNumber(raw: string): number | null {
  const value = raw.trim().toLowerCase().replace(/,/g, "");
  if (!value || value === "n/a" || value === "unknown") {
    return null;
  }
  const match = value.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (!match) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }
  const suffix = match[2];
  if (suffix === "k") {
    return amount * 1_000;
  }
  if (suffix === "m") {
    return amount * 1_000_000;
  }
  if (suffix === "b") {
    return amount * 1_000_000_000;
  }
  return amount;
}

export function parseTokens(tokens: string): {
  used: number | null;
  limit: number | null;
  percent: number | null;
} {
  const [usedRaw, limitRaw] = tokens.split("/").map((part) => part.trim());
  const used = parseCompactNumber(usedRaw ?? "");
  const limit = limitRaw ? parseCompactNumber(limitRaw) : null;
  const percent =
    used != null && limit != null && limit > 0 ? Math.min(100, (used / limit) * 100) : null;
  return { used, limit, percent };
}

export function formatTokenCount(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  }
  return String(Math.round(n));
}

export function deriveStatus(updatedAt: string): SessionStatus {
  const parsed = Date.parse(updatedAt);
  if (!Number.isFinite(parsed)) {
    return "unknown";
  }
  return deriveStatusFromMs(parsed);
}

export function deriveStatusFromMs(updatedAt: number | null): SessionStatus {
  if (!updatedAt || !Number.isFinite(updatedAt)) {
    return "unknown";
  }
  const age = Date.now() - updatedAt;
  if (age < 0) {
    return "active";
  }
  return age <= 60 * 60 * 1000 ? "active" : "idle";
}

export function groupSessions(
  sessions: Session[],
  collapsedSources = new Set<SessionSource>(),
): SessionGroup[] {
  return SOURCE_ORDER.flatMap((source) => {
    const rows = sessions.filter((session) => session.source === source);
    if (rows.length === 0) {
      return [];
    }
    return [
      {
        source,
        label: SOURCE_LABELS[source],
        sessions: rows,
        collapsed: collapsedSources.has(source),
      },
    ];
  });
}

export function normalizeThinkingOptionValue(raw: string): string {
  return normalizeThinkLevel(raw) ?? normalizeLowercaseStringOrEmpty(raw);
}

export function resolveThinkLevelOptions(
  row: GatewaySessionRow,
): readonly { value: string; label: string }[] {
  const defaultLabel = row.thinkingDefault ? `Default (${row.thinkingDefault})` : "inherit";
  const options: readonly GatewayThinkingLevelOption[] = row.thinkingLevels?.length
    ? row.thinkingLevels
    : (row.thinkingOptions?.length ? row.thinkingOptions : DEFAULT_THINK_LEVELS).map((label) => ({
        id: normalizeThinkingOptionValue(label),
        label,
      }));
  return [
    { value: "", label: defaultLabel },
    ...options.map((option) => ({
      value: normalizeThinkingOptionValue(option.id),
      label: option.label,
    })),
  ];
}

export function withCurrentOption(options: readonly string[], current: string): string[] {
  if (!current) {
    return [...options];
  }
  if (options.includes(current)) {
    return [...options];
  }
  return [...options, current];
}

export function withCurrentLabeledOption(
  options: readonly { value: string; label: string }[],
  current: string,
): Array<{ value: string; label: string }> {
  if (!current) {
    return [...options];
  }
  if (options.some((option) => option.value === current)) {
    return [...options];
  }
  return [...options, { value: current, label: `${current} (custom)` }];
}

export function resolveThinkLevelPatchValue(value: string): string | null {
  return value ? value : null;
}

export function rowToSession(row: GatewaySessionRow): Session {
  const tokens = formatSessionTokens(row);
  const parsed = parseTokens(tokens);
  const label = normalizeOptionalString(row.label) ?? null;
  const source = detectSource(row.key);
  const latestCheckpoint = row.latestCompactionCheckpoint;
  const compaction = latestCheckpoint
    ? `${formatCheckpointReason(latestCheckpoint.reason)} · ${formatRelativeTimestamp(latestCheckpoint.createdAt)}`
    : null;
  const keyParts = parseSessionKeyParts(row.key);
  return {
    key: row.key,
    label,
    kind: row.kind,
    updatedAt: row.updatedAt ? formatRelativeTimestamp(row.updatedAt) : "n/a",
    updatedAtMs: row.updatedAt ?? null,
    tokens,
    overrides: {
      thinking: (row.thinkingLevel ?? "inherit") as Session["overrides"]["thinking"],
      fast: (row.fastMode === true
        ? "on"
        : row.fastMode === false
          ? "off"
          : "inherit") as Session["overrides"]["fast"],
      verbose: (row.verboseLevel ?? "inherit") as Session["overrides"]["verbose"],
      reasoning: (row.reasoningLevel ?? "inherit") as Session["overrides"]["reasoning"],
      compaction,
    },
    row,
    displayTitle: deriveTitle(row.key, label),
    source,
    status: deriveStatusFromMs(row.updatedAt ?? null),
    tokensUsed: parsed.used,
    tokenLimit: parsed.limit,
    tokenPercent: parsed.percent,
    agentId: keyParts?.agentId ?? null,
  };
}

export function filterRows(
  rows: GatewaySessionRow[],
  query: string,
  agentIdentityById: Record<string, AgentIdentityResult>,
): GatewaySessionRow[] {
  const q = normalizeLowercaseStringOrEmpty(query);
  if (!q) {
    return rows;
  }
  return rows.filter((row) => {
    const key = normalizeLowercaseStringOrEmpty(row.key);
    const label = normalizeLowercaseStringOrEmpty(row.label);
    const kind = normalizeLowercaseStringOrEmpty(row.kind);
    const displayName = normalizeLowercaseStringOrEmpty(row.displayName);
    if (key.includes(q) || label.includes(q) || kind.includes(q) || displayName.includes(q)) {
      return true;
    }
    const keyParts = parseSessionKeyParts(row.key);
    const identityName = keyParts
      ? normalizeLowercaseStringOrEmpty(getAgentIdentity(agentIdentityById, keyParts.agentId)?.name)
      : "";
    return identityName.includes(q);
  });
}

export function sortRows(
  rows: GatewaySessionRow[],
  column: "key" | "kind" | "updated" | "tokens",
  dir: "asc" | "desc",
): GatewaySessionRow[] {
  const cmp = dir === "asc" ? 1 : -1;
  return [...rows].toSorted((a, b) => {
    let diff = 0;
    switch (column) {
      case "key":
        diff = (a.key ?? "").localeCompare(b.key ?? "");
        break;
      case "kind":
        diff = (a.kind ?? "").localeCompare(b.kind ?? "");
        break;
      case "updated":
        diff = (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
        break;
      case "tokens":
        diff =
          (a.totalTokens ?? a.inputTokens ?? a.outputTokens ?? 0) -
          (b.totalTokens ?? b.inputTokens ?? b.outputTokens ?? 0);
        break;
    }
    return diff * cmp;
  });
}

export function formatCheckpointReason(
  reason: GatewaySessionRow["latestCompactionCheckpoint"] extends infer C
    ? C extends { reason: infer R }
      ? R
      : never
    : never,
): string {
  switch (reason) {
    case "manual":
      return "manual";
    case "auto-threshold":
      return "auto-threshold";
    case "overflow-retry":
      return "overflow retry";
    case "timeout-retry":
      return "timeout retry";
    default:
      return String(reason);
  }
}

export function formatCheckpointDelta(
  checkpoint: NonNullable<GatewaySessionRow["latestCompactionCheckpoint"]>,
): string {
  if (
    typeof checkpoint.tokensBefore === "number" &&
    typeof checkpoint.tokensAfter === "number" &&
    Number.isFinite(checkpoint.tokensBefore) &&
    Number.isFinite(checkpoint.tokensAfter)
  ) {
    return `${checkpoint.tokensBefore.toLocaleString()} → ${checkpoint.tokensAfter.toLocaleString()} tokens`;
  }
  if (typeof checkpoint.tokensBefore === "number" && Number.isFinite(checkpoint.tokensBefore)) {
    return `${checkpoint.tokensBefore.toLocaleString()} tokens before`;
  }
  return "token delta unavailable";
}

export function truncateMiddle(value: string, max = 55): string {
  if (value.length <= max) {
    return value;
  }
  const head = Math.max(12, Math.floor((max - 1) * 0.62));
  const tail = Math.max(8, max - head - 1);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function isOverrideNonDefault(row: GatewaySessionRow): boolean {
  return Boolean(
    row.thinkingLevel || row.fastMode != null || row.verboseLevel || row.reasoningLevel,
  );
}
