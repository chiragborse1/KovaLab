import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("kova shell theme tokens", () => {
  it("keeps the shell black while lifting boxes off the background", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/kova.css"), "utf8");

    expect(css).toContain("--k-bg: #0a0a0a;");
    expect(css).toContain("--k-control-bg: #181818;");
    expect(css).toContain("var(--k-control-bg) 82%");
    expect(css).toContain("--k-radius-sm: var(--radius-sm);");
    expect(css).toContain("border-radius: var(--k-radius-sm, var(--radius-sm)) !important;");
  });

  it("uses green on-states for shared kova toggles", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/kova.css"), "utf8");

    expect(css).toContain('.kova-toggle[aria-checked="true"]');
    expect(css).toContain("border-color: var(--k-green);");
    expect(css).toContain("background: var(--k-green) !important;");
  });
});
