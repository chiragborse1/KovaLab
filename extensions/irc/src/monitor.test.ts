import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#kova",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#kova",
      rawTarget: "#kova",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "kova-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "kova-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "kova-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "kova-bot",
      rawTarget: "kova-bot",
    });
  });
});
