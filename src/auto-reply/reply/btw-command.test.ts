import { describe, expect, it } from "vitest";
import { extractBtwQuestion, isBtwRequestText } from "./btw-command.js";

describe("btw command helpers", () => {
  it("detects raw /btw text even when command registry aliases are not loaded", () => {
    expect(isBtwRequestText("/btw what changed?")).toBe(true);
    expect(extractBtwQuestion("/btw what changed?")).toBe("what changed?");
  });

  it("supports colon and bot-mention forms", () => {
    expect(extractBtwQuestion("/btw: what changed?")).toBe("what changed?");
    expect(extractBtwQuestion("/btw@kova_bot what changed?", { botUsername: "kova_bot" })).toBe(
      "what changed?",
    );
  });

  it("rejects non-btw commands", () => {
    expect(isBtwRequestText("/btwice nope")).toBe(false);
    expect(extractBtwQuestion("/status")).toBeNull();
  });
});
