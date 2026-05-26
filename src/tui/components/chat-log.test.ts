import { describe, expect, it } from "vitest";
import { normalizeTestText } from "../../../test/helpers/normalize-text.js";
import { ChatLog } from "./chat-log.js";

describe("ChatLog", () => {
  it("caps component growth to avoid unbounded render trees", () => {
    const chatLog = new ChatLog(20);
    for (let i = 1; i <= 40; i++) {
      chatLog.addSystem(`system-${i}`);
    }

    expect(chatLog.children.length).toBe(20);
    const rendered = chatLog.render(120).join("\n");
    expect(rendered).toContain("system-40");
    expect(rendered).not.toContain("system-1");
  });

  it("drops stale streaming references when old components are pruned", () => {
    const chatLog = new ChatLog(20);
    chatLog.startAssistant("first", "run-1");
    for (let i = 0; i < 25; i++) {
      chatLog.addSystem(`overflow-${i}`);
    }

    // Should not throw if the original streaming component was pruned.
    chatLog.updateAssistant("recreated", "run-1");

    const rendered = chatLog.render(120).join("\n");
    expect(chatLog.children.length).toBe(20);
    expect(rendered).toContain("recreated");
  });

  it("does not append duplicate assistant components when a run is started twice", () => {
    const chatLog = new ChatLog(40);
    chatLog.startAssistant("first", "run-dup");
    chatLog.startAssistant("second", "run-dup");

    const rendered = chatLog.render(120).join("\n");
    expect(rendered).toContain("second");
    expect(rendered).not.toContain("first");
    expect(chatLog.children.length).toBe(1);
  });

  it("renders user and assistant messages as compact transcript entries", () => {
    const chatLog = new ChatLog(40);
    chatLog.addUser("please check the build");
    chatLog.startAssistant("Build looks clean.", "run-ui");

    const rendered = normalizeTestText(chatLog.render(48).join("\n"));

    expect(rendered).toContain("❯ please check the build");
    expect(rendered).toContain("● Build looks clean.");
    expect(rendered).not.toContain("╭─ You");
    expect(rendered).not.toContain("╭─ Kova");
    expect(rendered).not.toContain("╰");
    expect(rendered).not.toContain("│");
  });

  it("drops stale tool references when old components are pruned", () => {
    const chatLog = new ChatLog(20);
    chatLog.startTool("tool-1", "read_file", { path: "a.txt" });
    for (let i = 0; i < 25; i++) {
      chatLog.addSystem(`overflow-${i}`);
    }

    // Should no-op safely after the tool component is pruned.
    chatLog.updateToolResult("tool-1", { content: [{ type: "text", text: "done" }] });

    expect(chatLog.children.length).toBe(20);
  });

  it("renders collapsed tools as a compact activity rail without hidden-output noise", () => {
    const chatLog = new ChatLog(40);

    chatLog.startTool("tool-1", "exec", { command: "pnpm test" });
    chatLog.updateToolResult(
      "tool-1",
      { content: [{ type: "text", text: "secret output" }] },
      { outputHidden: true },
    );

    const rendered = normalizeTestText(chatLog.render(120).join("\n"));
    expect(rendered).toContain("●");
    expect(rendered).toContain("$");
    expect(rendered).toContain("pnpm test");
    expect(rendered).not.toContain("output hidden");
    expect(rendered).not.toContain("secret output");
  });

  it("uses available terminal width for compact tool details", () => {
    const chatLog = new ChatLog(40);
    const query = "GitHub Actions outage May 26 2026 GitHub status incident";

    chatLog.startTool("tool-1", "web_search", { query });

    const wide = normalizeTestText(chatLog.render(120).join("\n"));
    expect(wide).toContain(query);

    const narrow = normalizeTestText(chatLog.render(52).join("\n"));
    expect(narrow).toContain("...");
  });

  it("shows tool output only when details are expanded", () => {
    const chatLog = new ChatLog(40);

    chatLog.startTool("tool-1", "read", { path: "src/index.ts" });
    chatLog.updateToolResult("tool-1", { content: [{ type: "text", text: "file output" }] });

    let rendered = normalizeTestText(chatLog.render(120).join("\n"));
    expect(rendered).toContain("●");
    expect(rendered).toContain("read");
    expect(rendered).toContain("src/index.ts");
    expect(rendered).not.toContain("file output");

    chatLog.setToolsExpanded(true);
    rendered = normalizeTestText(chatLog.render(120).join("\n"));
    expect(rendered).toContain("└ file output");
    expect(rendered).toContain("file output");
  });

  it("renders and updates approval cards by approval id", () => {
    const chatLog = new ChatLog(40);

    chatLog.showApproval("req-1", {
      status: "pending",
      title: "Command approval requested",
      approvalSlug: "req-1",
      allowedDecisions: ["allow-once", "deny"],
      command: "pnpm build",
      host: "gateway",
    });
    expect(chatLog.listPendingApprovals()).toEqual([
      expect.objectContaining({
        commandId: "req-1",
        allowedDecisions: ["allow-once", "deny"],
        command: "pnpm build",
      }),
    ]);
    chatLog.showApproval("req-1", {
      status: "approved",
      title: "Command approval resolved",
      approvalSlug: "req-1",
      host: "gateway",
    });

    const rendered = normalizeTestText(chatLog.render(120).join("\n"));
    expect(rendered).toContain("╭─ Approval");
    expect(rendered).toContain("Command approval resolved - approved");
    expect(rendered).not.toContain("pnpm build");
    expect(chatLog.children.length).toBe(1);
    expect(chatLog.listPendingApprovals()).toEqual([]);
  });

  it("prunes system messages atomically when a non-system entry overflows the log", () => {
    const chatLog = new ChatLog(20);
    for (let i = 1; i <= 20; i++) {
      chatLog.addSystem(`system-${i}`);
    }

    chatLog.addUser("hello");

    const rendered = normalizeTestText(chatLog.render(120).join("\n"));
    expect(rendered).not.toMatch(/\bsystem-1\b/);
    expect(rendered).toMatch(/\bsystem-2\b/);
    expect(rendered).toMatch(/\bsystem-20\b/);
    expect(rendered).toContain("hello");
    expect(chatLog.children.length).toBe(20);
  });

  it("renders BTW inline and removes it when dismissed", () => {
    const chatLog = new ChatLog(40);

    chatLog.addSystem("session agent:main:main");
    chatLog.showBtw({
      question: "what is 17 * 19?",
      text: "323",
    });

    let rendered = chatLog.render(120).join("\n");
    expect(rendered).toContain("BTW: what is 17 * 19?");
    expect(rendered).toContain("323");
    expect(chatLog.hasVisibleBtw()).toBe(true);

    chatLog.dismissBtw();

    rendered = chatLog.render(120).join("\n");
    expect(rendered).not.toContain("BTW: what is 17 * 19?");
    expect(chatLog.hasVisibleBtw()).toBe(false);
  });

  it("preserves pending user messages across history rebuilds", () => {
    const chatLog = new ChatLog(40);

    chatLog.addPendingUser("run-1", "queued hello");
    chatLog.clearAll({ preservePendingUsers: true });
    chatLog.addSystem("session agent:main:main");
    chatLog.restorePendingUsers();

    const rendered = chatLog.render(120).join("\n");
    expect(rendered).toContain("queued hello");
    expect(chatLog.countPendingUsers()).toBe(1);
  });

  it("does not append the same pending component twice when it is already mounted", () => {
    const chatLog = new ChatLog(40);

    chatLog.addPendingUser("run-1", "queued hello");
    chatLog.restorePendingUsers();

    expect(chatLog.children.length).toBe(1);
    expect(chatLog.render(120).join("\n")).toContain("queued hello");
  });

  it("stops counting a pending user message once the run is committed", () => {
    const chatLog = new ChatLog(40);

    chatLog.addPendingUser("run-1", "hello");
    expect(chatLog.countPendingUsers()).toBe(1);

    expect(chatLog.commitPendingUser("run-1")).toBe(true);
    expect(chatLog.countPendingUsers()).toBe(0);
    expect(chatLog.render(120).join("\n")).toContain("hello");
  });

  it("reconciles pending users against rebuilt history using timestamps", () => {
    const chatLog = new ChatLog(40);

    chatLog.addPendingUser("run-1", "queued hello", 2_000);

    expect(
      chatLog.reconcilePendingUsers([
        { text: "queued hello", timestamp: 2_100 },
        { text: "older", timestamp: 1_000 },
      ]),
    ).toEqual(["run-1"]);
    expect(chatLog.countPendingUsers()).toBe(0);
  });

  it("reconciles pending users when the gateway clock is slightly behind the client", () => {
    const chatLog = new ChatLog(40);

    chatLog.addPendingUser("run-1", "queued hello", 65_000);

    expect(chatLog.reconcilePendingUsers([{ text: "queued hello", timestamp: 20_000 }])).toEqual([
      "run-1",
    ]);
    expect(chatLog.countPendingUsers()).toBe(0);
  });

  it("does not hide a new repeated prompt when only older history matches", () => {
    const chatLog = new ChatLog(40);

    chatLog.addPendingUser("run-1", "continue", 5_000);

    expect(chatLog.reconcilePendingUsers([{ text: "continue", timestamp: -56_000 }])).toEqual([]);
    expect(chatLog.countPendingUsers()).toBe(1);
  });
});
