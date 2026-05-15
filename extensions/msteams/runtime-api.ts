// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "getkova/plugin-sdk/account-id";
export type { AllowlistMatch } from "getkova/plugin-sdk/allow-from";
export {
  mergeAllowlist,
  resolveAllowlistMatchSimple,
  summarizeMapping,
} from "getkova/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "getkova/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "getkova/plugin-sdk/channel-core";
export { logTypingFailure } from "getkova/plugin-sdk/channel-logging";
export { createChannelPairingController } from "getkova/plugin-sdk/channel-pairing";
export {
  evaluateSenderGroupAccessForPolicy,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
  resolveSenderScopedGroupPolicy,
  resolveToolsBySender,
} from "getkova/plugin-sdk/channel-policy";
export { createChannelReplyPipeline } from "getkova/plugin-sdk/channel-reply-pipeline";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "getkova/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "getkova/plugin-sdk/channel-targets";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  KovaConfig,
} from "getkova/plugin-sdk/config-runtime";
export {
  isDangerousNameMatchingEnabled,
  resolveDefaultGroupPolicy,
} from "getkova/plugin-sdk/config-runtime";
export { withFileLock } from "getkova/plugin-sdk/file-lock";
export { keepHttpServerTaskAlive } from "getkova/plugin-sdk/channel-lifecycle";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
  resolveChannelMediaMaxBytes,
} from "getkova/plugin-sdk/media-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "getkova/plugin-sdk/inbound-reply-dispatch";
export { loadOutboundMediaFromUrl } from "getkova/plugin-sdk/outbound-media";
export { buildMediaPayload } from "getkova/plugin-sdk/reply-payload";
export type { ReplyPayload } from "getkova/plugin-sdk/reply-payload";
export type { PluginRuntime } from "getkova/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "getkova/plugin-sdk/runtime";
export type { SsrFPolicy } from "getkova/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "getkova/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "getkova/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "getkova/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "getkova/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
