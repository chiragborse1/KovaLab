import type { Command } from "commander";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { hideCommandFromHelp } from "./program/command-descriptor-utils.js";
import { registerQrCli } from "./qr-cli.js";

export function registerKovaCli(program: Command) {
  const kova = program
    .command("kova")
    .description("Legacy kova command aliases")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/kova", "docs.neuralstudio.in/cli/kova")}\n`,
    );
  hideCommandFromHelp(kova);
  registerQrCli(kova);
}
