import { describe, expect, it } from "vitest";
import {
  hasBundledChannelConfiguredState,
  listBundledChannelIdsWithConfiguredState,
} from "./configured-state.js";

describe("bundled channel configured-state metadata", () => {
  it("lists the shipped metadata-first configured-state channels", () => {
    expect(listBundledChannelIdsWithConfiguredState()).toEqual(
      expect.arrayContaining(["irc", "slack", "telegram"]),
    );
  });

  it("resolves Slack, Telegram, and IRC env probes without full plugin loads", () => {
    expect(
      hasBundledChannelConfiguredState({
        channelId: "slack",
        cfg: {},
        env: { SLACK_BOT_TOKEN: "xoxb-test" },
      }),
    ).toBe(true);
    expect(
      hasBundledChannelConfiguredState({
        channelId: "telegram",
        cfg: {},
        env: { TELEGRAM_BOT_TOKEN: "token" },
      }),
    ).toBe(true);
    expect(
      hasBundledChannelConfiguredState({
        channelId: "irc",
        cfg: {},
        env: { IRC_HOST: "irc.example.com", IRC_NICK: "kova" },
      }),
    ).toBe(true);
  });
});
