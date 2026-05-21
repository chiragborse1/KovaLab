import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { logVerbose } from "../../globals.js";
import type {
  MemoryProviderStatus,
  MemorySearchResult,
} from "../../memory-host-sdk/engine-storage.js";
import { getActiveMemorySearchManager } from "../../plugins/memory-runtime.js";
import type {
  CommandHandler,
  CommandHandlerResult,
  HandleCommandsParams,
} from "./commands-types.js";

const MAX_MEMORY_SEARCH_RESULTS = 5;

function memoryHelpText(): string {
  return [
    "Memory commands:",
    "- /memory status",
    "- /memory search <query>",
    "",
    "Terminal equivalents:",
    "- kova memory status --deep",
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

  return {
    shouldContinue: false,
    reply: { text: "Usage: /memory [help|status|search <query>]" },
  };
};
