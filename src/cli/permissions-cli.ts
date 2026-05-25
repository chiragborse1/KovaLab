import type { Command } from "commander";
import { readConfigFileSnapshot } from "../config/config.js";
import { readExecApprovalsSnapshot } from "../infra/exec-approvals.js";
import { formatPermissionSummary } from "../permissions/summary.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";

type PermissionsCommandOptions = {
  json?: boolean;
};

async function runPermissionsCommand(opts: PermissionsCommandOptions): Promise<void> {
  const [configSnapshot, approvalsSnapshot] = await Promise.all([
    readConfigFileSnapshot(),
    Promise.resolve(readExecApprovalsSnapshot()),
  ]);
  const cfg = configSnapshot.config;
  const payload = {
    configPath: configSnapshot.path,
    approvalsPath: approvalsSnapshot.path,
    approvalsExists: approvalsSnapshot.exists,
    tools: {
      profile: cfg.tools?.profile ?? "full",
      allow: cfg.tools?.allow ?? [],
      alsoAllow: cfg.tools?.alsoAllow ?? [],
      deny: cfg.tools?.deny ?? [],
      workspaceOnly: cfg.tools?.fs?.workspaceOnly === true,
      elevatedEnabled: cfg.tools?.elevated?.enabled ?? null,
      exec: cfg.tools?.exec ?? {},
    },
    sandbox: cfg.agents?.defaults?.sandbox ?? {},
    plugins: {
      enabled: cfg.plugins?.enabled !== false,
      allow: cfg.plugins?.allow ?? [],
      deny: cfg.plugins?.deny ?? [],
      entries: Object.entries(cfg.plugins?.entries ?? {}).map(([id, entry]) => ({
        id,
        enabled: entry.enabled !== false,
      })),
    },
  };
  if (opts.json) {
    defaultRuntime.writeJson(payload, 0);
    return;
  }
  defaultRuntime.log(
    formatPermissionSummary({
      cfg: configSnapshot.config,
      configPath: configSnapshot.path,
      approvals: {
        path: approvalsSnapshot.path,
        exists: approvalsSnapshot.exists,
        file: approvalsSnapshot.file,
      },
    }),
  );
}

export function registerPermissionsCli(program: Command) {
  program
    .command("permissions")
    .description("Show terminal tool, exec, sandbox, and plugin permissions")
    .option("--json", "Output as JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/tools/slash-commands", "docs.neuralstudio.in/tools/slash-commands")}\n`,
    )
    .action(async (opts: PermissionsCommandOptions) => {
      try {
        await runPermissionsCommand(opts);
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
