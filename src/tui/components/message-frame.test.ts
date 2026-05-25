import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth } from "@mariozechner/pi-tui";
import { describe, expect, it } from "vitest";
import { MessageFrame } from "./message-frame.js";

class PlainBody implements Component {
  render(): string[] {
    return ["hello"];
  }

  invalidate(): void {}
}

const plainTheme = {
  border: (text: string) => text,
  title: (text: string) => text,
};

describe("MessageFrame", () => {
  it("renders an open titled frame without changing visible width", () => {
    const frame = new MessageFrame(new PlainBody(), {
      title: "Kova",
      theme: plainTheme,
    });

    const lines = frame.render(24);

    expect(lines[0]).toContain("╭─ Kova");
    expect(lines[0]).not.toContain("╮");
    expect(lines[1]).toContain("  hello");
    expect(lines.join("\n")).not.toContain("│");
    expect(lines.join("\n")).not.toContain("╰");
    expect(lines.every((line) => visibleWidth(line) === 24)).toBe(true);
  });

  it("falls back to the body on very narrow terminals", () => {
    const frame = new MessageFrame(new PlainBody(), {
      title: "Kova",
      theme: plainTheme,
    });

    expect(frame.render(6)).toEqual(["hello"]);
  });
});
