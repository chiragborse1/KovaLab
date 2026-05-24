import type { Command } from "commander";
import type { CronJob } from "../../cron/types.js";
import { sanitizeAgentId } from "../../routing/session-key.js";
import { defaultRuntime } from "../../runtime.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "../../shared/string-coerce.js";
import type { GatewayRpcOpts } from "../gateway-rpc.js";
import { addGatewayClientOptions, callGatewayFromCli } from "../gateway-rpc.js";
import { parsePositiveIntOrUndefined } from "../program/helpers.js";
import { resolveCronCreateSchedule } from "./schedule-options.js";
import {
  getCronChannelOptions,
  coerceCronDeliveryPreviews,
  handleCronCliError,
  parseCronToolsAllow,
  printCronJson,
  printCronList,
  printCronStatus,
  warnIfCronSchedulerDisabled,
} from "./shared.js";

type CronAddTemplateSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; every: string }
  | { kind: "cron"; expr: string; tz?: string; stagger?: string; exact?: boolean };

type CronAddTemplateDefaults = {
  name: string;
  schedule: CronAddTemplateSchedule;
  session: "main" | "isolated" | "current" | `session:${string}`;
  wake?: "now" | "next-heartbeat";
  systemEvent?: string;
  message?: string;
  lightContext?: boolean;
  announce?: boolean;
  noDeliver?: boolean;
  channel?: string;
};

type CronAddTemplate = {
  id: string;
  title: string;
  description: string;
  defaults: CronAddTemplateDefaults;
};

const CRON_ADD_TEMPLATES: CronAddTemplate[] = [
  {
    id: "daily-brief",
    title: "Daily brief",
    description: "Ask the agent for a concise morning plan every day.",
    defaults: {
      name: "Daily brief",
      schedule: { kind: "cron", expr: "0 8 * * *", tz: "UTC", stagger: "5m" },
      session: "isolated",
      wake: "now",
      message:
        "Prepare a concise daily brief with schedule items, reminders, and the most important next actions.",
      lightContext: true,
      announce: true,
      channel: "last",
    },
  },
  {
    id: "weekly-review",
    title: "Weekly review",
    description: "Create a weekly planning and follow-up review.",
    defaults: {
      name: "Weekly review",
      schedule: { kind: "cron", expr: "0 9 * * 1", tz: "UTC", stagger: "10m" },
      session: "isolated",
      wake: "now",
      message:
        "Review the past week, summarize open loops, and suggest a focused plan for this week.",
      lightContext: true,
      announce: true,
      channel: "last",
    },
  },
  {
    id: "hourly-check",
    title: "Hourly check",
    description: "Run a lightweight recurring check without chat delivery.",
    defaults: {
      name: "Hourly check",
      schedule: { kind: "every", every: "1h" },
      session: "isolated",
      wake: "next-heartbeat",
      message: "Check whether anything needs attention. Reply only when there is a clear action.",
      lightContext: true,
      noDeliver: true,
    },
  },
  {
    id: "reminder",
    title: "Reminder",
    description: "Create a one-shot reminder 20 minutes from now.",
    defaults: {
      name: "Reminder",
      schedule: { kind: "at", at: "20m" },
      session: "isolated",
      wake: "now",
      message: "Remind me to follow up.",
      lightContext: true,
      announce: true,
      channel: "last",
    },
  },
];

const CRON_ADD_TEMPLATE_IDS = CRON_ADD_TEMPLATES.map((template) => template.id);

function normalizeTemplateId(input: unknown): string {
  return normalizeLowercaseStringOrEmpty(input).replaceAll("_", "-");
}

function resolveCronAddTemplate(input: unknown): CronAddTemplate | undefined {
  const id = normalizeTemplateId(input);
  if (!id) {
    return undefined;
  }
  const template = CRON_ADD_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) {
    throw new Error(`Unknown --template "${id}". Use: ${CRON_ADD_TEMPLATE_IDS.join("|")}`);
  }
  return template;
}

function formatCronTemplateCommand(template: CronAddTemplate): string {
  return `kova cron add --template ${template.id}`;
}

export function registerCronStatusCommand(cron: Command) {
  addGatewayClientOptions(
    cron
      .command("status")
      .description("Show cron scheduler status")
      .option("--json", "Output JSON", false)
      .action(async (opts) => {
        try {
          const res = await callGatewayFromCli("cron.status", opts, {});
          if (opts.json) {
            printCronJson(res);
            return;
          }
          printCronStatus(res);
        } catch (err) {
          handleCronCliError(err);
        }
      }),
  );
}

export function registerCronListCommand(cron: Command) {
  addGatewayClientOptions(
    cron
      .command("list")
      .description("List cron jobs")
      .option("--all", "Include disabled jobs", false)
      .option("--json", "Output JSON", false)
      .action(async (opts) => {
        try {
          const res = await callGatewayFromCli("cron.list", opts, {
            includeDisabled: Boolean(opts.all),
          });
          if (opts.json) {
            printCronJson(res);
            return;
          }
          const jobs = (res as { jobs?: CronJob[] } | null)?.jobs ?? [];
          const deliveryPreviews = coerceCronDeliveryPreviews(res);
          printCronList(jobs, defaultRuntime, { deliveryPreviews });
        } catch (err) {
          handleCronCliError(err);
        }
      }),
  );
}

export function registerCronTemplatesCommand(cron: Command) {
  cron
    .command("templates")
    .alias("presets")
    .description("List cron add templates")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      if (opts.json) {
        printCronJson(CRON_ADD_TEMPLATES);
        return;
      }
      defaultRuntime.log("Cron templates:");
      for (const template of CRON_ADD_TEMPLATES) {
        defaultRuntime.log(
          [
            `${template.id} - ${template.title}`,
            `  ${template.description}`,
            `  ${formatCronTemplateCommand(template)}`,
          ].join("\n"),
        );
      }
    });
}

export function registerCronAddCommand(cron: Command) {
  addGatewayClientOptions(
    cron
      .command("add")
      .alias("create")
      .description("Add a cron job")
      .option("--template <name>", `Apply a template (${CRON_ADD_TEMPLATE_IDS.join("|")})`)
      .option("--name <name>", "Job name")
      .option("--description <text>", "Optional description")
      .option("--disabled", "Create job disabled", false)
      .option("--delete-after-run", "Delete one-shot job after it succeeds", false)
      .option("--keep-after-run", "Keep one-shot job after it succeeds", false)
      .option("--agent <id>", "Agent id for this job")
      .option("--session <target>", "Session target (main|isolated)")
      .option("--session-key <key>", "Session key for job routing (e.g. agent:my-agent:my-session)")
      .option("--wake <mode>", "Wake mode (now|next-heartbeat)", "now")
      .option(
        "--at <when>",
        "Run once at time (ISO with offset, or +duration). Use --tz for offset-less datetimes",
      )
      .option("--every <duration>", "Run every duration (e.g. 10m, 1h)")
      .option("--cron <expr>", "Cron expression (5-field or 6-field with seconds)")
      .option("--tz <iana>", "Timezone for cron expressions (IANA)", "")
      .option("--stagger <duration>", "Cron stagger window (e.g. 30s, 5m)")
      .option("--exact", "Disable cron staggering (set stagger to 0)", false)
      .option("--system-event <text>", "System event payload (main session)")
      .option("--message <text>", "Agent message payload")
      .option(
        "--thinking <level>",
        "Thinking level for agent jobs (off|minimal|low|medium|high|xhigh)",
      )
      .option("--model <model>", "Model override for agent jobs (provider/model or alias)")
      .option("--timeout-seconds <n>", "Timeout seconds for agent jobs")
      .option("--light-context", "Use lightweight bootstrap context for agent jobs", false)
      .option("--tools <list>", "Tool allow-list (e.g. exec,read,write or exec read write)")
      .option("--announce", "Fallback-deliver final text to a chat", false)
      .option("--deliver", "Deprecated (use --announce). Fallback-delivers final text to a chat.")
      .option("--no-deliver", "Disable runner fallback delivery")
      .option("--channel <channel>", `Delivery channel (${getCronChannelOptions()})`, "last")
      .option(
        "--to <dest>",
        "Delivery destination (E.164, Telegram chatId, or Discord channel/user)",
      )
      .option("--account <id>", "Channel account id for delivery (multi-account setups)")
      .option("--best-effort-deliver", "Do not fail the job if delivery fails", false)
      .option("--json", "Output JSON", false)
      .action(async (opts: GatewayRpcOpts & Record<string, unknown>, cmd?: Command) => {
        try {
          const template = resolveCronAddTemplate(opts.template);
          const templateDefaults = template?.defaults;
          const optionSource =
            typeof cmd?.getOptionValueSource === "function"
              ? (name: string) => cmd.getOptionValueSource(name)
              : () => undefined;
          const fromCli = (name: string) => optionSource(name) === "cli";
          const withTemplateDefault = (name: string, templateValue: unknown) =>
            fromCli(name) ? opts[name] : (templateValue ?? opts[name]);
          const scheduleFromCli = ["at", "cron", "every"].some(fromCli);
          const templateSchedule = scheduleFromCli ? undefined : templateDefaults?.schedule;
          const schedule = resolveCronCreateSchedule({
            at: withTemplateDefault(
              "at",
              templateSchedule?.kind === "at" ? templateSchedule.at : undefined,
            ),
            cron: withTemplateDefault(
              "cron",
              templateSchedule?.kind === "cron" ? templateSchedule.expr : undefined,
            ),
            every: withTemplateDefault(
              "every",
              templateSchedule?.kind === "every" ? templateSchedule.every : undefined,
            ),
            exact: withTemplateDefault(
              "exact",
              templateSchedule?.kind === "cron" ? templateSchedule.exact : undefined,
            ),
            stagger: withTemplateDefault(
              "stagger",
              templateSchedule?.kind === "cron" ? templateSchedule.stagger : undefined,
            ),
            tz: withTemplateDefault(
              "tz",
              templateSchedule?.kind === "cron" ? templateSchedule.tz : undefined,
            ),
          });

          const wakeMode =
            normalizeOptionalString(withTemplateDefault("wake", templateDefaults?.wake)) ?? "now";
          if (wakeMode !== "now" && wakeMode !== "next-heartbeat") {
            throw new Error("--wake must be now or next-heartbeat");
          }

          const rawAgentId = normalizeOptionalString(opts.agent);
          const agentId = rawAgentId ? sanitizeAgentId(rawAgentId) : undefined;

          const deliverFromCli = fromCli("deliver");
          const hasAnnounce =
            opts.deliver === true ||
            (!deliverFromCli &&
              (fromCli("announce") ? Boolean(opts.announce) : templateDefaults?.announce === true));
          const hasNoDeliver =
            opts.deliver === false || (!deliverFromCli && templateDefaults?.noDeliver === true);
          const deliveryFlagCount = [hasAnnounce, hasNoDeliver].filter(Boolean).length;
          if (deliveryFlagCount > 1) {
            throw new Error("Choose at most one of --announce or --no-deliver");
          }

          const payload = (() => {
            const systemEvent =
              normalizeOptionalString(
                withTemplateDefault("systemEvent", templateDefaults?.systemEvent),
              ) ?? "";
            const message =
              normalizeOptionalString(withTemplateDefault("message", templateDefaults?.message)) ??
              "";
            const chosen = [Boolean(systemEvent), Boolean(message)].filter(Boolean).length;
            if (chosen !== 1) {
              throw new Error("Choose exactly one payload: --system-event or --message");
            }
            if (systemEvent) {
              return { kind: "systemEvent" as const, text: systemEvent };
            }
            const timeoutSeconds = parsePositiveIntOrUndefined(opts.timeoutSeconds);
            const lightContext = withTemplateDefault(
              "lightContext",
              templateDefaults?.lightContext,
            );
            return {
              kind: "agentTurn" as const,
              message,
              model: normalizeOptionalString(opts.model),
              thinking: normalizeOptionalString(opts.thinking),
              timeoutSeconds:
                timeoutSeconds && Number.isFinite(timeoutSeconds) ? timeoutSeconds : undefined,
              lightContext: lightContext ? true : undefined,
              toolsAllow: parseCronToolsAllow(opts.tools),
            };
          })();

          const sessionSource = optionSource("session");
          const sessionTargetRaw =
            normalizeOptionalString(withTemplateDefault("session", templateDefaults?.session)) ??
            "";
          const inferredSessionTarget = payload.kind === "agentTurn" ? "isolated" : "main";
          const sessionTarget =
            sessionSource === "cli"
              ? sessionTargetRaw || ""
              : (templateDefaults?.session ?? inferredSessionTarget);
          const isCustomSessionTarget =
            normalizeLowercaseStringOrEmpty(sessionTarget).startsWith("session:") &&
            Boolean(normalizeOptionalString(sessionTarget.slice(8)));
          const isIsolatedLikeSessionTarget =
            sessionTarget === "isolated" || sessionTarget === "current" || isCustomSessionTarget;
          if (sessionTarget !== "main" && !isIsolatedLikeSessionTarget) {
            throw new Error("--session must be main, isolated, current, or session:<id>");
          }

          if (opts.deleteAfterRun && opts.keepAfterRun) {
            throw new Error("Choose --delete-after-run or --keep-after-run, not both");
          }

          if (sessionTarget === "main" && payload.kind !== "systemEvent") {
            throw new Error("Main jobs require --system-event (systemEvent).");
          }
          if (isIsolatedLikeSessionTarget && payload.kind !== "agentTurn") {
            throw new Error("Isolated/current/custom-session jobs require --message (agentTurn).");
          }
          if (
            (opts.announce || typeof opts.deliver === "boolean") &&
            (!isIsolatedLikeSessionTarget || payload.kind !== "agentTurn")
          ) {
            throw new Error("--announce/--no-deliver require a non-main agentTurn session target.");
          }

          const accountId = normalizeOptionalString(opts.account);

          if (accountId && (!isIsolatedLikeSessionTarget || payload.kind !== "agentTurn")) {
            throw new Error("--account requires a non-main agentTurn job with delivery.");
          }

          const deliveryMode =
            isIsolatedLikeSessionTarget && payload.kind === "agentTurn"
              ? hasAnnounce
                ? "announce"
                : hasNoDeliver
                  ? "none"
                  : "announce"
              : undefined;

          const name =
            normalizeOptionalString(withTemplateDefault("name", templateDefaults?.name)) ?? "";
          if (!name) {
            throw new Error("--name is required");
          }

          const description = normalizeOptionalString(opts.description);

          const sessionKey = normalizeOptionalString(opts.sessionKey);

          const params = {
            name,
            description,
            enabled: !opts.disabled,
            deleteAfterRun: opts.deleteAfterRun ? true : opts.keepAfterRun ? false : undefined,
            agentId,
            sessionKey,
            schedule,
            sessionTarget,
            wakeMode,
            payload,
            delivery: deliveryMode
              ? {
                  mode: deliveryMode,
                  channel: normalizeOptionalString(
                    withTemplateDefault("channel", templateDefaults?.channel),
                  ),
                  to: normalizeOptionalString(opts.to),
                  accountId,
                  bestEffort: opts.bestEffortDeliver ? true : undefined,
                }
              : undefined,
          };

          const res = await callGatewayFromCli("cron.add", opts, params);
          printCronJson(res);
          await warnIfCronSchedulerDisabled(opts);
        } catch (err) {
          handleCronCliError(err);
        }
      }),
  );
}
