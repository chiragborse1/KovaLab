import { visibleWidth } from "@mariozechner/pi-tui";
import { describe, expect, it } from "vitest";
import { normalizeTestText } from "../../../test/helpers/normalize-text.js";
import { KovaHero } from "./kova-hero.js";

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
    expect(rendered).toContain("Available Tools");
    expect(rendered).toContain("browser_click");
    expect(rendered).toContain("Available Skills");
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
});
