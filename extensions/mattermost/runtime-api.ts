// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  KovaConfig,
  KovaPluginApi,
  PluginRuntime,
} from "getkova/plugin-sdk/core";
export type { RuntimeEnv } from "getkova/plugin-sdk/runtime";
export type { ReplyPayload } from "getkova/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "getkova/plugin-sdk/command-auth";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "getkova/plugin-sdk/config-runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "getkova/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "getkova/plugin-sdk/channel-status";
export { createAccountStatusSink } from "getkova/plugin-sdk/channel-lifecycle";
export { buildAgentMediaPayload } from "getkova/plugin-sdk/agent-media-payload";
export {
  buildModelsProviderData,
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "getkova/plugin-sdk/command-auth";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  loadSessionStore,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveStorePath,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "getkova/plugin-sdk/config-runtime";
export { formatInboundFromLabel } from "getkova/plugin-sdk/channel-inbound";
export { logInboundDrop } from "getkova/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "getkova/plugin-sdk/channel-pairing";
export {
  DM_GROUP_ACCESS_REASON,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
} from "getkova/plugin-sdk/channel-policy";
export { evaluateSenderGroupAccessForPolicy } from "getkova/plugin-sdk/group-access";
export { createChannelReplyPipeline } from "getkova/plugin-sdk/channel-reply-pipeline";
export { logTypingFailure } from "getkova/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "getkova/plugin-sdk/outbound-media";
export { rawDataToString } from "getkova/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "getkova/plugin-sdk/text-chunking";
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "getkova/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "getkova/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "getkova/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "getkova/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "getkova/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "getkova/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "getkova/plugin-sdk/media-runtime";
export { normalizeProviderId } from "getkova/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
