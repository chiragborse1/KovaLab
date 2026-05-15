export type { ChannelPlugin, KovaPluginApi, PluginRuntime } from "getkova/plugin-sdk/core";
export type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
export type {
  KovaPluginService,
  KovaPluginServiceContext,
  PluginLogger,
} from "getkova/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/bridge/runtime.js";
