import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { logVerbose } from "../../globals.js";
import type {
  MemoryReadResult,
  MemoryProviderStatus,
  MemorySearchResult,
  MemorySyncProgressUpdate,
} from "../../memory-host-sdk/engine-storage.js";
import { getActiveMemorySearchManager } from "../../plugins/memory-runtime.js";
import type {
  CommandHandler,
  CommandHandlerResult,
  HandleCommandsParams,
} from "./commands-types.js";

const MAX_MEMORY_SEARCH_RESULTS = 5;
const DEFAULT_MEMORY_READ_LINES = 40;
const MAX_MEMORY_READ_LINES = 120;

function memoryHelpText(): string {
  return [
    "Memory commands:",
    "- /memory status",
    "- /memory sync [force]",
    "- /memory search <query>",
    "- /memory read <path[:line[-end]]> [from=<line>] [lines=<count>]",
    "",
    "Terminal equivalents:",
    "- kova memory status --deep",
    "- kova memory index --force",
    '- kova memory search "<query>"',
  ].join("\n");
}

function formatCount(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "unknown";
}

function formatMemoryStatus(params: { status: MemoryProviderStatus }): string {
  const status = params.status;
  const parts = [
    `backend ${status.backend}`,
    `provider ${status.provider}`,
    status.model ? `model ${status.model}` : null,
    `${formatCount(status.files)} files`,
    `${formatCount(status.chunks)} chunks`,
    status.dirty ? "dirty" : "clean",
  ].filter((part): part is string => Boolean(part));
  if (status.sources?.length) {
    parts.push(`sources ${status.sources.join(", ")}`);
  }
  if (status.vector) {
    parts.push(
      status.vector.enabled
        ? `vector ${status.vector.available === false ? "unavailable" : "ready"}`
        : "vector off",
    );
  }
  if (status.fts) {
    parts.push(
      status.fts.enabled ? `fts ${status.fts.available ? "ready" : "unavailable"}` : "fts off",
    );
  }
  if (status.cache) {
    const entries = typeof status.cache.entries === "number" ? ` (${status.cache.entries})` : "";
    parts.push(status.cache.enabled ? `cache on${entries}` : "cache off");
  }
  return `Memory status: ${parts.join(" | ")}`;
}

function shortenSnippet(value: string, maxLength = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(2) : "?";
}

function formatMemorySearchResults(query: string, results: MemorySearchResult[]): string {
  if (results.length === 0) {
    return [
      `Memory search: "${query}"`,
      "No matches found.",
      "Verify the index with: kova memory status --deep",
    ].join("\n");
  }
  const lines = [`Memory search: "${query}"`];
  results.slice(0, MAX_MEMORY_SEARCH_RESULTS).forEach((result, index) => {
    const location = `${result.path}:${String(result.startLine)}-${String(result.endLine)}`;
    const citation = result.citation ? ` | ${result.citation}` : "";
    lines.push(
      `${String(index + 1)}. ${location} | ${result.source} | score ${formatScore(result.score)}${citation}`,
    );
    const snippet = shortenSnippet(result.snippet);
    if (snippet) {
      lines.push(`   ${snippet}`);
    }
  });
  return lines.join("\n");
}

function formatReadRange(result: MemoryReadResult): string {
  const from = Math.max(1, result.from ?? 1);
  const lineCount = Math.max(1, result.lines ?? result.text.split("\n").length);
  return `${String(from)}-${String(from + lineCount - 1)}`;
}

function formatMemoryReadResult(result: MemoryReadResult): string {
  const header = `Memory read: ${result.path}:${formatReadRange(result)}`;
  const continuation =
    result.truncated && typeof result.nextFrom === "number"
      ? `\n\nContinue with: /memory read ${result.path} from=${String(result.nextFrom)} lines=${String(
          DEFAULT_MEMORY_READ_LINES,
        )}`
      : "";
  return `${header}\n\n${result.text || "(empty)"}${continuation}`;
}

function parseMemoryCommand(normalized: string): { action: string; query: string } | null {
  if (normalized !== "/memory" && !normalized.startsWith("/memory ")) {
    return null;
  }
  const args = normalized.slice("/memory".length).trim();
  if (!args) {
    return { action: "help", query: "" };
  }
  const [actionRaw, ...rest] = args.split(/\s+/);
  const action = actionRaw?.toLowerCase() ?? "help";
  return { action, query: rest.join(" ").trim() };
}

function parsePositiveInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function clampMemoryReadLines(value: number): number {
  return Math.min(MAX_MEMORY_READ_LINES, Math.max(1, value));
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseMemoryReadArgs(
  raw: string,
): { relPath: string; from?: number; lines?: number } | null {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const targetRaw = tokens.shift();
  if (!targetRaw) {
    return null;
  }

  let target = stripWrappingQuotes(targetRaw);
  let from: number | undefined;
  let lines: number | undefined;

  const rangeMatch = target.match(/^(.*):(\d+)(?:-(\d+))?$/);
  if (rangeMatch && rangeMatch[1]) {
    target = rangeMatch[1];
    const start = parsePositiveInteger(rangeMatch[2]);
    const end = rangeMatch[3] ? parsePositiveInteger(rangeMatch[3]) : undefined;
    if (start) {
      from = start;
      if (end && end >= start) {
        lines = clampMemoryReadLines(end - start + 1);
      } else if (end) {
        lines = 1;
      }
    }
  }

  for (const token of tokens) {
    const option = token.match(/^(from|line|start|lines|limit)=([0-9]+)$/i);
    if (!option) {
      continue;
    }
    const value = parsePositiveInteger(option[2]);
    if (!value) {
      continue;
    }
    const key = option[1].toLowerCase();
    if (key === "from" || key === "line" || key === "start") {
      from = value;
    } else {
      lines = clampMemoryReadLines(value);
    }
  }

  if (!target) {
    return null;
  }
  return {
    relPath: target,
    ...(typeof from === "number" ? { from } : {}),
    lines: clampMemoryReadLines(lines ?? DEFAULT_MEMORY_READ_LINES),
  };
}

function shouldForceMemorySync(query: string): boolean {
  return query
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .some((token) => token === "force" || token === "--force" || token === "true");
}

function formatMemorySyncResult(params: {
  status: MemoryProviderStatus;
  force: boolean;
  progress: MemorySyncProgressUpdate[];
}): string {
  const prefix = params.force ? "Memory sync complete (forced)." : "Memory sync complete.";
  const lastProgress = params.progress.at(-1);
  const progress =
    lastProgress && lastProgress.total > 0
      ? `\nIndexed ${String(lastProgress.completed)}/${String(lastProgress.total)}${lastProgress.label ? `: ${lastProgress.label}` : ""}`
      : "";
  return `${prefix}${progress}\n${formatMemoryStatus({ status: params.status })}`;
}

async function resolveMemoryManager(params: HandleCommandsParams) {
  const agentId = params.sessionKey
    ? resolveSessionAgentId({ sessionKey: params.sessionKey, config: params.cfg })
    : params.agentId;
  return await getActiveMemorySearchManager({
    cfg: params.cfg,
    agentId: agentId ?? params.agentId ?? "main",
  });
}

export const handleMemoryCommand: CommandHandler = async (
  params,
  allowTextCommands,
): Promise<CommandHandlerResult | null> => {
  if (!allowTextCommands) {
    return null;
  }
  const parsed = parseMemoryCommand(params.command.commandBodyNormalized);
  if (!parsed) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /memory from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  if (parsed.action === "help") {
    return { shouldContinue: false, reply: { text: memoryHelpText() } };
  }

  if (parsed.action === "status") {
    const { manager, error } = await resolveMemoryManager(params);
    if (!manager) {
      return {
        shouldContinue: false,
        reply: {
          text: `Memory status unavailable${error ? `: ${error}` : ""}\nVerify: kova memory status --deep`,
        },
      };
    }
    return {
      shouldContinue: false,
      reply: { text: formatMemoryStatus({ status: manager.status() }) },
    };
  }

  if (parsed.action === "search") {
    if (!parsed.query) {
      return {
        shouldContinue: false,
        reply: { text: "Usage: /memory search <query>" },
      };
    }
    const { manager, error } = await resolveMemoryManager(params);
    if (!manager) {
      return {
        shouldContinue: false,
        reply: {
          text: `Memory search unavailable${error ? `: ${error}` : ""}\nVerify: kova memory status --deep`,
        },
      };
    }
    try {
      const results = await manager.search(parsed.query, {
        maxResults: MAX_MEMORY_SEARCH_RESULTS,
        sessionKey: params.sessionKey,
      });
      return {
        shouldContinue: false,
        reply: { text: formatMemorySearchResults(parsed.query, results) },
      };
    } catch (error) {
      return {
        shouldContinue: false,
        reply: {
          text: `Memory search failed: ${String(error)}\nVerify: kova memory status --deep`,
        },
      };
    }
  }

  if (parsed.action === "sync") {
    const { manager, error } = await resolveMemoryManager(params);
    if (!manager) {
      return {
        shouldContinue: false,
        reply: {
          text: `Memory sync unavailable${error ? `: ${error}` : ""}\nVerify: kova memory status --deep`,
        },
      };
    }
    if (!manager.sync) {
      return {
        shouldContinue: false,
        reply: {
          text: "Memory sync unavailable for active backend.\nUse: kova memory index --force",
        },
      };
    }
    const progress: MemorySyncProgressUpdate[] = [];
    const force = shouldForceMemorySync(parsed.query);
    try {
      await manager.sync({
        reason: "chat-command",
        force,
        progress: (update) => {
          progress.push(update);
        },
      });
      return {
        shouldContinue: false,
        reply: {
          text: formatMemorySyncResult({
            status: manager.status(),
            force,
            progress,
          }),
        },
      };
    } catch (error) {
      return {
        shouldContinue: false,
        reply: {
          text: `Memory sync failed: ${String(error)}\nVerify: kova memory status --deep`,
        },
      };
    }
  }

  if (parsed.action === "read") {
    const readParams = parseMemoryReadArgs(parsed.query);
    if (!readParams) {
      return {
        shouldContinue: false,
        reply: { text: "Usage: /memory read <path[:line[-end]]> [from=<line>] [lines=<count>]" },
      };
    }
    const { manager, error } = await resolveMemoryManager(params);
    if (!manager) {
      return {
        shouldContinue: false,
        reply: {
          text: `Memory read unavailable${error ? `: ${error}` : ""}\nVerify: kova memory status --deep`,
        },
      };
    }
    try {
      const result = await manager.readFile(readParams);
      return {
        shouldContinue: false,
        reply: { text: formatMemoryReadResult(result) },
      };
    } catch (error) {
      return {
        shouldContinue: false,
        reply: {
          text: `Memory read failed: ${String(error)}\nVerify: kova memory status --deep`,
        },
      };
    }
  }

  return {
    shouldContinue: false,
    reply: { text: "Usage: /memory [help|status|sync [force]|search <query>|read <path>]" },
  };
};
