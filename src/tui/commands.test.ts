import { describe, expect, it } from "vitest";
import { commandCatalogText, getSlashCommands, helpText, parseCommand } from "./commands.js";

describe("parseCommand", () => {
  it("normalizes aliases and keeps command args", () => {
    expect(parseCommand("/elev full")).toEqual({ name: "elevated", args: "full" });
  });

  it("normalizes gateway-status aliases", () => {
    expect(parseCommand("/gwstatus")).toEqual({ name: "gateway-status", args: "" });
  });

  it("normalizes limit aliases", () => {
    expect(parseCommand("/limit")).toEqual({ name: "limits", args: "" });
  });

  it("normalizes shared colon command syntax", () => {
    expect(parseCommand("/think: high")).toEqual({ name: "think", args: "high" });
    expect(parseCommand("/context: detail")).toEqual({ name: "context", args: "detail" });
  });

  it("normalizes hidden lifecycle aliases", () => {
    expect(parseCommand("/abort")).toEqual({ name: "stop", args: "" });
    expect(parseCommand("/quit")).toEqual({ name: "exit", args: "" });
  });

  it("keeps /commands as a first-class command catalog", () => {
    expect(parseCommand("/commands")).toEqual({ name: "commands", args: "" });
  });

  it("normalizes Hermes-compatible command aliases", () => {
    expect(parseCommand("/bg check logs")).toEqual({ name: "btw", args: "check logs" });
    expect(parseCommand("/background check logs")).toEqual({ name: "btw", args: "check logs" });
    expect(parseCommand("/side check logs")).toEqual({ name: "btw", args: "check logs" });
    expect(parseCommand("/q interrupt")).toEqual({ name: "queue", args: "interrupt" });
    expect(parseCommand("/provider openai/gpt-5.4")).toEqual({
      name: "model",
      args: "openai/gpt-5.4",
    });
    expect(parseCommand("/footer status")).toEqual({ name: "usage", args: "status" });
  });

  it("returns empty name for empty input", () => {
    expect(parseCommand("   ")).toEqual({ name: "", args: "" });
  });
});

describe("getSlashCommands", () => {
  it("provides level completions for built-in toggles", () => {
    const commands = getSlashCommands();
    const verbose = commands.find((command) => command.name === "verbose");
    const activation = commands.find((command) => command.name === "activation");
    expect(verbose?.getArgumentCompletions?.("o")).toEqual([
      { value: "on", label: "on" },
      { value: "off", label: "off" },
    ]);
    expect(verbose?.getArgumentCompletions?.("f")).toEqual([{ value: "full", label: "full" }]);
    const details = commands.find((command) => command.name === "details");
    expect(details?.getArgumentCompletions?.("e")).toEqual([
      { value: "expanded", label: "expanded" },
    ]);
    const fast = commands.find((command) => command.name === "fast");
    expect(fast?.getArgumentCompletions?.("d")).toEqual([{ value: "default", label: "default" }]);
    const think = commands.find((command) => command.name === "think");
    expect(think?.getArgumentCompletions?.("d")).toEqual([{ value: "default", label: "default" }]);
    expect(activation?.getArgumentCompletions?.("a")).toEqual([
      { value: "always", label: "always" },
    ]);
    const usage = commands.find((command) => command.name === "usage");
    expect(usage?.getArgumentCompletions?.("c")).toEqual([{ value: "cost", label: "cost" }]);
    const approve = commands.find((command) => command.name === "approve");
    expect(approve?.getArgumentCompletions?.("allow-")).toEqual([
      { value: "allow-once", label: "allow-once" },
      { value: "allow-always", label: "allow-always" },
    ]);
    const permissions = commands.find((command) => command.name === "permissions");
    expect(permissions?.getArgumentCompletions?.("preset b")).toEqual([
      {
        value: "preset balanced",
        label: "preset balanced",
        description: "Allow trusted commands, ask on misses",
      },
    ]);
  });

  it("keeps session status on the shared command path and exposes gateway status separately", () => {
    const commands = getSlashCommands();
    const status = commands.find((command) => command.name === "status");
    const gatewayStatus = commands.find((command) => command.name === "gateway-status");
    const limits = commands.find((command) => command.name === "limits");
    expect(status?.description).toBe("Show current status.");
    expect(gatewayStatus?.description).toBe("Show gateway status summary");
    expect(limits?.description).toBe("Explain context usage vs provider quotas");
  });

  it("adds practical argument completions for /memory", () => {
    const commands = getSlashCommands();
    const memory = commands.find((command) => command.name === "memory");
    expect(memory?.argumentHint).toBe(
      "status | sync [force] | search <query> | read <path[:line[-end]]> | dreams",
    );
    expect(memory?.getArgumentCompletions?.("s")).toEqual([
      {
        value: "status",
        label: "status",
        description: "Check memory backend and index health",
      },
      {
        value: "sync",
        label: "sync",
        description: "Refresh the active memory index",
      },
      {
        value: "sync force",
        label: "sync force",
        description: "Rebuild the active memory index",
      },
      {
        value: "search ",
        label: "search <query>",
        description: "Search recalled memory snippets",
      },
    ]);
    expect(memory?.getArgumentCompletions?.("sync f")).toEqual([
      {
        value: "sync force",
        label: "sync force",
        description: "Rebuild the active memory index",
      },
    ]);
    expect(memory?.getArgumentCompletions?.("d")).toEqual([
      {
        value: "dreams",
        label: "dreams",
        description: "Review the Dream Diary",
      },
    ]);
  });

  it("marks /sessions as query-filterable", () => {
    const commands = getSlashCommands();
    const sessions = commands.find((command) => command.name === "sessions");
    expect(sessions?.argumentHint).toBe("[query]");
  });

  it("adds compact and verbose completions for terminal catalog commands", () => {
    const commands = getSlashCommands();
    const tools = commands.find((command) => command.name === "tools");
    const skills = commands.find((command) => command.name === "skills");
    const context = commands.find((command) => command.name === "context");
    expect(tools?.getArgumentCompletions?.("v")).toEqual([{ value: "verbose", label: "verbose" }]);
    expect(skills?.getArgumentCompletions?.("c")).toEqual([{ value: "compact", label: "compact" }]);
    expect(context?.argumentHint).toBe("list | detail | json");
    expect(context?.getArgumentCompletions?.("d")).toEqual([{ value: "detail", label: "detail" }]);
  });

  it("adds terminal ops commands for tasks and recovery", () => {
    const commands = getSlashCommands();
    const tasks = commands.find((command) => command.name === "tasks");
    const recover = commands.find((command) => command.name === "recover");
    const rollback = commands.find((command) => command.name === "rollback");
    const subagents = commands.find((command) => command.name === "subagents");
    const automation = commands.find((command) => command.name === "automation");

    expect(tasks?.argumentHint).toContain("audit");
    expect(tasks?.getArgumentCompletions?.("rep")).toEqual([
      { value: "repair", label: "repair" },
      { value: "repair apply", label: "repair apply" },
    ]);
    expect(recover?.getArgumentCompletions?.("a")).toEqual([{ value: "apply", label: "apply" }]);
    expect(rollback?.argumentHint).toContain("restore <id> confirm");
    expect(rollback?.getArgumentCompletions?.("br")).toEqual([
      { value: "branch ", label: "branch " },
    ]);
    expect(subagents?.description).toBe("Show running subagents and recent summaries");
    expect(subagents?.argumentHint).toBe("list | running | queued | failed | lost | all");
    expect(subagents?.getArgumentCompletions?.("r")).toEqual([
      { value: "running", label: "running" },
    ]);
    expect(subagents?.getArgumentCompletions?.("rep")).toEqual([]);
    expect(automation?.description).toBe("Show scheduled/background automation");
    expect(automation?.argumentHint).toBe("list | running | queued | failed | audit");
    expect(automation?.getArgumentCompletions?.("rep")).toEqual([]);
    expect(automation?.getArgumentCompletions?.("f")).toEqual([
      { value: "failed", label: "failed" },
    ]);
  });

  it("keeps alias commands out of the visible command palette", () => {
    const commandNames = getSlashCommands().map((command) => command.name);
    expect(commandNames).toContain("elevated");
    expect(commandNames).toContain("gateway-status");
    expect(commandNames).toContain("stop");
    expect(commandNames).toContain("commands");
    expect(commandNames).not.toContain("elev");
    expect(commandNames).not.toContain("gwstatus");
    expect(commandNames).not.toContain("abort");
    expect(commandNames).not.toContain("limit");
    expect(commandNames).not.toContain("quit");
    expect(commandNames).not.toContain("id");
    expect(commandNames).not.toContain("plugin");
    expect(commandNames).not.toContain("tell");
    expect(commandNames).not.toContain("t");
    expect(commandNames).not.toContain("v");
  });

  it("uses the canonical gateway alias when merging multi-alias commands", () => {
    const commandNames = getSlashCommands().map((command) => command.name);
    expect(commandNames).toContain("export-session");
    expect(commandNames).toContain("export-trajectory");
    expect(commandNames).toContain("plugins");
    expect(commandNames).not.toContain("export");
    expect(commandNames).not.toContain("trajectory");
    expect(commandNames).not.toContain("plugin");
  });

  it("merges dynamic gateway commands", () => {
    const commands = getSlashCommands({
      dynamicCommands: [
        {
          name: "dreaming",
          textAliases: ["/dreaming"],
          description: "Enable or disable memory dreaming.",
          source: "plugin",
          scope: "both",
          acceptsArgs: true,
        },
      ],
    });

    expect(commands.find((command) => command.name === "dreaming")?.description).toBe(
      "Enable or disable memory dreaming.",
    );
  });
});

describe("commandCatalogText", () => {
  it("prints the full terminal command catalog", () => {
    const output = commandCatalogText();

    expect(output).toContain("Kova command catalog");
    expect(output).toContain("Use /help for essentials");
    expect(output).toContain("/commands - Show the full terminal command catalog");
    expect(output).toContain("/usage");
    expect(output).toContain("/status");
  });
});

describe("helpText", () => {
  it("shows compact slash command help by default", () => {
    const output = helpText();
    expect(output).toContain("Kova terminal controls");
    expect(output).toContain("Core:");
    expect(output).toContain("/status - current session and runtime state");
    expect(output).toContain("/memory - memory health and commands");
    expect(output).toContain("/limits - context window vs provider quota");
    expect(output).toContain("/approve - choose a pending approval");
    expect(output).toContain("/details <hidden|collapsed|expanded>");
    expect(output).toContain("More: /commands, /help all");
    expect(output).toContain("/commands opens the full catalog");
    expect(output).not.toContain("/elevated <on|off|ask|full>");
    expect(output).not.toContain("/abort");
    expect(output).not.toContain("/quit");
  });

  it("includes full slash command help for aliases", () => {
    const output = helpText({ verbose: true });
    expect(output).toContain("/elevated <on|off|ask|full>");
    expect(output).toContain("/gateway-status");
    expect(output).toContain("/limits");
    expect(output).toContain("/commands");
    expect(output).toContain("/session <key> (or /sessions [query])");
    expect(output).toContain("Kova terminal controls:");
    expect(output).toContain("/tools [compact|verbose]");
    expect(output).toContain("/skills [compact|verbose]");
    expect(output).toContain("/tasks [list|running|subagents|cron|audit|repair [apply]]");
    expect(output).toContain("/subagents [list|running|queued|failed|lost|all]");
    expect(output).toContain("/automation [list|running|queued|failed|audit]");
    expect(output).toContain("/recover [status|apply]");
    expect(output).toContain("/rollback [list|show <id>|branch <id>|restore <id> confirm]");
    expect(output).toContain("/context [list|detail|json]");
    expect(output).toContain(
      "/memory [status|help|sync [force]|search <query>|read <path[:line[-end]]>|dreams]",
    );
    expect(output).toContain("/skill <name> [args]");
    expect(output).toContain("/plugins [list|verbose|show <plugin>]");
    expect(output).toContain(
      "/permissions [edit|preset <locked|reviewed|balanced|trusted|default>]",
    );
    expect(output).toContain("/approve [id] [allow-once|allow-always|deny]");
    expect(output).toContain("Run controls:");
    expect(output).toContain("/details <status|hidden|collapsed|expanded|cycle>");
    expect(output).toContain("/stop");
    expect(output).toContain("Short aliases still work.");
    expect(output).not.toContain("/abort");
    expect(output).not.toContain("/quit");
  });
});
