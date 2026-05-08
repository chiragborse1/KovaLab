import type { Command } from "commander";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { hideCommandFromHelp } from "./program/command-descriptor-utils.js";
import { registerQrCli } from "./qr-cli.js";

export function registerClawbotCli(program: Command) {
  const clawbot = program
    .command("clawbot")
    .description("Legacy clawbot command aliases")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/clawbot", "docs.neuralstudio.in/cli/clawbot")}\n`,
    );
  hideCommandFromHelp(clawbot);
  registerQrCli(clawbot);
}
