import { describe, expect, it } from "vitest";
import { TAB_GROUPS, tabFromPath } from "./navigation.ts";

describe("TAB_GROUPS", () => {
  it("organizes primary pages around operator workflows", () => {
    const main = TAB_GROUPS.find((group) => group.label === "main");
    const knowledge = TAB_GROUPS.find((group) => group.label === "knowledge");
    const system = TAB_GROUPS.find((group) => group.label === "system");
    expect(main?.tabs).toEqual([
      "overview",
      "chat",
      "agents",
      "files",
      "cron",
      "sessions",
      "operations",
    ]);
    expect(knowledge?.tabs).toEqual(["dreams", "skills", "mcp", "profiles"]);
    expect(system?.tabs).toEqual([
      "channels",
      "instances",
      "nodes",
      "usage",
      "config",
      "appearance",
      "logs",
      "debug",
    ]);
  });

  it("routes every published settings slice and focused shortcut", () => {
    expect(tabFromPath("/communications")).toBe("communications");
    expect(tabFromPath("/appearance")).toBe("appearance");
    expect(tabFromPath("/automation")).toBe("automation");
    expect(tabFromPath("/infrastructure")).toBe("infrastructure");
    expect(tabFromPath("/ai-agents")).toBe("aiAgents");
    expect(tabFromPath("/config")).toBe("config");
    expect(tabFromPath("/files")).toBe("files");
    expect(tabFromPath("/operations")).toBe("operations");
    expect(tabFromPath("/mcp")).toBe("mcp");
    expect(tabFromPath("/profiles")).toBe("profiles");
  });
});
