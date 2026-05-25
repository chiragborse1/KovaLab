import { afterEach, describe, expect, it } from "vitest";
import { createEmptyPluginRegistry } from "../plugins/registry-empty.js";
import {
  pinActivePluginChannelRegistry,
  resetPluginRuntimeStateForTest,
  setActivePluginRegistry,
} from "../plugins/runtime.js";
import { listChatChannels } from "./chat-meta.js";
import { isChannelVisibleInConfiguredLists, isChannelVisibleInSetup } from "./plugins/exposure.js";
import {
  formatChannelSelectionLine,
  listRegisteredChannelPluginIds,
  normalizeAnyChannelId,
} from "./registry.js";

describe("channel registry helpers", () => {
  afterEach(() => {
    resetPluginRuntimeStateForTest();
  });

  it("keeps Feishu first in the current default order", () => {
    const channels = listChatChannels();
    expect(channels[0]?.id).toBe("feishu");
  });

  it("includes MS Teams in the bundled channel list", () => {
    const channels = listChatChannels();
    expect(channels.some((channel) => channel.id === "msteams")).toBe(true);
  });

  it("keeps the legacy imsg bridge out of new setup surfaces", () => {
    const channels = listChatChannels();
    const imessage = channels.find((channel) => channel.id === "imessage");
    const bluebubbles = channels.find((channel) => channel.id === "bluebubbles");

    expect(imessage).toBeDefined();
    expect(bluebubbles).toBeDefined();
    expect(isChannelVisibleInSetup(imessage!)).toBe(false);
    expect(isChannelVisibleInConfiguredLists(imessage!)).toBe(false);
    expect(isChannelVisibleInSetup(bluebubbles!)).toBe(true);
  });

  it("formats Telegram selection lines without a docs prefix and with website extras", () => {
    const telegram = listChatChannels().find((channel) => channel.id === "telegram");
    if (!telegram) {
      throw new Error("Missing Telegram channel metadata.");
    }
    const line = formatChannelSelectionLine(telegram, (path, label) =>
      [label, path].filter(Boolean).join(":"),
    );
    expect(line).not.toContain("Docs:");
    expect(line).toContain("/channels/telegram");
    expect(line).toContain("https://www.neuralstudio.in");
  });

  it("prefers the pinned channel registry when resolving registered plugin channels", () => {
    const startupRegistry = createEmptyPluginRegistry();
    startupRegistry.channels = [
      {
        pluginId: "kova-weixin",
        plugin: { id: "kova-weixin", meta: { aliases: ["weixin"] } },
        source: "test",
      },
    ] as never;
    setActivePluginRegistry(startupRegistry);
    pinActivePluginChannelRegistry(startupRegistry);

    const replacementRegistry = createEmptyPluginRegistry();
    replacementRegistry.channels = [
      {
        pluginId: "qqbot",
        plugin: { id: "qqbot", meta: { aliases: ["qq"] } },
        source: "test",
      },
    ] as never;
    setActivePluginRegistry(replacementRegistry);

    expect(listRegisteredChannelPluginIds()).toEqual(["kova-weixin"]);
    expect(normalizeAnyChannelId("weixin")).toBe("kova-weixin");
  });

  it("falls back to the active registry when the pinned channel registry has no channels", () => {
    const startupRegistry = createEmptyPluginRegistry();
    setActivePluginRegistry(startupRegistry);
    pinActivePluginChannelRegistry(startupRegistry);

    const replacementRegistry = createEmptyPluginRegistry();
    replacementRegistry.channels = [
      {
        pluginId: "qqbot",
        plugin: { id: "qqbot", meta: { aliases: ["qq"] } },
        source: "test",
      },
    ] as never;
    setActivePluginRegistry(replacementRegistry);

    expect(listRegisteredChannelPluginIds()).toEqual(["qqbot"]);
    expect(normalizeAnyChannelId("qq")).toBe("qqbot");
  });
});
