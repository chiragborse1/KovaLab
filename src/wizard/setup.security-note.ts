import chalk from "chalk";
import { formatCliCommand } from "../cli/command-format.js";

export const SECURITY_NOTE_TITLE = "Security notice";

export const SECURITY_CONFIRM_MESSAGE =
  "I understand Kova can use tools and access connected accounts. Continue?";

const heading = (text: string) => chalk.bold(text);

export const SECURITY_NOTE_MESSAGE = [
  "Kova is a beta local-first agent. Treat it like an app that can act on your behalf.",
  "When tools are enabled, Kova may read files, call services, send messages, and run actions you approve.",
  "Messages, files, and websites can include malicious instructions. Keep tool access limited.",
  "",
  "Recommended default: personal use, one owner, private access.",
  "For group chats or shared inboxes, use allowlists, separate sessions, and fewer tools.",
  "",
  "Do not expose Kova to the public internet until you understand the security settings.",
  "If this machine has sensitive files or credentials, keep sandboxing and approvals enabled.",
  "",
  heading("Recommended settings"),
  "- Owner-only pairing for chat channels and devices.",
  "- Require mentions in group chats.",
  "- Keep separate sessions for each sender.",
  "- Use sandboxing or approval prompts for local commands.",
  "- Prefer environment-backed secrets instead of plaintext when possible.",
  "- Use a strong current model when tools are enabled.",
  "",
  heading("Security checks"),
  formatCliCommand("kova security audit --deep"),
  formatCliCommand("kova security audit --fix"),
  "",
  heading("Reference"),
  "- https://docs.neuralstudio.in/gateway/security",
].join("\n");
