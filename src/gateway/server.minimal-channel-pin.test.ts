import { afterEach, expect, test } from "vitest";
import { getChannelPlugin } from "../channels/plugins/index.js";
import {
  getActivePluginRegistry,
  resetPluginRuntimeStateForTest,
  setActivePluginRegistry,
} from "../plugins/runtime.js";
import { createOutboundTestPlugin, createTestRegistry } from "../test-utils/channel-plugins.js";

const whatsappOutbound = {
  deliveryMode: "direct" as const,
  sendText: async () => ({ channel: "whatsapp", messageId: "text-1" }),
  sendMedia: async () => ({ channel: "whatsapp", messageId: "media-1" }),
};

const replacementPlugin = createOutboundTestPlugin({
  id: "whatsapp",
  outbound: whatsappOutbound,
  label: "WhatsApp Replacement",
});

const replacementRegistry = createTestRegistry([
  {
    pluginId: "whatsapp",
    source: "test-replacement",
    plugin: replacementPlugin,
  },
]);

afterEach(() => {
  resetPluginRuntimeStateForTest();
});

test("channel plugin lookups track later registry updates", () => {
  const prevRegistry = getActivePluginRegistry();
  resetPluginRuntimeStateForTest();
  try {
    expect(getChannelPlugin("whatsapp")).not.toBe(replacementPlugin);
    setActivePluginRegistry(replacementRegistry);
    expect(getChannelPlugin("whatsapp")).toBe(replacementPlugin);
  } finally {
    resetPluginRuntimeStateForTest();
    if (prevRegistry) {
      setActivePluginRegistry(prevRegistry);
    }
  }
});
