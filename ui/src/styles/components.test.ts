import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const uiRoot = process.cwd().endsWith(`${path.sep}ui`)
  ? process.cwd()
  : path.join(process.cwd(), "ui");

describe("agent fallback chip styles", () => {
  it("styles the chip remove control inside the agent model input", () => {
    const css = readFileSync(path.join(uiRoot, "src/styles/components.css"), "utf8");

    expect(css).toContain(".agent-chip-input .chip {");
    expect(css).toContain(".agent-chip-input .chip-remove {");
    expect(css).toContain(".agent-chip-input .chip-remove:hover:not(:disabled)");
    expect(css).toContain(".agent-chip-input .chip-remove:focus-visible:not(:disabled)");
    expect(css).toContain("outline: 2px solid var(--accent);");
    expect(css).toContain("outline-offset: 2px;");
    expect(css).toContain(".agent-chip-input .chip-remove:disabled");
  });
});

describe("skill toggle styles", () => {
  it("uses success green for enabled skills", () => {
    const css = readFileSync(path.join(uiRoot, "src/styles/components.css"), "utf8");

    expect(css).toContain(".skill-toggle:checked");
    expect(css).toContain("background: var(--ok);");
  });
});
