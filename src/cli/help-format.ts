import { theme } from "../terminal/theme.js";
import { replaceCliName } from "./cli-name.js";

export type HelpExample = readonly [command: string, description: string];

export function formatHelpExample(command: string, description: string): string {
  return `  ${theme.command(replaceCliName(command))}\n    ${theme.muted(description)}`;
}

export function formatHelpExampleLine(command: string, description: string): string {
  const cliCommand = replaceCliName(command);
  if (!description) {
    return `  ${theme.command(cliCommand)}`;
  }
  return `  ${theme.command(cliCommand)} ${theme.muted(`# ${description}`)}`;
}

export function formatHelpExamples(examples: ReadonlyArray<HelpExample>, inline = false): string {
  const formatter = inline ? formatHelpExampleLine : formatHelpExample;
  return examples.map(([command, description]) => formatter(command, description)).join("\n");
}
