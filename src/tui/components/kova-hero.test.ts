import { visibleWidth } from "@mariozechner/pi-tui";
import { describe, expect, it } from "vitest";
import { normalizeTestText } from "../../../test/helpers/normalize-text.js";
import { KovaHero, formatSkillSourceLabel } from "./kova-hero.js";

describe("KovaHero", () => {
  it("renders the connected Kova shell with live tools and skills", () => {
    const hero = new KovaHero();
    hero.setState({
      connection: "ws://127.0.0.1:7345",
      connectionStatus: "connected",
      agentLabel: "main",
      sessionLabel: "main",
      modelLabel: "openai/gpt-5.4",
      tokenLabel: "12 / 100",
      toolGroups: [
        {
          id: "browser",
          label: "browser",
          source: "core",
          tools: [
            { id: "browser_click", label: "browser_click" },
            { id: "browser_back", label: "browser_back" },
          ],
        },
      ],
      skills: [{ name: "codex", source: "bundled", eligible: true }],
    });

    const rendered = normalizeTestText(hero.render(132).join("\n"));
    expect(rendered).toContain("Kova Agent");
    expect(rendered).toContain("Tool Surface");
    expect(rendered).toContain("browser_click");
    expect(rendered).toContain("Skill Surface");
    expect(rendered).toContain("codex");
  });

  it("keeps all rendered lines within the requested width", () => {
    const hero = new KovaHero();
    hero.setState({
      connectionStatus: "gateway connected",
      agentLabel: "very-long-agent-name",
      sessionLabel: "very-long-session-name",
      toolGroups: [
        {
          id: "long",
          label: "very-long-tool-group-name",
          source: "plugin",
          tools: [{ id: "very_long_tool_name_that_must_be_clipped", label: "very_long_tool_name" }],
        },
      ],
      skills: [{ name: "very-long-skill-name-that-must-be-clipped", source: "workspace" }],
    });

    for (const width of [48, 88, 120]) {
      const lines = hero.render(width);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(visibleWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  });

  it("renders Kova source labels for legacy Kova skill sources", () => {
    const hero = new KovaHero();
    hero.setState({
      skills: [
        { name: "one", source: "kova-bundled", eligible: false },
        { name: "two", source: "kova-extra", eligible: true },
      ],
    });

    const rendered = normalizeTestText(hero.render(120).join("\n"));
    expect(rendered).toContain("kova-bundled");
    expect(rendered).toContain("kova-extra");
    expect(rendered).toContain("offline one");
  });

  it("maps known legacy skill source labels without changing unknown sources", () => {
    expect(formatSkillSourceLabel("kova-bundled")).toBe("kova-bundled");
    expect(formatSkillSourceLabel("kova-extra")).toBe("kova-extra");
    expect(formatSkillSourceLabel("workspace")).toBe("workspace");
  });
});
