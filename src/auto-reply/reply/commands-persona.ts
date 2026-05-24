import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import {
  formatPersonaContent,
  formatPersonaStatus,
  resolvePersonaContent,
  resolvePersonaStatus,
} from "../../commands/persona.js";
import { logVerbose } from "../../globals.js";
import type {
  CommandHandler,
  CommandHandlerResult,
  HandleCommandsParams,
} from "./commands-types.js";

function parsePersonaCommand(normalized: string): { action: string; query: string } | null {
  if (normalized !== "/persona" && !normalized.startsWith("/persona ")) {
    return null;
  }
  const args = normalized.slice("/persona".length).trim();
  if (!args) {
    return { action: "status", query: "" };
  }
  const [actionRaw, ...rest] = args.split(/\s+/);
  return {
    action: actionRaw?.toLowerCase() ?? "status",
    query: rest.join(" ").trim(),
  };
}

function parsePositiveInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseShowArgs(raw: string): { all: boolean; lines?: number } {
  let all = false;
  let lines: number | undefined;
  for (const token of raw
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const normalized = token.toLowerCase();
    if (normalized === "all" || normalized === "--all") {
      all = true;
      continue;
    }
    const match = normalized.match(/^--?lines(?:=|:)(\d+)$/) ?? normalized.match(/^lines=(\d+)$/);
    const value = match?.[1] ? parsePositiveInteger(match[1]) : undefined;
    if (value) {
      lines = value;
    }
  }
  return { all, lines };
}

function personaHelpText(): string {
  return [
    "Persona commands:",
    "- /persona status",
    "- /persona show [lines=<count>|all]",
    "- /persona path",
    "",
    "Terminal editing:",
    "- kova persona edit",
    "- kova persona init",
  ].join("\n");
}

function resolveCommandAgentId(params: HandleCommandsParams): string {
  return params.sessionKey
    ? resolveSessionAgentId({ sessionKey: params.sessionKey, config: params.cfg })
    : (params.agentId ?? "main");
}

export const handlePersonaCommand: CommandHandler = async (
  params,
  allowTextCommands,
): Promise<CommandHandlerResult | null> => {
  if (!allowTextCommands) {
    return null;
  }
  const parsed = parsePersonaCommand(params.command.commandBodyNormalized);
  if (!parsed) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /persona from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const agentId = resolveCommandAgentId(params);
  const base = {
    cfg: params.cfg,
    agent: agentId,
    workspace: params.workspaceDir,
  };

  if (parsed.action === "help") {
    return { shouldContinue: false, reply: { text: personaHelpText() } };
  }

  if (parsed.action === "status") {
    const status = await resolvePersonaStatus(base);
    return { shouldContinue: false, reply: { text: formatPersonaStatus(status) } };
  }

  if (parsed.action === "show" || parsed.action === "read") {
    const content = await resolvePersonaContent(base);
    return {
      shouldContinue: false,
      reply: {
        text: formatPersonaContent(content, parseShowArgs(parsed.query)),
      },
    };
  }

  if (parsed.action === "path") {
    const status = await resolvePersonaStatus(base);
    return { shouldContinue: false, reply: { text: status.personaPath } };
  }

  if (parsed.action === "edit" || parsed.action === "init") {
    return {
      shouldContinue: false,
      reply: {
        text: `Use the terminal for persona writes: kova persona ${parsed.action} --agent ${agentId}`,
      },
    };
  }

  return {
    shouldContinue: false,
    reply: { text: "Usage: /persona [help|status|show [lines=<count>|all]|path]" },
  };
};
