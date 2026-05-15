// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "getkova/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "getkova/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "getkova/plugin-sdk/channel-send-result";
export type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
export type { RuntimeEnv } from "getkova/plugin-sdk/runtime";
export type { WizardPrompter } from "getkova/plugin-sdk/setup";
