import { describe, expect, it } from "vitest";
import { getSlashCommands, helpText, parseCommand } from "./commands.js";

describe("parseCommand", () => {
  it("normalizes aliases and keeps command args", () => {
    expect(parseCommand("/elev full")).toEqual({ name: "elevated", args: "full" });
  });

  it("normalizes gateway-status aliases", () => {
    expect(parseCommand("/gwstatus")).toEqual({ name: "gateway-status", args: "" });
  });

  it("normalizes hidden lifecycle aliases", () => {
    expect(parseCommand("/abort")).toEqual({ name: "stop", args: "" });
    expect(parseCommand("/quit")).toEqual({ name: "exit", args: "" });
    expect(parseCommand("/commands")).toEqual({ name: "help", args: "" });
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
    expect(activation?.getArgumentCompletions?.("a")).toEqual([
      { value: "always", label: "always" },
    ]);
  });

  it("keeps session status on the shared command path and exposes gateway status separately", () => {
    const commands = getSlashCommands();
    const status = commands.find((command) => command.name === "status");
    const gatewayStatus = commands.find((command) => command.name === "gateway-status");
    const crestodian = commands.find((command) => command.name === "crestodian");
    expect(status?.description).toBe("Show current status.");
    expect(gatewayStatus?.description).toBe("Show gateway status summary");
    expect(crestodian?.description).toBe("Return to Crestodian");
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
    expect(tools?.getArgumentCompletions?.("v")).toEqual([{ value: "verbose", label: "verbose" }]);
    expect(skills?.getArgumentCompletions?.("c")).toEqual([{ value: "compact", label: "compact" }]);
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
  });

  it("keeps alias commands out of the visible command palette", () => {
    const commandNames = getSlashCommands().map((command) => command.name);
    expect(commandNames).toContain("elevated");
    expect(commandNames).toContain("gateway-status");
    expect(commandNames).toContain("stop");
    expect(commandNames).not.toContain("elev");
    expect(commandNames).not.toContain("gwstatus");
    expect(commandNames).not.toContain("abort");
    expect(commandNames).not.toContain("commands");
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

describe("helpText", () => {
  it("includes slash command help for aliases", () => {
    const output = helpText();
    expect(output).toContain("/elevated <on|off|ask|full>");
    expect(output).toContain("/gateway-status");
    expect(output).not.toContain("/commands");
    expect(output).toContain("/crestodian [request]");
    expect(output).toContain("/session <key> (or /sessions [query])");
    expect(output).toContain("Kova terminal controls:");
    expect(output).toContain("/tools [compact|verbose]");
    expect(output).toContain("/skills [compact|verbose]");
    expect(output).toContain("/tasks [list|running|subagents|cron|audit|repair [apply]]");
    expect(output).toContain("/subagents [list|running|queued|failed|lost|all]");
    expect(output).toContain("/automation [list|running|audit]");
    expect(output).toContain("/recover [status|apply]");
    expect(output).toContain("/rollback [list|show <id>|branch <id>|restore <id> confirm]");
    expect(output).toContain("/context [compact|verbose]");
    expect(output).toContain(
      "/memory <status|sync [force]|search <query>|read <path[:line[-end]]>|dreams>",
    );
    expect(output).toContain("/skill <name> [args]");
    expect(output).toContain("/plugins [list|verbose|show <plugin>]");
    expect(output).toContain("Run controls:");
    expect(output).toContain("/stop");
    expect(output).toContain("commands alias opens help");
    expect(output).not.toContain("/abort");
    expect(output).not.toContain("/quit");
  });
});
