import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLayoutCss(): string {
  const cssPath = [
    resolve(process.cwd(), "src/styles/chat/layout.css"),
    resolve(process.cwd(), "ui/src/styles/chat/layout.css"),
  ].find((candidate) => existsSync(candidate));
  expect(cssPath).toBeTruthy();
  return readFileSync(cssPath!, "utf8");
}

describe("chat layout styles", () => {
  it("styles queued-message steering controls and pending indicators", () => {
    const css = readLayoutCss();

    expect(css).toContain(".chat-queue__steer");
    expect(css).toContain(".chat-queue__actions");
    expect(css).toContain(".chat-queue__item--steered");
    expect(css).toContain(".chat-queue__badge");
  });

  it("includes assistant text avatar styles for configured IDENTITY avatars", () => {
    const css = readLayoutCss();

    expect(css).toContain(".agent-chat__avatar--text");
    expect(css).toContain("font-size: 20px;");
    expect(css).toContain("place-items: center;");
  });

  it("keeps the chat composer compact without an internal divider", () => {
    const css = readLayoutCss();

    expect(css).toContain("width: min(calc(100% - 30px), 1040px);");
    expect(css).toContain("min-height: 64px;");
    expect(css).not.toContain(
      ".agent-chat__toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 6px 10px;\n  border-top:",
    );
  });
});
