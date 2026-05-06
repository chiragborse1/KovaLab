import type { Command } from "commander";
import { settingsCommand } from "../../commands/settings.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";

export function registerSettingsCommand(program: Command) {
  program
    .command("settings")
    .description("Open the Kova settings dashboard")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/settings", "docs.neuralstudio.in/cli/settings")}\n`,
    )
    .action(async () => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await settingsCommand(defaultRuntime);
      });
    });
}
