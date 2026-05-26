import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { formatToolDetail, resolveToolDisplay } from "../../agents/tool-display.js";
import { markdownTheme, theme } from "../theme/theme.js";
import { sanitizeRenderableText } from "../tui-formatters.js";

type ToolResultContent = {
  type?: string;
  text?: string;
  mimeType?: string;
  bytes?: number;
  omitted?: boolean;
};

type ToolResult = {
  content?: ToolResultContent[];
  details?: Record<string, unknown>;
};

const PREVIEW_LINES = 12;
const DETAIL_WIDTH = 42;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(record: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!record) {
    return "";
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function oneline(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(" ");
}

function truncate(value: string, maxLen = DETAIL_WIDTH): string {
  const text = oneline(value);
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
}

function truncatePath(value: string, maxLen = 36): string {
  const text = oneline(value);
  if (text.length <= maxLen) {
    return text;
  }
  return `...${text.slice(-(maxLen - 3))}`;
}

function domainFromUrl(value: string): string {
  const text = value.trim();
  if (!text) {
    return "";
  }
  try {
    return new URL(text).host || text;
  } catch {
    return text.replace(/^https?:\/\//i, "").split("/")[0] ?? text;
  }
}

function firstArrayString(value: unknown): { value: string; extra: number } {
  if (!Array.isArray(value)) {
    return { value: typeof value === "string" ? value : "", extra: 0 };
  }
  const first = value[0];
  if (typeof first === "string") {
    return { value: first, extra: Math.max(0, value.length - 1) };
  }
  const firstRecord = asRecord(first);
  return {
    value: readString(firstRecord, "path", "url", "name"),
    extra: Math.max(0, value.length - 1),
  };
}

function formatLabel(label: string): string {
  return label.padEnd(9, " ");
}

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return "";
  }
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

function compactToolLine(params: {
  toolName: string;
  args: unknown;
  elapsedMs?: number;
  status: string;
  isError: boolean;
}): string {
  const record = asRecord(params.args);
  const name = params.toolName.trim();
  const key = name.toLowerCase();
  const display = resolveToolDisplay({ name, args: params.args });
  const duration = formatDuration(params.elapsedMs);
  const statusSuffix = params.status.startsWith("approval")
    ? " [approval]"
    : params.isError
      ? " [error]"
      : "";

  const finish = (emoji: string, label: string, detail: string) => {
    const detailText = truncate(detail || formatToolDetail(display) || display.detail || name);
    const durationText = duration ? `  ${duration}` : "";
    return `● ${emoji} ${formatLabel(label)} ${detailText}${durationText}${statusSuffix}`.trimEnd();
  };

  if (key === "web_search" || key === "x_search") {
    return finish("🔍", "search", readString(record, "query", "q"));
  }
  if (key === "web_fetch" || key === "web_extract") {
    const urls = firstArrayString(record?.urls);
    const url = urls.value || readString(record, "url");
    const extra = urls.extra > 0 ? ` +${urls.extra}` : "";
    return finish("📄", "fetch", `${domainFromUrl(url)}${extra}`);
  }
  if (key === "exec" || key === "bash" || key === "terminal") {
    return finish("💻", "$", readString(record, "command", "cmd"));
  }
  if (key === "process") {
    const action = readString(record, "action") || "?";
    const sessionId = readString(record, "sessionId", "session_id");
    return finish("⚙️", "proc", sessionId ? `${action} ${sessionId.slice(0, 12)}` : action);
  }
  if (key === "read" || key === "read_file") {
    return finish("📖", "read", truncatePath(readString(record, "path", "file_path", "filePath")));
  }
  if (key === "read_many") {
    const files = firstArrayString(record?.files);
    const extra = files.extra > 0 ? ` +${files.extra}` : "";
    return finish("📖", "read", `${truncatePath(files.value)}${extra}`);
  }
  if (key === "write" || key === "write_file") {
    return finish("✍️", "write", truncatePath(readString(record, "path", "file_path", "filePath")));
  }
  if (key === "edit") {
    return finish("📝", "edit", truncatePath(readString(record, "path", "file_path", "filePath")));
  }
  if (key === "apply_patch" || key === "patch") {
    return finish("🔧", "patch", readString(record, "path") || "workspace");
  }
  if (key === "browser" || key.startsWith("browser_")) {
    const action = readString(record, "action") || key.replace(/^browser_/, "") || "browser";
    const detail =
      domainFromUrl(readString(record, "url", "targetUrl")) ||
      readString(record, "ref", "targetId", "element", "selector") ||
      action;
    return finish("🌐", action, detail);
  }
  if (key === "memory_search") {
    return finish("🧠", "memory", readString(record, "query"));
  }
  if (key === "memory_get") {
    return finish("📓", "read", truncatePath(readString(record, "path")));
  }
  if (key === "sessions_spawn" || key === "subagents") {
    return finish("🔀", "delegate", readString(record, "task", "goal", "target", "action"));
  }
  if (key.startsWith("sessions_")) {
    return finish("🧵", "session", readString(record, "sessionKey", "label", "message") || key);
  }
  if (key === "update_plan") {
    const plan = Array.isArray(record?.plan) ? asRecord(record.plan[0]) : undefined;
    return finish("🗺️", "plan", readString(plan, "step") || readString(record, "explanation"));
  }

  const label = (display.verb ?? display.label ?? display.title ?? name).toLowerCase();
  return finish(display.emoji, label, formatToolDetail(display) ?? display.detail ?? name);
}

function extractText(result?: ToolResult): string {
  if (!result?.content) {
    return "";
  }
  const lines: string[] = [];
  for (const entry of result.content) {
    if (entry.type === "text" && entry.text) {
      lines.push(sanitizeRenderableText(entry.text));
    } else if (entry.type === "image") {
      const mime = entry.mimeType ?? "image";
      const size = entry.bytes ? ` ${Math.round(entry.bytes / 1024)}kb` : "";
      const omitted = entry.omitted ? " (omitted)" : "";
      lines.push(`[${mime}${size}${omitted}]`);
    }
  }
  return lines.join("\n").trim();
}

function readDetailString(result: ToolResult | undefined, key: string): string | undefined {
  const value = result?.details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export class ToolExecutionComponent extends Container {
  private line: Text;
  private output: Markdown;
  private toolName: string;
  private args: unknown;
  private result?: ToolResult;
  private readonly startedAt = Date.now();
  private completedAt?: number;
  private expanded = false;
  private isError = false;
  private isPartial = true;
  private outputHidden = false;

  constructor(toolName: string, args: unknown) {
    super();
    this.toolName = toolName;
    this.args = args;
    this.line = new Text("", 0, 0);
    this.output = new Markdown("", 0, 0, markdownTheme, {
      color: (line) => theme.toolOutput(line),
    });
    this.addChild(new Spacer(1));
    this.addChild(this.line);
    this.addChild(this.output);
    this.refresh();
  }

  setArgs(args: unknown) {
    this.args = args;
    this.refresh();
  }

  setExpanded(expanded: boolean) {
    this.expanded = expanded;
    this.refresh();
  }

  setResult(result: ToolResult | undefined, opts?: { isError?: boolean; outputHidden?: boolean }) {
    this.result = result;
    this.isPartial = false;
    this.completedAt = Date.now();
    this.isError = Boolean(opts?.isError);
    this.outputHidden = Boolean(opts?.outputHidden);
    this.refresh();
  }

  setPartialResult(result: ToolResult | undefined) {
    this.result = result;
    this.isPartial = true;
    this.completedAt = undefined;
    this.outputHidden = false;
    this.refresh();
  }

  private statusText(): string {
    if (this.isPartial) {
      return "running";
    }
    const approvalStatus = readDetailString(this.result, "status");
    if (approvalStatus === "approval-pending") {
      return "approval needed";
    }
    if (approvalStatus === "approval-unavailable") {
      return "approval unavailable";
    }
    return this.isError ? "failed" : "done";
  }

  private refresh() {
    const status = this.statusText();
    const line = compactToolLine({
      toolName: this.toolName,
      args: this.args,
      elapsedMs: this.completedAt !== undefined ? this.completedAt - this.startedAt : undefined,
      status,
      isError: this.isError,
    });
    this.line.setText(this.isError ? theme.error(line) : theme.toolOutput(line));

    const raw = this.outputHidden ? "" : extractText(this.result);
    const text = this.expanded
      ? raw || (this.isPartial ? "..." : status.startsWith("approval") ? "see approval card" : "")
      : "";
    if (this.expanded && text) {
      const lines = text.split("\n");
      const preview =
        lines.length > PREVIEW_LINES ? `${lines.slice(0, PREVIEW_LINES).join("\n")}\n…` : text;
      this.output.setText(
        preview
          .split("\n")
          .map((line, index) => `${index === 0 ? "  └ " : "    "}${line}`)
          .join("\n"),
      );
    } else {
      this.output.setText("");
    }
  }
}
