import { formatCliCommand } from "../../cli/command-format.js";
import {
  formatUpdateAvailableHint,
  formatUpdateOneLiner,
  getUpdateCheckResult,
} from "../../commands/status.update.js";
import { isRestartEnabled } from "../../config/commands.flags.js";
import { resolveKovaPackageRoot } from "../../infra/kova-root.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";
import { normalizeUpdateChannel } from "../../infra/update-channels.js";
import { runGatewayUpdate, type UpdateRunResult } from "../../infra/update-runner.js";
import { normalizeLowercaseStringOrEmpty } from "../../shared/string-coerce.js";
import { rejectNonOwnerCommand, rejectUnauthorizedCommand } from "./command-gates.js";
import type { CommandHandler } from "./commands-types.js";

type UpdateSlashAction = "help" | "run" | "status";

function parseUpdateSlashAction(rawBody: string): UpdateSlashAction | null {
  const rest = rawBody.replace(/^\/update\b/i, "").trim();
  if (!rest) {
    return "run";
  }
  const first = normalizeLowercaseStringOrEmpty(rest.split(/\s+/)[0]);
  if (!first || first === "run" || first === "now" || first === "yes") {
    return "run";
  }
  if (first === "status" || first === "check" || first === "info") {
    return "status";
  }
  if (first === "help" || first === "?") {
    return "help";
  }
  return null;
}

function shortRevision(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.length > 12 ? value.slice(0, 8) : value;
}

function formatBeforeAfter(result: UpdateRunResult): string[] {
  const before = result.before?.version ?? shortRevision(result.before?.sha);
  const after = result.after?.version ?? shortRevision(result.after?.sha);
  const lines: string[] = [];
  if (before) {
    lines.push(`- Before: ${before}`);
  }
  if (after) {
    lines.push(`- After: ${after}`);
  }
  return lines;
}

function formatUpdateRunResult(params: {
  result: UpdateRunResult;
  restartScheduled: boolean;
  restartAvailable: boolean;
}): string {
  const { result } = params;
  const failedStep = [...result.steps].toReversed().find((step) => step.exitCode !== 0);
  const lines = [
    `Kova update ${result.status}`,
    `- Mode: ${result.mode}`,
    ...(result.reason ? [`- Reason: ${result.reason}`] : []),
    ...formatBeforeAfter(result),
    `- Steps: ${result.steps.length}`,
  ];
  if (failedStep) {
    lines.push(`- Failed step: ${failedStep.name}`);
  }
  if (result.status === "ok") {
    lines.push(
      params.restartScheduled
        ? "- Restart: scheduled"
        : params.restartAvailable
          ? `- Restart: not scheduled; run ${formatCliCommand("kova gateway restart")} if the old process stays up.`
          : `- Restart: reopen the terminal chat or restart Kova manually.`,
    );
  }
  if (result.status === "skipped" && result.reason === "dirty") {
    lines.push("- Fix: commit or stash local changes, then run /update again.");
  }
  return lines.join("\n");
}

async function formatUpdateStatusReply(): Promise<string> {
  const update = await getUpdateCheckResult({
    timeoutMs: 3500,
    fetchGit: true,
    includeRegistry: true,
  });
  const hint = formatUpdateAvailableHint(update);
  return ["Kova update status", `- ${formatUpdateOneLiner(update).replace(/^Update:\s*/i, "")}`]
    .concat(
      hint ? [`- ${hint}`] : [`- Run ${formatCliCommand("kova update")} or /update to update.`],
    )
    .join("\n");
}

export const handleUpdateCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const commandBody = params.command.commandBodyNormalized;
  if (commandBody !== "/update" && !commandBody.startsWith("/update ")) {
    return null;
  }

  const action = parseUpdateSlashAction(commandBody);
  if (!action) {
    return {
      shouldContinue: false,
      reply: {
        text: [
          "Usage: /update [status|run]",
          "- /update runs the updater.",
          "- /update status checks the current install.",
        ].join("\n"),
      },
    };
  }

  const unauthorized = rejectUnauthorizedCommand(params, "/update");
  if (unauthorized) {
    return unauthorized;
  }
  const nonOwner = rejectNonOwnerCommand(params, "/update");
  if (nonOwner) {
    return nonOwner;
  }

  if (action === "help") {
    return {
      shouldContinue: false,
      reply: {
        text: [
          "Usage: /update [status|run]",
          "- /update runs the updater using the configured update channel.",
          "- /update status checks git/npm update state.",
          `- CLI with progress: ${formatCliCommand("kova update")}`,
        ].join("\n"),
      },
    };
  }

  if (action === "status") {
    return {
      shouldContinue: false,
      reply: { text: await formatUpdateStatusReply() },
    };
  }

  if (!isRestartEnabled(params.cfg)) {
    return {
      shouldContinue: false,
      reply: {
        text: "Update is disabled because commands.restart=false. Enable restart commands or run kova update from the shell.",
      },
    };
  }

  const root =
    (await resolveKovaPackageRoot({
      moduleUrl: import.meta.url,
      argv1: process.argv[1],
      cwd: process.cwd(),
    })) ?? process.cwd();
  const channel = normalizeUpdateChannel(params.cfg.update?.channel) ?? undefined;
  const result = await runGatewayUpdate({
    cwd: root,
    argv1: process.argv[1],
    channel,
  });
  const restartAvailable = process.listenerCount("SIGUSR1") > 0;
  const restart =
    result.status === "ok" && restartAvailable
      ? scheduleGatewaySigusr1Restart({
          delayMs: 1500,
          reason: "/update",
          audit: {
            actor: "command:/update",
            changedPaths: [],
          },
        })
      : null;

  return {
    shouldContinue: false,
    reply: {
      text: formatUpdateRunResult({
        result,
        restartScheduled: Boolean(restart),
        restartAvailable,
      }),
    },
  };
};
