import { describe, expect, it } from "vitest";
import { TAB_GROUPS, tabFromPath } from "./navigation.ts";

describe("TAB_GROUPS", () => {
  it("publishes the focused main and knowledge menus", () => {
    const main = TAB_GROUPS.find((group) => group.label === "main");
    const knowledge = TAB_GROUPS.find((group) => group.label === "knowledge");
    expect(main?.tabs).toEqual([
      "overview",
      "agents",
      "cron",
      "tasks",
      "conductor",
      "operations",
      "sessions",
    ]);
    expect(knowledge?.tabs).toEqual(["dreams", "skills", "mcp"]);
  });

  it("keeps the full legacy controls available under advanced", () => {
    const advanced = TAB_GROUPS.find((group) => group.label === "advanced");
    expect(advanced?.tabs).toEqual([
      "config",
      "channels",
      "communications",
      "instances",
      "nodes",
      "usage",
      "appearance",
      "automation",
      "infrastructure",
      "aiAgents",
    ]);
  });

  it("routes every published settings slice", () => {
    expect(tabFromPath("/mcp")).toBe("mcp");
    expect(tabFromPath("/communications")).toBe("communications");
    expect(tabFromPath("/appearance")).toBe("appearance");
    expect(tabFromPath("/automation")).toBe("automation");
    expect(tabFromPath("/infrastructure")).toBe("infrastructure");
    expect(tabFromPath("/ai-agents")).toBe("aiAgents");
    expect(tabFromPath("/config")).toBe("config");
  });
});
