import { formatCliCommand } from "../cli/command-format.js";

export const SECURITY_NOTE_TITLE = "Before launch";

export const SECURITY_CONFIRM_MESSAGE =
  "I understand Kova can act through enabled tools and connected accounts. Continue?";

export const SECURITY_NOTE_MESSAGE = [
  "Kova can use local tools, files, and connected accounts when you enable them.",
  "Keep the first setup private: one owner, local access, approvals on.",
  "Add public, shared, or always-on access only after chat works.",
  "",
  `Review later: ${formatCliCommand("kova security audit --deep")}`,
].join("\n");
