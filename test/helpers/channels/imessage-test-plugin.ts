import type { ChannelOutboundAdapter } from "getkova/plugin-sdk/channel-contract";
import type { ChannelPlugin } from "getkova/plugin-sdk/channel-plugin-common";
import { loadBundledPluginTestApiSync } from "../../../src/test-utils/bundled-plugin-public-surface.js";

type CreateIMessageTestPlugin = (params?: { outbound?: ChannelOutboundAdapter }) => ChannelPlugin;

let createIMessageTestPluginCache: CreateIMessageTestPlugin | undefined;

function getCreateIMessageTestPlugin(): CreateIMessageTestPlugin {
  if (!createIMessageTestPluginCache) {
    ({ createIMessageTestPlugin: createIMessageTestPluginCache } = loadBundledPluginTestApiSync<{
      createIMessageTestPlugin: CreateIMessageTestPlugin;
    }>("imessage"));
  }
  return createIMessageTestPluginCache;
}

export const createIMessageTestPlugin: CreateIMessageTestPlugin = (...args) =>
  getCreateIMessageTestPlugin()(...args);
