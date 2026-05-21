import { describe, expect, it } from "vitest";
import { getSlashCommands, helpText, parseCommand } from "./commands.js";

describe("parseCommand", () => {
  it("normalizes aliases and keeps command args", () => {
    expect(parseCommand("/elev full")).toEqual({ name: "elevated", args: "full" });
  });

  it("normalizes gateway-status aliases", () => {
    expect(parseCommand("/gwstatus")).toEqual({ name: "gateway-status", args: "" });
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
      "status | sync [force] | search <query> | read <path[:line[-end]]>",
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
  });

  it("marks /sessions as query-filterable", () => {
    const commands = getSlashCommands();
    const sessions = commands.find((command) => command.name === "sessions");
    expect(sessions?.argumentHint).toBe("[query]");
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
    expect(output).toContain("/elev <on|off|ask|full>");
    expect(output).toContain("/gateway-status");
    expect(output).toContain("/gwstatus");
    expect(output).toContain("/crestodian [request]");
    expect(output).toContain("/session <key> (or /sessions [query])");
    expect(output).toContain("Terminal command center:");
    expect(output).toContain("/tools [compact|verbose]");
    expect(output).toContain("/context [compact|verbose]");
    expect(output).toContain(
      "/memory <status|sync [force]|search <query>|read <path[:line[-end]]>>",
    );
    expect(output).toContain("/skill <name> [args]");
    expect(output).toContain("/plugins list");
    expect(output).toContain("Run controls:");
  });
});
