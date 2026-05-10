import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("kova shell theme tokens", () => {
  it("uses the rounded Kova card theme instead of the flat rules theme", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/kova.css"), "utf8");

    expect(css).toContain("--k-bg: var(--bg, #0e1015);");
    expect(css).toContain("--k-control-bg: var(--card, #161920);");
    expect(css).toContain("--k-accent: var(--accent, #ff8a1f);");
    expect(css).toContain("border-radius: var(--radius-md);");
    expect(css).toContain(".kova-detail-pane--chat .chat-thread");
    expect(css).toContain("background-color: var(--bg, var(--k-bg)) !important;");
    expect(css).not.toContain("box-shadow: none !important");
    expect(css).not.toContain(".kova-detail-pane *");
    expect(css).toContain("--k-radius-sm: var(--radius-sm);");
  });

  it("uses green on-states for shared kova toggles", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/kova.css"), "utf8");

    expect(css).toContain('.kova-toggle[aria-checked="true"]');
    expect(css).toContain("border-color: var(--k-green);");
    expect(css).toContain("background: var(--k-green) !important;");
  });
});
