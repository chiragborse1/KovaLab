import { describe, expect, it } from "vitest";
import { TAB_GROUPS, tabFromPath } from "./navigation.ts";

describe("TAB_GROUPS", () => {
  it("keeps advanced setup slices out of the sidebar", () => {
    const control = TAB_GROUPS.find((group) => group.label === "control");
    const agent = TAB_GROUPS.find((group) => group.label === "agent");
    const settings = TAB_GROUPS.find((group) => group.label === "settings");

    expect(control?.tabs).toEqual(["instances", "sessions", "usage", "cron"]);
    expect(agent?.tabs).toEqual(["agents", "persona", "skills", "nodes", "dreams"]);
    expect(settings?.tabs).toEqual(["controlPanel", "config"]);
  });

  it("keeps legacy advanced routes addressable", () => {
    expect(tabFromPath("/channels")).toBe("channels");
    expect(tabFromPath("/communications")).toBe("communications");
    expect(tabFromPath("/appearance")).toBe("appearance");
    expect(tabFromPath("/automation")).toBe("automation");
    expect(tabFromPath("/infrastructure")).toBe("infrastructure");
    expect(tabFromPath("/ai-agents")).toBe("aiAgents");
    expect(tabFromPath("/config")).toBe("config");
  });
});
