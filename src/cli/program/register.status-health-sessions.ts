import type { Command } from "commander";
import { flowsCancelCommand, flowsListCommand, flowsShowCommand } from "../../commands/flows.js";
import {
  goalsAddCommand,
  goalsCancelCommand,
  goalsDoneCommand,
  goalsFailCommand,
  goalsListCommand,
  goalsSetCommand,
  goalsShowCommand,
} from "../../commands/goals.js";
import { healthCommand } from "../../commands/health.js";
import { sessionsCheckpointsCommand } from "../../commands/sessions-checkpoints.js";
import { sessionsCleanupCommand } from "../../commands/sessions-cleanup.js";
import { sessionsCommand } from "../../commands/sessions.js";
import { statusCommand } from "../../commands/status.js";
import {
  tasksAuditCommand,
  tasksCancelCommand,
  tasksListCommand,
  tasksMaintenanceCommand,
  tasksNotifyCommand,
  tasksReportCommand,
  tasksShowCommand,
} from "../../commands/tasks.js";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import {
  addGatewayClientOptions,
  callGatewayFromCli,
  type GatewayRpcOpts,
} from "../gateway-rpc.js";
import { formatHelpExamples } from "../help-format.js";
import { parsePositiveIntOrUndefined } from "./helpers.js";

type SessionsCheckpointsCliOpts = GatewayRpcOpts & {
  checkpointId?: string;
  branch?: boolean;
  restore?: boolean;
  confirm?: boolean;
  json?: boolean;
};

function resolveVerbose(opts: { verbose?: boolean; debug?: boolean }): boolean {
  return Boolean(opts.verbose || opts.debug);
}

function parseTimeoutMs(timeout: unknown): number | null | undefined {
  const parsed = parsePositiveIntOrUndefined(timeout);
  if (timeout !== undefined && parsed === undefined) {
    defaultRuntime.error("--timeout must be a positive integer (milliseconds)");
    defaultRuntime.exit(1);
    return null;
  }
  return parsed;
}

async function runWithVerboseAndTimeout(
  opts: { verbose?: boolean; debug?: boolean; timeout?: unknown },
  action: (params: { verbose: boolean; timeoutMs: number | undefined }) => Promise<void>,
): Promise<void> {
  const verbose = resolveVerbose(opts);
  setVerbose(verbose);
  const timeoutMs = parseTimeoutMs(opts.timeout);
  if (timeoutMs === null) {
    return;
  }
  await runCommandWithRuntime(defaultRuntime, async () => {
    await action({ verbose, timeoutMs });
  });
}

export function registerStatusHealthSessionsCommands(program: Command) {
  program
    .command("status")
    .description("Show terminal readiness, Gateway health, and recent sessions")
    .option("--json", "Output JSON instead of text", false)
    .option("--all", "Full diagnosis (read-only, pasteable)", false)
    .option("--usage", "Show model provider usage/quota snapshots", false)
    .option("--deep", "Probe channels (WhatsApp Web + Telegram + Discord + Slack + Signal)", false)
    .option("--timeout <ms>", "Probe timeout in milliseconds", "10000")
    .option("--verbose", "Verbose logging", false)
    .option("--debug", "Alias for --verbose", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["kova status", "Show terminal readiness + session summary."],
          ["kova status --all", "Full diagnosis (read-only)."],
          ["kova status --json", "Machine-readable output."],
          ["kova status --usage", "Show model provider usage/quota snapshots."],
          ["kova status --deep", "Run channel probes (WA + Telegram + Discord + Slack + Signal)."],
          ["kova status --deep --timeout 5000", "Tighten probe timeout."],
        ])}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/status", "docs.neuralstudio.in/cli/status")}\n`,
    )
    .action(async (opts) => {
      await runWithVerboseAndTimeout(opts, async ({ verbose, timeoutMs }) => {
        await statusCommand(
          {
            json: Boolean(opts.json),
            all: Boolean(opts.all),
            deep: Boolean(opts.deep),
            usage: Boolean(opts.usage),
            timeoutMs,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  program
    .command("health")
    .description("Fetch health from the running gateway")
    .option("--json", "Output JSON instead of text", false)
    .option("--timeout <ms>", "Connection timeout in milliseconds", "10000")
    .option("--verbose", "Verbose logging", false)
    .option("--debug", "Alias for --verbose", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/health", "docs.neuralstudio.in/cli/health")}\n`,
    )
    .action(async (opts) => {
      await runWithVerboseAndTimeout(opts, async ({ verbose, timeoutMs }) => {
        await healthCommand(
          {
            json: Boolean(opts.json),
            timeoutMs,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  const sessionsCmd = program
    .command("sessions")
    .description("List stored conversation sessions")
    .option("--json", "Output as JSON", false)
    .option("--verbose", "Verbose logging", false)
    .option("--store <path>", "Path to session store (default: resolved from config)")
    .option("--agent <id>", "Agent id to inspect (default: configured default agent)")
    .option("--all-agents", "Aggregate sessions across all configured agents", false)
    .option("--active <minutes>", "Only show sessions updated within the past N minutes")
    .option("--search <query>", "Filter sessions by key, id, model, agent, kind, or flags")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["kova sessions", "List all sessions."],
          ["kova sessions --agent work", "List sessions for one agent."],
          ["kova sessions --all-agents", "Aggregate sessions across agents."],
          ["kova sessions --active 120", "Only last 2 hours."],
          ["kova sessions --search research", "Filter sessions by metadata."],
          ["kova sessions --json", "Machine-readable output."],
          ["kova sessions --store ./tmp/sessions.json", "Use a specific session store."],
        ])}\n\n${theme.muted(
          "Shows token usage per session when the agent reports it; set agents.defaults.contextTokens to cap the window and show %.",
        )}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/sessions", "docs.neuralstudio.in/cli/sessions")}\n`,
    )
    .action(async (opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionsCommand(
        {
          json: Boolean(opts.json),
          store: opts.store as string | undefined,
          agent: opts.agent as string | undefined,
          allAgents: Boolean(opts.allAgents),
          active: opts.active as string | undefined,
          search: opts.search as string | undefined,
        },
        defaultRuntime,
      );
    });
  sessionsCmd.enablePositionalOptions();

  addGatewayClientOptions(
    sessionsCmd
      .command("checkpoints")
      .description("List, branch, or restore compaction checkpoints")
      .argument("<key>", "Session key")
      .option("--checkpoint-id <id>", "Checkpoint id to show, branch, or restore")
      .option("--branch", "Create a new session branch from the checkpoint", false)
      .option("--restore", "Restore this session from the checkpoint (requires --confirm)", false)
      .option("--confirm", "Confirm --restore replaces the current session", false)
      .option("--json", "Output JSON", false)
      .addHelpText(
        "after",
        () =>
          `\n${theme.heading("Examples:")}\n${formatHelpExamples([
            ["kova sessions checkpoints agent:main:main", "List checkpoints."],
            [
              "kova sessions checkpoints agent:main:main --checkpoint-id <id>",
              "Show checkpoint details.",
            ],
            [
              "kova sessions checkpoints agent:main:main --checkpoint-id <id> --branch",
              "Create a separate branch.",
            ],
            [
              "kova sessions checkpoints agent:main:main --checkpoint-id <id> --restore",
              "Preview a restore.",
            ],
            [
              "kova sessions checkpoints agent:main:main --checkpoint-id <id> --restore --confirm",
              "Apply the restore.",
            ],
          ])}`,
      ),
  ).action(async (key: string, opts: SessionsCheckpointsCliOpts, command) => {
    const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
    await runCommandWithRuntime(defaultRuntime, async () => {
      await sessionsCheckpointsCommand(
        {
          key,
          checkpointId: opts.checkpointId,
          branch: Boolean(opts.branch),
          restore: Boolean(opts.restore),
          confirm: Boolean(opts.confirm),
          json: Boolean(opts.json || parentOpts?.json),
        },
        defaultRuntime,
        {
          callGateway: async (method, params) =>
            await callGatewayFromCli(method, opts, params, { expectFinal: false }),
        },
      );
    });
  });

  sessionsCmd
    .command("cleanup")
    .description("Run session-store maintenance now")
    .option("--store <path>", "Path to session store (default: resolved from config)")
    .option("--agent <id>", "Agent id to maintain (default: configured default agent)")
    .option("--all-agents", "Run maintenance across all configured agents", false)
    .option("--dry-run", "Preview maintenance actions without writing", false)
    .option("--enforce", "Apply maintenance even when configured mode is warn", false)
    .option(
      "--fix-missing",
      "Remove store entries whose transcript files are missing (bypasses age/count retention)",
      false,
    )
    .option("--active-key <key>", "Protect this session key from budget-eviction")
    .option("--json", "Output JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["kova sessions cleanup --dry-run", "Preview stale/cap cleanup."],
          [
            "kova sessions cleanup --dry-run --fix-missing",
            "Also preview pruning entries with missing transcript files.",
          ],
          ["kova sessions cleanup --enforce", "Apply maintenance now."],
          ["kova sessions cleanup --agent work --dry-run", "Preview one agent store."],
          ["kova sessions cleanup --all-agents --dry-run", "Preview all agent stores."],
          ["kova sessions cleanup --enforce --store ./tmp/sessions.json", "Use a specific store."],
        ])}`,
    )
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            store?: string;
            agent?: string;
            allAgents?: boolean;
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await sessionsCleanupCommand(
          {
            store: (opts.store as string | undefined) ?? parentOpts?.store,
            agent: (opts.agent as string | undefined) ?? parentOpts?.agent,
            allAgents: Boolean(opts.allAgents || parentOpts?.allAgents),
            dryRun: Boolean(opts.dryRun),
            enforce: Boolean(opts.enforce),
            fixMissing: Boolean(opts.fixMissing),
            activeKey: opts.activeKey as string | undefined,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  const tasksCmd = program
    .command("tasks")
    .description("Inspect durable background tasks and TaskFlow state")
    .option("--json", "Output as JSON", false)
    .option("--runtime <name>", "Filter by kind (subagent, acp, cron, cli)")
    .option(
      "--status <name>",
      "Filter by status (queued, running, succeeded, failed, timed_out, cancelled, lost)",
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksListCommand(
          {
            json: Boolean(opts.json),
            runtime: opts.runtime as string | undefined,
            status: opts.status as string | undefined,
          },
          defaultRuntime,
        );
      });
    });
  tasksCmd.enablePositionalOptions();

  tasksCmd
    .command("list")
    .description("List tracked background tasks")
    .option("--json", "Output as JSON", false)
    .option("--runtime <name>", "Filter by kind (subagent, acp, cron, cli)")
    .option(
      "--status <name>",
      "Filter by status (queued, running, succeeded, failed, timed_out, cancelled, lost)",
    )
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            runtime?: string;
            status?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksListCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            runtime: (opts.runtime as string | undefined) ?? parentOpts?.runtime,
            status: (opts.status as string | undefined) ?? parentOpts?.status,
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("audit")
    .description("Show stale or broken background tasks and TaskFlows")
    .option("--json", "Output as JSON", false)
    .option("--severity <level>", "Filter by severity (warn, error)")
    .option(
      "--code <name>",
      "Filter by finding code (stale_queued, stale_running, lost, delivery_failed, missing_cleanup, inconsistent_timestamps, restore_failed, stale_waiting, stale_blocked, cancel_stuck, missing_linked_tasks, blocked_task_missing)",
    )
    .option("--limit <n>", "Limit displayed findings")
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksAuditCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            severity: opts.severity as "warn" | "error" | undefined,
            code: opts.code as
              | "stale_queued"
              | "stale_running"
              | "lost"
              | "delivery_failed"
              | "missing_cleanup"
              | "inconsistent_timestamps"
              | "restore_failed"
              | "stale_waiting"
              | "stale_blocked"
              | "cancel_stuck"
              | "missing_linked_tasks"
              | "blocked_task_missing"
              | undefined,
            limit: parsePositiveIntOrUndefined(opts.limit),
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("report")
    .description("Summarize background automation task health")
    .option("--json", "Output as JSON", false)
    .option("--runtime <name>", "Filter by kind (subagent, acp, cron, cli)")
    .option(
      "--status <name>",
      "Filter by status (queued, running, succeeded, failed, timed_out, cancelled, lost)",
    )
    .option("--limit <n>", "Limit active task and issue rows")
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            json?: boolean;
            runtime?: string;
            status?: string;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksReportCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            runtime: (opts.runtime as string | undefined) ?? parentOpts?.runtime,
            status: (opts.status as string | undefined) ?? parentOpts?.status,
            limit: parsePositiveIntOrUndefined(opts.limit),
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("maintenance")
    .description("Preview or apply tasks and TaskFlow maintenance")
    .option("--json", "Output as JSON", false)
    .option("--apply", "Apply reconciliation, cleanup stamping, and pruning", false)
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksMaintenanceCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            apply: Boolean(opts.apply),
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("show")
    .description("Show one background task by task id, run id, or session key")
    .argument("<lookup>", "Task id, run id, or session key")
    .option("--json", "Output as JSON", false)
    .action(async (lookup, opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksShowCommand(
          {
            lookup,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("notify")
    .description("Set task notify policy")
    .argument("<lookup>", "Task id, run id, or session key")
    .argument("<notify>", "Notify policy (done_only, state_changes, silent)")
    .action(async (lookup, notify) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksNotifyCommand(
          {
            lookup,
            notify: notify as "done_only" | "state_changes" | "silent",
          },
          defaultRuntime,
        );
      });
    });

  tasksCmd
    .command("cancel")
    .description("Cancel a running background task")
    .argument("<lookup>", "Task id, run id, or session key")
    .action(async (lookup) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await tasksCancelCommand(
          {
            lookup,
          },
          defaultRuntime,
        );
      });
    });

  const tasksFlowCmd = tasksCmd
    .command("flow")
    .description("Inspect durable TaskFlow state under tasks");

  tasksFlowCmd
    .command("list")
    .description("List tracked TaskFlows")
    .option("--json", "Output as JSON", false)
    .option(
      "--status <name>",
      "Filter by status (queued, running, waiting, blocked, succeeded, failed, cancelled, lost)",
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await flowsListCommand(
          {
            json: Boolean(opts.json),
            status: opts.status as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  tasksFlowCmd
    .command("show")
    .description("Show one TaskFlow by flow id or owner key")
    .argument("<lookup>", "Flow id or owner key")
    .option("--json", "Output as JSON", false)
    .action(async (lookup, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await flowsShowCommand(
          {
            lookup,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  tasksFlowCmd
    .command("cancel")
    .description("Cancel a running TaskFlow")
    .argument("<lookup>", "Flow id or owner key")
    .action(async (lookup) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await flowsCancelCommand(
          {
            lookup,
          },
          defaultRuntime,
        );
      });
    });

  const goalsCmd = program
    .command("goals")
    .description("Manage durable terminal goals backed by TaskFlow")
    .option("--json", "Output as JSON", false)
    .option(
      "--status <name>",
      "Filter by status (queued, running, waiting, blocked, succeeded, failed, cancelled, lost)",
    )
    .option("--all", "Include finished goals", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await goalsListCommand(
          {
            json: Boolean(opts.json),
            status: opts.status as string | undefined,
            all: Boolean(opts.all),
          },
          defaultRuntime,
        );
      });
    });
  goalsCmd.enablePositionalOptions();

  goalsCmd
    .command("list")
    .description("List active or finished goals")
    .option("--json", "Output as JSON", false)
    .option(
      "--status <name>",
      "Filter by status (queued, running, waiting, blocked, succeeded, failed, cancelled, lost)",
    )
    .option("--all", "Include finished goals", false)
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | { json?: boolean; status?: string; all?: boolean }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await goalsListCommand(
          {
            json: Boolean(opts.json || parentOpts?.json),
            status: (opts.status as string | undefined) ?? parentOpts?.status,
            all: Boolean(opts.all || parentOpts?.all),
          },
          defaultRuntime,
        );
      });
    });

  goalsCmd
    .command("add")
    .description("Create a durable goal")
    .argument("<goal>", "Goal text")
    .option("--json", "Output as JSON", false)
    .option("--step <text>", "Initial current step")
    .option("--agent <id>", "Attach the goal to an agent main session")
    .action(async (goal, opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await goalsAddCommand(
          {
            goal,
            step: opts.step as string | undefined,
            agent: opts.agent as string | undefined,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  goalsCmd
    .command("show")
    .description("Show one durable goal")
    .argument("<lookup>", "Goal id or owner key")
    .option("--json", "Output as JSON", false)
    .action(async (lookup, opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await goalsShowCommand(
          {
            lookup,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  goalsCmd
    .command("set")
    .description("Update an active goal status or current step")
    .argument("<lookup>", "Goal id or owner key")
    .option("--json", "Output as JSON", false)
    .option("--status <name>", "Set active status (queued, running, waiting, blocked)")
    .option("--step <text>", "Set current step")
    .action(async (lookup, opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean; status?: string } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await goalsSetCommand(
          {
            lookup,
            status: (opts.status as string | undefined) ?? parentOpts?.status,
            step: opts.step as string | undefined,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  goalsCmd
    .command("done")
    .description("Mark a goal succeeded")
    .argument("<lookup>", "Goal id or owner key")
    .option("--json", "Output as JSON", false)
    .option("--step <text>", "Final step label")
    .action(async (lookup, opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await goalsDoneCommand(
          {
            lookup,
            step: opts.step as string | undefined,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  goalsCmd
    .command("fail")
    .description("Mark a goal failed")
    .argument("<lookup>", "Goal id or owner key")
    .option("--json", "Output as JSON", false)
    .option("--step <text>", "Final step label")
    .option("--reason <text>", "Failure reason")
    .action(async (lookup, opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await goalsFailCommand(
          {
            lookup,
            step: opts.step as string | undefined,
            reason: opts.reason as string | undefined,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });

  goalsCmd
    .command("cancel")
    .description("Cancel a running goal and active child tasks")
    .argument("<lookup>", "Goal id or owner key")
    .option("--json", "Output as JSON", false)
    .action(async (lookup, opts, command) => {
      const parentOpts = command.parent?.opts() as { json?: boolean } | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await goalsCancelCommand(
          {
            lookup,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });
}
