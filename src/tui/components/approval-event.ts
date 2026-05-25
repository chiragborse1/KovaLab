import { Container, Spacer } from "@mariozechner/pi-tui";
import { markdownTheme, theme } from "../theme/theme.js";
import { sanitizeRenderableText } from "../tui-formatters.js";
import { HyperlinkMarkdown } from "./hyperlink-markdown.js";
import { MessageFrame } from "./message-frame.js";

export type ApprovalEventSummary = {
  phase?: string;
  kind?: string;
  status: string;
  title?: string;
  approvalId?: string;
  approvalSlug?: string;
  command?: string;
  host?: string;
  reason?: string;
  message?: string;
};

function formatApprovalStatus(status: string): string {
  switch (status) {
    case "pending":
      return "approval needed";
    case "unavailable":
      return "approval unavailable";
    case "approved":
      return "approved";
    case "denied":
      return "denied";
    case "failed":
      return "approval failed";
    default:
      return status.trim() || "approval";
  }
}

function approvalCommandId(summary: ApprovalEventSummary): string {
  return (summary.approvalSlug ?? summary.approvalId ?? "").trim();
}

export function formatApprovalEvent(summary: ApprovalEventSummary): string {
  const lines: string[] = [];
  const status = formatApprovalStatus(summary.status);
  const title = summary.title?.trim() || "Approval";
  lines.push(`${title} - ${status}`);

  const message = summary.message?.trim();
  if (message) {
    lines.push(message);
  }

  if (summary.status === "pending") {
    const id = approvalCommandId(summary);
    if (id) {
      lines.push(`Allow once: /approve ${id} allow-once`);
      lines.push(`Deny: /approve ${id} deny`);
    }
  } else if (summary.status === "unavailable") {
    lines.push("No interactive approval route is available for this request.");
  }

  const host = summary.host?.trim();
  if (host) {
    lines.push(`Host: ${host}`);
  }
  const reason = summary.reason?.trim();
  if (reason) {
    lines.push(`Reason: ${reason}`);
  }
  const command = summary.command?.trim();
  if (command) {
    lines.push(`Command: ${command}`);
  }

  return sanitizeRenderableText(lines.join("\n"));
}

export class ApprovalEventComponent extends Container {
  private body: HyperlinkMarkdown;

  constructor(summary: ApprovalEventSummary) {
    super();
    this.body = new HyperlinkMarkdown(formatApprovalEvent(summary), 0, 0, markdownTheme, {
      color: (line) => theme.toolOutput(line),
    });
    this.addChild(new Spacer(1));
    this.addChild(
      new MessageFrame(this.body, {
        title: "Approval",
        theme: {
          border: theme.border,
          title: theme.toolTitle,
        },
      }),
    );
  }

  setSummary(summary: ApprovalEventSummary) {
    this.body.setText(formatApprovalEvent(summary));
  }
}
