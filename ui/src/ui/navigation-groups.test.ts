import { describe, expect, it } from "vitest";
import { TAB_GROUPS, tabFromPath } from "./navigation.ts";

describe("TAB_GROUPS", () => {
  it("exposes the operator-first sidebar groups", () => {
    expect(TAB_GROUPS).toEqual([
      {
        label: "main",
        tabs: [
          "overview",
          "chat",
          "files",
          "terminal",
          "cron",
          "tasks",
          "conductor",
          "operations",
          "sessions",
        ],
      },
      {
        label: "knowledge",
        tabs: ["memory", "skills", "mcp", "profiles"],
      },
    ]);
  });

  it("keeps routing for hidden existing slices", () => {
    expect(tabFromPath("/communications")).toBe("communications");
    expect(tabFromPath("/appearance")).toBe("appearance");
    expect(tabFromPath("/automation")).toBe("automation");
    expect(tabFromPath("/infrastructure")).toBe("infrastructure");
    expect(tabFromPath("/ai-agents")).toBe("aiAgents");
    expect(tabFromPath("/config")).toBe("config");
    expect(tabFromPath("/channels")).toBe("channels");
    expect(tabFromPath("/nodes")).toBe("nodes");
    expect(tabFromPath("/logs")).toBe("logs");
  });

  it("routes new hub aliases", () => {
    expect(tabFromPath("/dashboard")).toBe("overview");
    expect(tabFromPath("/jobs")).toBe("cron");
    expect(tabFromPath("/files")).toBe("files");
    expect(tabFromPath("/terminal")).toBe("terminal");
    expect(tabFromPath("/tasks")).toBe("tasks");
    expect(tabFromPath("/conductor")).toBe("conductor");
    expect(tabFromPath("/operations")).toBe("operations");
    expect(tabFromPath("/memory")).toBe("memory");
    expect(tabFromPath("/mcp")).toBe("mcp");
    expect(tabFromPath("/profiles")).toBe("profiles");
  });
});
