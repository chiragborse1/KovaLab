// Private runtime barrel for the bundled Zalo Personal extension.
// Keep this barrel thin and aligned with the local extension surface.

export * from "./api.js";
export { setZalouserRuntime } from "./src/runtime.js";
export type { ReplyPayload } from "getkova/plugin-sdk/reply-runtime";
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelStatusIssue,
} from "getkova/plugin-sdk/channel-contract";
export type {
  KovaConfig,
  GroupToolPolicyConfig,
  MarkdownTableMode,
} from "getkova/plugin-sdk/config-runtime";
export type {
  PluginRuntime,
  AnyAgentTool,
  ChannelPlugin,
  KovaPluginToolContext,
} from "getkova/plugin-sdk/core";
export type { RuntimeEnv } from "getkova/plugin-sdk/runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  normalizeAccountId,
} from "getkova/plugin-sdk/core";
export { chunkTextForOutbound } from "getkova/plugin-sdk/text-chunking";
export {
  isDangerousNameMatchingEnabled,
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "getkova/plugin-sdk/config-runtime";
export {
  mergeAllowlist,
  summarizeMapping,
  formatAllowFromLowercase,
} from "getkova/plugin-sdk/allow-from";
export { resolveInboundMentionDecision } from "getkova/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "getkova/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "getkova/plugin-sdk/channel-reply-pipeline";
export { buildBaseAccountStatusSnapshot } from "getkova/plugin-sdk/status-helpers";
export { resolveSenderCommandAuthorization } from "getkova/plugin-sdk/command-auth";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
} from "getkova/plugin-sdk/group-access";
export { loadOutboundMediaFromUrl } from "getkova/plugin-sdk/outbound-media";
export {
  deliverTextOrMediaReply,
  isNumericTargetId,
  resolveSendableOutboundReplyParts,
  sendPayloadWithChunkedTextAndMedia,
  type OutboundReplyPayload,
} from "getkova/plugin-sdk/reply-payload";
export { resolvePreferredKovaTmpDir } from "getkova/plugin-sdk/temp-path";
