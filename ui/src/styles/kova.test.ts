import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("kova shell theme tokens", () => {
  it("keeps dark mode off pure black", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/kova.css"), "utf8");

    expect(css).toContain("--k-bg: #11100e;");
    expect(css).not.toContain("--k-bg: #0a0a0a;");
  });
});
