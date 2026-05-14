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

  it("defines the fixed right-side chat control rail", () => {
    const css = readLayoutCss();

    expect(css).toContain(".chat-control-sidebar");
    expect(css).toContain("height: 100%;");
    expect(css).toContain("align-self: stretch;");
    expect(css).toContain("overflow-x: hidden;");
    expect(css).toContain(".chat-view-control");
    expect(css).toContain(".chat-control-sidebar__section--sessions");
    expect(css).toContain(".chat-control-sidebar__section--collapsed");
    expect(css).toContain(".chat-control-sidebar__chevron--collapsed");
    expect(css).toContain(".chat-control-sidebar__section-body");
    expect(css).toContain(".chat-control-sidebar__section-body[hidden]");
    expect(css).toContain(".chat-session-list");
    expect(css).not.toContain(".chat-session-list__group-title");
    expect(css).toContain(".chat-sidebar-export");
    expect(css).toContain(".chat-workspace-main");
    expect(css).toContain("background: transparent;");
  });

  it("keeps chat composer model and thinking selectors compact and readable", () => {
    const css = readLayoutCss();

    expect(css).toContain(".agent-chat__composer-controls .chat-select");
    expect(css).toContain(".chat-select__menu");
    expect(css).toContain("overflow: visible;");
    expect(css).toContain("bottom: calc(100% + 8px);");
    expect(css).toContain("z-index: 250;");
    expect(css).toContain("height: 34px;");
    expect(css).toContain("font-size: 13px;");
    expect(css).toContain("font-weight: 500;");
    expect(css).toContain("line-height: normal;");
    expect(css).toContain("text-overflow: ellipsis;");
    expect(css).toContain(".chat-controls__thinking-select .chat-select__menu");
  });

  it("uses switch affordances for chat view controls", () => {
    const css = readLayoutCss();

    expect(css).toContain(".chat-view-switch");
    expect(css).toContain(".chat-view-control.active .chat-view-switch span");
    expect(css).toContain("background: var(--ok-subtle);");
    expect(css).toContain("background: var(--ok);");
    expect(css).toContain(".chat-view-control__icon--thinking");
  });
});
