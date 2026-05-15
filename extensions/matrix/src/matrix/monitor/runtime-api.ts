// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "getkova/plugin-sdk/channel-location";
export type { PluginRuntime, RuntimeLogger } from "getkova/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "getkova/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, KovaConfig } from "getkova/plugin-sdk/config-runtime";
export type { RuntimeEnv } from "getkova/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "getkova/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "getkova/plugin-sdk/channel-reply-options-runtime";
export { formatLocationText, toLocationContext } from "getkova/plugin-sdk/channel-location";
export { getAgentScopedMediaLocalRoots } from "getkova/plugin-sdk/agent-media-payload";
export { logInboundDrop, logTypingFailure } from "getkova/plugin-sdk/channel-logging";
export { resolveAckReaction } from "getkova/plugin-sdk/channel-feedback";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "getkova/plugin-sdk/channel-targets";
