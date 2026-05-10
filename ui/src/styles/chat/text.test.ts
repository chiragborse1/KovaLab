import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readTextCss(): string {
  const cssPath = [
    resolve(process.cwd(), "src/styles/chat/text.css"),
    resolve(process.cwd(), "ui/src/styles/chat/text.css"),
  ].find((candidate) => existsSync(candidate));
  expect(cssPath).toBeTruthy();
  return readFileSync(cssPath!, "utf8");
}

describe("chat text styles", () => {
  it("keeps transcript messages on the body font instead of UI chrome typography", () => {
    const css = readTextCss();

    expect(css).toContain("font-family: var(--font-body);");
    expect(css).toContain("letter-spacing: normal;");
    expect(css).toContain("text-transform: none;");
  });
});
