import type { Command } from "commander";
import {
  personaEditCommand,
  personaInitCommand,
  personaPathCommand,
  personaShowCommand,
  personaStatusCommand,
} from "../../commands/persona.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";

function addPersonaTargetOptions(command: Command): Command {
  return command
    .option("--agent <id>", "Agent id (defaults to the current default agent)")
    .option("--workspace <dir>", "Workspace directory override")
    .option("--json", "Output JSON instead of text", false);
}

export function registerPersonaCommand(program: Command) {
  const persona = program
    .command("persona")
    .description("Inspect and edit the current agent persona (SOUL.md)")
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("Examples:")}
${formatHelpExamples([
  ["kova persona", "Show persona status."],
  ["kova persona show", "Print SOUL.md."],
  ["kova persona edit", "Open SOUL.md in EDITOR/VISUAL."],
  ["kova persona init --agent main", "Create SOUL.md if it is missing."],
])}

${theme.muted("Docs:")} ${formatDocsLink("/cli/persona", "docs.neuralstudio.in/cli/persona")}`,
    );

  addPersonaTargetOptions(persona.command("status").description("Show persona file status")).action(
    async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await personaStatusCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    },
  );

  addPersonaTargetOptions(persona.command("path").description("Print the SOUL.md path")).action(
    async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await personaPathCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    },
  );

  addPersonaTargetOptions(persona.command("show").description("Print persona instructions"))
    .option("--lines <n>", "Show the first N lines", (value: string) => Number(value))
    .option("--all", "Show the full file", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await personaShowCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            json: Boolean(opts.json),
            lines: typeof opts.lines === "number" ? opts.lines : undefined,
            all: Boolean(opts.all),
          },
          defaultRuntime,
        );
      });
    });

  addPersonaTargetOptions(
    persona.command("init").description("Create SOUL.md from the default template"),
  )
    .option("--force", "Reset SOUL.md from the default template after writing a backup", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await personaInitCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            json: Boolean(opts.json),
            force: Boolean(opts.force),
          },
          defaultRuntime,
        );
      });
    });

  addPersonaTargetOptions(persona.command("edit").description("Open SOUL.md in EDITOR/VISUAL"))
    .option("--editor <cmd>", "Editor command override")
    .option("--print-path", "Print the path instead of opening an editor", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await personaEditCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            json: Boolean(opts.json),
            editor: opts.editor as string | undefined,
            printPath: Boolean(opts.printPath),
          },
          defaultRuntime,
        );
      });
    });

  persona.action(async () => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      await personaStatusCommand({}, defaultRuntime);
    });
  });
}
