// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "getkova/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "getkova/plugin-sdk/channel-core";
export type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
export type { PluginRuntime } from "getkova/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "getkova/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "getkova/plugin-sdk/config-runtime";
export type { OutboundReplyPayload } from "getkova/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "getkova/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "getkova/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "getkova/plugin-sdk/channel-status";
export { createChannelPairingController } from "getkova/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "getkova/plugin-sdk/channel-lifecycle";
export {
  readStoreAllowFromForDmPolicy,
  resolveEffectiveAllowFromLists,
} from "getkova/plugin-sdk/channel-policy";
export { resolveControlCommandGate } from "getkova/plugin-sdk/command-auth";
export { dispatchInboundReplyWithBase } from "getkova/plugin-sdk/inbound-reply-dispatch";
export { chunkTextForOutbound } from "getkova/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "getkova/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "getkova/plugin-sdk/config-runtime";
export { logInboundDrop } from "getkova/plugin-sdk/channel-inbound";
