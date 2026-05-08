import type { Command } from "commander";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { hideCommandFromHelp } from "../program/command-descriptor-utils.js";
import { addGatewayServiceCommands } from "./register-service-commands.js";

export function registerDaemonCli(program: Command) {
  const daemon = program
    .command("daemon")
    .description("Manage the Gateway service (launchd/systemd/schtasks)")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/gateway", "docs.neuralstudio.in/cli/gateway")}\n`,
    );
  hideCommandFromHelp(daemon);

  addGatewayServiceCommands(daemon, {
    statusDescription: "Show service install status + probe connectivity/capability",
  });
}
