import type { Component } from "@mariozechner/pi-tui";
import { Container, Spacer, Text } from "@mariozechner/pi-tui";
import { theme } from "../theme/theme.js";
import type { ApprovalDecision, ApprovalEventSummary } from "./approval-event.js";
import { ApprovalEventComponent, resolveApprovalDecisions } from "./approval-event.js";
import { AssistantMessageComponent } from "./assistant-message.js";
import { BtwInlineMessage } from "./btw-inline-message.js";
import { ToolExecutionComponent } from "./tool-execution.js";
import { UserMessageComponent } from "./user-message.js";

const PENDING_HISTORY_CLOCK_SKEW_TOLERANCE_MS = 60_000;

type RepeatableSystemMessage = {
  component: Container;
  textNode: Text;
  baseText: string;
  count: number;
};

export type PendingApproval = {
  key: string;
  commandId: string;
  title: string;
  status: "pending";
  approvalId?: string;
  approvalSlug?: string;
  allowedDecisions: ApprovalDecision[];
  command?: string;
  host?: string;
  message?: string;
};

function approvalCommandId(summary: ApprovalEventSummary): string {
  return (summary.approvalSlug ?? summary.approvalId ?? "").trim();
}

export class ChatLog extends Container {
  private readonly maxComponents: number;
  private toolById = new Map<string, ToolExecutionComponent>();
  private approvalById = new Map<string, ApprovalEventComponent>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private streamingRuns = new Map<string, AssistantMessageComponent>();
  private assistantTextByRun = new Map<string, string>();
  private pendingSystemNotices = new Map<string, Container>();
  private pendingUsers = new Map<
    string,
    {
      component: UserMessageComponent;
      text: string;
      createdAt: number;
    }
  >();
  private btwMessage: BtwInlineMessage | null = null;
  private toolsExpanded = false;
  private repeatableSystemMessage: RepeatableSystemMessage | null = null;

  constructor(maxComponents = 180) {
    super();
    this.maxComponents = Math.max(20, Math.floor(maxComponents));
  }

  private dropComponentReferences(component: Component) {
    for (const [toolId, tool] of this.toolById.entries()) {
      if (tool === component) {
        this.toolById.delete(toolId);
      }
    }
    for (const [approvalId, approval] of this.approvalById.entries()) {
      if (approval === component) {
        this.approvalById.delete(approvalId);
      }
    }
    for (const [runId, message] of this.streamingRuns.entries()) {
      if (message === component) {
        this.streamingRuns.delete(runId);
        this.assistantTextByRun.delete(runId);
      }
    }
    for (const [runId, entry] of this.pendingUsers.entries()) {
      if (entry.component === component) {
        this.pendingUsers.delete(runId);
      }
    }
    for (const [runId, entry] of this.pendingSystemNotices.entries()) {
      if (entry === component) {
        this.pendingSystemNotices.delete(runId);
      }
    }
    if (this.btwMessage === component) {
      this.btwMessage = null;
    }
    if (this.repeatableSystemMessage?.component === component) {
      this.repeatableSystemMessage = null;
    }
  }

  private pruneOverflow() {
    while (this.children.length > this.maxComponents) {
      const oldest = this.children[0];
      if (!oldest) {
        return;
      }
      this.removeChild(oldest);
      this.dropComponentReferences(oldest);
    }
  }

  private append(component: Component) {
    this.addChild(component);
    this.pruneOverflow();
  }

  private appendNonSystem(component: Component) {
    this.repeatableSystemMessage = null;
    this.append(component);
  }

  clearAll(opts?: { preservePendingUsers?: boolean }) {
    this.clear();
    this.toolById.clear();
    this.approvalById.clear();
    this.pendingApprovals.clear();
    this.streamingRuns.clear();
    this.assistantTextByRun.clear();
    this.pendingSystemNotices.clear();
    this.btwMessage = null;
    this.repeatableSystemMessage = null;
    if (!opts?.preservePendingUsers) {
      this.pendingUsers.clear();
    }
  }

  restorePendingUsers() {
    for (const entry of this.pendingUsers.values()) {
      if (this.children.includes(entry.component)) {
        continue;
      }
      this.appendNonSystem(entry.component);
    }
  }

  clearPendingUsers() {
    for (const entry of this.pendingUsers.values()) {
      this.removeChild(entry.component);
    }
    this.pendingUsers.clear();
  }

  private formatRepeatedSystemText(text: string, count: number) {
    return count > 1 ? `${text} x${count}` : text;
  }

  private createSystemMessage(text: string): RepeatableSystemMessage {
    const entry = new Container();
    const textNode = new Text(theme.system(text), 1, 0);
    entry.addChild(new Spacer(1));
    entry.addChild(textNode);
    return {
      component: entry,
      textNode,
      baseText: text,
      count: 1,
    };
  }

  addSystem(text: string, opts?: { coalesceConsecutive?: boolean }) {
    if (
      opts?.coalesceConsecutive &&
      this.repeatableSystemMessage?.baseText === text &&
      this.children[this.children.length - 1] === this.repeatableSystemMessage.component
    ) {
      this.repeatableSystemMessage.count += 1;
      this.repeatableSystemMessage.textNode.setText(
        theme.system(this.formatRepeatedSystemText(text, this.repeatableSystemMessage.count)),
      );
      return;
    }
    const message = this.createSystemMessage(text);
    this.append(message.component);
    this.repeatableSystemMessage = opts?.coalesceConsecutive ? message : null;
  }

  addPendingSystem(runId: string, text: string) {
    const existing = this.pendingSystemNotices.get(runId);
    if (existing) {
      this.removeChild(existing);
    }
    const message = this.createSystemMessage(text);
    this.pendingSystemNotices.set(runId, message.component);
    this.append(message.component);
  }

  dismissPendingSystem(runId: string) {
    const existing = this.pendingSystemNotices.get(runId);
    if (!existing) {
      return false;
    }
    this.removeChild(existing);
    this.pendingSystemNotices.delete(runId);
    return true;
  }

  addUser(text: string) {
    this.appendNonSystem(new UserMessageComponent(text));
  }

  addPendingUser(runId: string, text: string, createdAt = Date.now()) {
    const existing = this.pendingUsers.get(runId);
    if (existing) {
      existing.text = text;
      existing.createdAt = createdAt;
      existing.component.setText(text);
      return existing.component;
    }
    const component = new UserMessageComponent(text);
    this.pendingUsers.set(runId, { component, text, createdAt });
    this.appendNonSystem(component);
    return component;
  }

  commitPendingUser(runId: string) {
    return this.pendingUsers.delete(runId);
  }

  dropPendingUser(runId: string) {
    const existing = this.pendingUsers.get(runId);
    if (!existing) {
      return false;
    }
    this.removeChild(existing.component);
    this.pendingUsers.delete(runId);
    return true;
  }

  hasPendingUser(runId: string) {
    return this.pendingUsers.has(runId);
  }

  reconcilePendingUsers(
    historyUsers: Array<{
      text: string;
      timestamp?: number | null;
    }>,
  ) {
    const normalizedHistory = historyUsers
      .map((entry) => ({
        text: entry.text.trim(),
        timestamp: typeof entry.timestamp === "number" ? entry.timestamp : null,
      }))
      .filter((entry) => entry.text.length > 0 && entry.timestamp !== null);
    const clearedRunIds: string[] = [];
    for (const [runId, entry] of this.pendingUsers.entries()) {
      const pendingText = entry.text.trim();
      if (!pendingText) {
        continue;
      }
      const matchIndex = normalizedHistory.findIndex(
        (historyEntry) =>
          historyEntry.text === pendingText &&
          (historyEntry.timestamp ?? 0) >=
            entry.createdAt - PENDING_HISTORY_CLOCK_SKEW_TOLERANCE_MS,
      );
      if (matchIndex === -1) {
        continue;
      }
      if (this.children.includes(entry.component)) {
        this.removeChild(entry.component);
      }
      this.pendingUsers.delete(runId);
      clearedRunIds.push(runId);
      normalizedHistory.splice(matchIndex, 1);
    }
    return clearedRunIds;
  }

  countPendingUsers() {
    return this.pendingUsers.size;
  }

  private resolveRunId(runId?: string) {
    return runId ?? "default";
  }

  startAssistant(text: string, runId?: string) {
    const effectiveRunId = this.resolveRunId(runId);
    const existing = this.streamingRuns.get(effectiveRunId);
    if (existing) {
      if (this.assistantTextByRun.get(effectiveRunId) !== text) {
        existing.setText(text);
        this.assistantTextByRun.set(effectiveRunId, text);
      }
      return existing;
    }
    const component = new AssistantMessageComponent(text);
    this.streamingRuns.set(effectiveRunId, component);
    this.assistantTextByRun.set(effectiveRunId, text);
    this.appendNonSystem(component);
    return component;
  }

  updateAssistant(text: string, runId?: string) {
    const effectiveRunId = this.resolveRunId(runId);
    const existing = this.streamingRuns.get(effectiveRunId);
    if (!existing) {
      this.startAssistant(text, runId);
      return;
    }
    if (this.assistantTextByRun.get(effectiveRunId) === text) {
      return;
    }
    existing.setText(text);
    this.assistantTextByRun.set(effectiveRunId, text);
  }

  finalizeAssistant(text: string, runId?: string) {
    const effectiveRunId = this.resolveRunId(runId);
    const existing = this.streamingRuns.get(effectiveRunId);
    if (existing) {
      if (this.assistantTextByRun.get(effectiveRunId) !== text) {
        existing.setText(text);
      }
      this.streamingRuns.delete(effectiveRunId);
      this.assistantTextByRun.delete(effectiveRunId);
      return;
    }
    this.appendNonSystem(new AssistantMessageComponent(text));
  }

  dropAssistant(runId?: string) {
    const effectiveRunId = this.resolveRunId(runId);
    const existing = this.streamingRuns.get(effectiveRunId);
    if (!existing) {
      return;
    }
    this.removeChild(existing);
    this.streamingRuns.delete(effectiveRunId);
    this.assistantTextByRun.delete(effectiveRunId);
  }

  showBtw(params: { question: string; text: string; isError?: boolean }) {
    if (this.btwMessage) {
      this.btwMessage.setResult(params);
      if (this.children[this.children.length - 1] !== this.btwMessage) {
        this.removeChild(this.btwMessage);
        this.appendNonSystem(this.btwMessage);
      }
      return this.btwMessage;
    }
    const component = new BtwInlineMessage(params);
    this.btwMessage = component;
    this.appendNonSystem(component);
    return component;
  }

  dismissBtw() {
    if (!this.btwMessage) {
      return;
    }
    this.removeChild(this.btwMessage);
    this.btwMessage = null;
  }

  hasVisibleBtw() {
    return this.btwMessage !== null;
  }

  startTool(toolCallId: string, toolName: string, args: unknown) {
    const existing = this.toolById.get(toolCallId);
    if (existing) {
      existing.setArgs(args);
      return existing;
    }
    const component = new ToolExecutionComponent(toolName, args);
    component.setExpanded(this.toolsExpanded);
    this.toolById.set(toolCallId, component);
    this.appendNonSystem(component);
    return component;
  }

  updateToolArgs(toolCallId: string, args: unknown) {
    const existing = this.toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    existing.setArgs(args);
  }

  updateToolResult(
    toolCallId: string,
    result: unknown,
    opts?: { isError?: boolean; partial?: boolean; outputHidden?: boolean },
  ) {
    const existing = this.toolById.get(toolCallId);
    if (!existing) {
      return;
    }
    if (opts?.partial) {
      existing.setPartialResult(result as Record<string, unknown>);
      return;
    }
    existing.setResult(result as Record<string, unknown>, {
      isError: opts?.isError,
      outputHidden: opts?.outputHidden,
    });
  }

  setToolsExpanded(expanded: boolean) {
    this.toolsExpanded = expanded;
    for (const tool of this.toolById.values()) {
      tool.setExpanded(expanded);
    }
  }

  showApproval(key: string, summary: ApprovalEventSummary) {
    const approvalKey = key.trim() || summary.approvalId || summary.approvalSlug || "approval";
    const existing = this.approvalById.get(approvalKey);
    if (existing) {
      existing.setSummary(summary);
    } else {
      const component = new ApprovalEventComponent(summary);
      this.approvalById.set(approvalKey, component);
      this.appendNonSystem(component);
    }
    const commandId = approvalCommandId(summary);
    if (summary.status === "pending" && commandId) {
      this.pendingApprovals.set(commandId, {
        key: approvalKey,
        commandId,
        title: summary.title?.trim() || "Approval",
        status: "pending",
        allowedDecisions: resolveApprovalDecisions(summary),
        ...(summary.approvalId ? { approvalId: summary.approvalId } : {}),
        ...(summary.approvalSlug ? { approvalSlug: summary.approvalSlug } : {}),
        ...(summary.command ? { command: summary.command } : {}),
        ...(summary.host ? { host: summary.host } : {}),
        ...(summary.message ? { message: summary.message } : {}),
      });
    } else {
      this.pendingApprovals.delete(approvalKey);
      if (summary.approvalId) {
        this.pendingApprovals.delete(summary.approvalId);
      }
      if (summary.approvalSlug) {
        this.pendingApprovals.delete(summary.approvalSlug);
      }
      for (const [pendingKey, pending] of this.pendingApprovals.entries()) {
        if (
          pending.key === approvalKey ||
          (summary.approvalId && pending.approvalId === summary.approvalId) ||
          (summary.approvalSlug && pending.approvalSlug === summary.approvalSlug)
        ) {
          this.pendingApprovals.delete(pendingKey);
        }
      }
    }
    return existing ?? this.approvalById.get(approvalKey);
  }

  listPendingApprovals(): PendingApproval[] {
    return Array.from(this.pendingApprovals.values());
  }

  findPendingApproval(value: string): PendingApproval | null {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    return (
      this.pendingApprovals.get(normalized) ??
      this.listPendingApprovals().find(
        (approval) =>
          approval.approvalId === normalized ||
          approval.approvalSlug === normalized ||
          approval.key === normalized,
      ) ??
      null
    );
  }
}
