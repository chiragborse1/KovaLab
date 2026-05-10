import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("kova shell theme tokens", () => {
  it("keeps the chat shell black without global gray surface overrides", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/kova.css"), "utf8");

    expect(css).toContain("--k-bg: #0a0a0a;");
    expect(css).toContain("--k-control-bg: #181818;");
    expect(css).toContain(".kova-detail-pane--chat .chat-thread");
    expect(css).toContain("background-color: var(--k-bg) !important;");
    expect(css).not.toContain("var(--k-control-bg) 82%");
    expect(css).toContain("--k-radius-sm: var(--radius-sm);");
  });

  it("uses green on-states for shared kova toggles", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/kova.css"), "utf8");

    expect(css).toContain('.kova-toggle[aria-checked="true"]');
    expect(css).toContain("border-color: var(--k-green);");
    expect(css).toContain("background: var(--k-green) !important;");
  });
});
