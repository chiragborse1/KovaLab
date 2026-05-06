import chalk from "chalk";
import { formatCliCommand } from "../cli/command-format.js";

export const SECURITY_NOTE_TITLE = "Kova operating covenant";

export const SECURITY_CONFIRM_MESSAGE =
  "I understand Kova is a powerful local agent and I am responsible for who can reach it. Continue?";

const heading = (text: string) => chalk.bold(text);

export const SECURITY_NOTE_MESSAGE = [
  "Kova is a beta local-first agent runtime. Treat it like a trusted operator account, not a toy chatbot.",
  "When tools are enabled, Kova may read files, call services, send messages, and run actions you authorize.",
  "Model output is not a security boundary. Malicious prompts, files, websites, or chat messages can try to redirect the agent.",
  "",
  "Default posture: personal use, one owner, one trust boundary.",
  "Shared inboxes or group chats need explicit allowlists, isolated sessions, and reduced tool authority.",
  "",
  "Do not expose Kova to the internet or shared channels until you understand the access model.",
  "If this machine holds sensitive files or credentials, keep sandboxing and least-privilege settings tight.",
  "",
  heading("Kova baseline"),
  "- Owner-only pairing for channels and devices.",
  "- Mention gating for groups.",
  "- Per-sender DM sessions for shared channels.",
  "- Sandbox or approval prompts for local command execution.",
  "- SecretRefs or environment-managed secrets instead of plaintext files where practical.",
  "- Strong current-generation models for tool-enabled or untrusted inputs.",
  "",
  heading("Maintenance loop"),
  formatCliCommand("kova security audit --deep"),
  formatCliCommand("kova security audit --fix"),
  "",
  heading("Reference"),
  "- https://docs.neuralstudio.in/gateway/security",
].join("\n");
