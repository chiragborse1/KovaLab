import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import { createExecTool } from "../../agents/bash-tools.js";
import type { ExecToolDetails } from "../../agents/bash-tools.js";
import { logVerbose } from "../../globals.js";
import { formatErrorMessage } from "../../infra/errors.js";
import type { ReplyPayload } from "../types.js";
import { buildCurrentKovaCliCommand } from "./commands-kova-cli.js";
import type { CommandHandler, HandleCommandsParams } from "./commands-types.js";

const DIAGNOSTICS_COMMAND = "/diagnostics";
const DIAGNOSTICS_DOCS_URL =
  "https://github.com/chiragborse1/KovaLab/blob/main/docs/gateway/diagnostics.md";
const GATEWAY_DIAGNOSTICS_EXPORT_JSON_LABEL = "kova gateway diagnostics export --json";
const DIAGNOSTICS_EXEC_SCOPE_KEY = "chat:diagnostics";
const DIAGNOSTICS_GROUP_WARNING =
  "Diagnostics are sensitive. Run /diagnostics from an owner DM so local logs and runtime metadata are not posted in this chat.";

type DiagnosticsCommandDeps = {
  createExecTool: typeof createExecTool;
};

type GatewayDiagnosticsApprovalResult =
  | { status: "pending" }
  | { status: "reply"; reply: ReplyPayload };

const defaultDiagnosticsCommandDeps: DiagnosticsCommandDeps = {
  createExecTool,
};

export function createDiagnosticsCommandHandler(
  deps: Partial<DiagnosticsCommandDeps> = {},
): CommandHandler {
  const resolvedDeps: DiagnosticsCommandDeps = {
    ...defaultDiagnosticsCommandDeps,
    ...deps,
  };
  return async (params, allowTextCommands) =>
    await handleDiagnosticsCommandWithDeps(resolvedDeps, params, allowTextCommands);
}

export const handleDiagnosticsCommand: CommandHandler = createDiagnosticsCommandHandler();

async function handleDiagnosticsCommandWithDeps(
  deps: DiagnosticsCommandDeps,
  params: HandleCommandsParams,
  allowTextCommands: boolean,
) {
  if (!allowTextCommands) {
    return null;
  }
  const args = parseDiagnosticsArgs(params.command.commandBodyNormalized);
  if (args == null) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /diagnostics from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  if (params.isGroup) {
    return {
      shouldContinue: false,
      reply: { text: DIAGNOSTICS_GROUP_WARNING },
    };
  }
  const gatewayApproval = await requestGatewayDiagnosticsExportApproval(deps, params);
  return gatewayApproval.status === "pending"
    ? { shouldContinue: false }
    : { shouldContinue: false, reply: gatewayApproval.reply };
}

function parseDiagnosticsArgs(commandBody: string): string | undefined {
  const trimmed = commandBody.trim();
  if (trimmed === DIAGNOSTICS_COMMAND) {
    return "";
  }
  if (trimmed.startsWith(`${DIAGNOSTICS_COMMAND} `)) {
    return trimmed.slice(DIAGNOSTICS_COMMAND.length + 1).trim();
  }
  if (trimmed.startsWith(`${DIAGNOSTICS_COMMAND}:`)) {
    return trimmed.slice(DIAGNOSTICS_COMMAND.length + 1).trim();
  }
  return undefined;
}

function buildDiagnosticsPreamble(): string[] {
  return [
    "Diagnostics can include sensitive local logs and host-level runtime metadata.",
    `Treat diagnostics bundles like secrets and review what they contain before sharing: ${DIAGNOSTICS_DOCS_URL}`,
  ];
}

function buildGatewayDiagnosticsExportJsonCommand(): string {
  return buildCurrentKovaCliCommand(["gateway", "diagnostics", "export", "--json"]);
}

function readMessageThreadId(params: HandleCommandsParams): string | undefined {
  return typeof params.ctx.MessageThreadId === "string" ||
    typeof params.ctx.MessageThreadId === "number"
    ? String(params.ctx.MessageThreadId)
    : undefined;
}

function readDeliveryTarget(params: HandleCommandsParams): string | undefined {
  return (
    (typeof params.ctx.OriginatingTo === "string" && params.ctx.OriginatingTo.trim()) ||
    params.command.to ||
    params.command.from ||
    undefined
  );
}

async function requestGatewayDiagnosticsExportApproval(
  deps: DiagnosticsCommandDeps,
  params: HandleCommandsParams,
): Promise<GatewayDiagnosticsApprovalResult> {
  const timeoutSec = params.cfg.tools?.exec?.timeoutSec;
  const agentId =
    params.agentId ??
    resolveSessionAgentId({
      sessionKey: params.sessionKey,
      config: params.cfg,
    });
  const command = buildGatewayDiagnosticsExportJsonCommand();
  try {
    const execTool = deps.createExecTool({
      host: "gateway",
      security: "allowlist",
      ask: "always",
      trigger: "diagnostics",
      scopeKey: DIAGNOSTICS_EXEC_SCOPE_KEY,
      allowBackground: true,
      timeoutSec,
      cwd: params.workspaceDir,
      agentId,
      sessionKey: params.sessionKey,
      messageProvider: params.command.channel,
      currentChannelId: readDeliveryTarget(params),
      currentThreadTs: readMessageThreadId(params),
      accountId: params.ctx.AccountId ?? undefined,
      notifyOnExit: params.cfg.tools?.exec?.notifyOnExit,
      notifyOnExitEmptySuccess: params.cfg.tools?.exec?.notifyOnExitEmptySuccess,
    });
    const result = await execTool.execute("chat-diagnostics-gateway-export", {
      command,
      security: "allowlist",
      ask: "always",
      background: true,
      timeout: timeoutSec,
    });
    if (result.details?.status === "approval-pending") {
      return { status: "pending" };
    }
    const lines = buildDiagnosticsPreamble();
    lines.push(
      "",
      `Local Gateway bundle: requested \`${GATEWAY_DIAGNOSTICS_EXPORT_JSON_LABEL}\` through exec approval. Approve once to create the bundle; do not use allow-all for diagnostics.`,
      formatExecToolResultForDiagnostics(result),
    );
    return { status: "reply", reply: { text: lines.join("\n") } };
  } catch (error) {
    const lines = buildDiagnosticsPreamble();
    lines.push(
      "",
      `Local Gateway bundle: could not request exec approval for \`${GATEWAY_DIAGNOSTICS_EXPORT_JSON_LABEL}\`.`,
      formatExecDiagnosticsText(formatErrorMessage(error)),
    );
    return { status: "reply", reply: { text: lines.join("\n") } };
  }
}

function formatExecToolResultForDiagnostics(result: {
  content?: Array<{ type: string; text?: string }>;
  details?: ExecToolDetails;
}): string {
  const text = result.content
    ?.map((chunk) => (chunk.type === "text" && typeof chunk.text === "string" ? chunk.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (text) {
    return formatExecDiagnosticsText(text);
  }
  const details = result.details;
  if (details?.status === "approval-pending") {
    const decisions = details.allowedDecisions?.join(", ") || "allow-once, deny";
    return formatExecDiagnosticsText(
      `Exec approval pending (${details.approvalSlug}). Allowed decisions: ${decisions}.`,
    );
  }
  if (details?.status === "approval-unavailable") {
    return formatExecDiagnosticsText(
      `Exec approval unavailable (${details.reason}). Run \`${GATEWAY_DIAGNOSTICS_EXPORT_JSON_LABEL}\` locally if needed.`,
    );
  }
  if (details?.status === "running") {
    return formatExecDiagnosticsText(
      `Gateway diagnostics export is running (exec session ${details.sessionId}).`,
    );
  }
  if (details?.status === "completed" || details?.status === "failed") {
    return formatExecDiagnosticsText(details.aggregated);
  }
  return "(no exec details returned)";
}

function formatExecDiagnosticsText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "(no exec output)";
  }
  return trimmed;
}
