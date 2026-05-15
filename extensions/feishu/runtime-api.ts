// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  KovaConfig,
  KovaPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "getkova/plugin-sdk/core";
export type { KovaConfig as KovaConfig } from "getkova/plugin-sdk/core";
export type { RuntimeEnv } from "getkova/plugin-sdk/runtime";
export type { GroupToolPolicyConfig } from "getkova/plugin-sdk/config-runtime";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "getkova/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "getkova/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "getkova/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "getkova/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "getkova/plugin-sdk/channel-reply-pipeline";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "getkova/plugin-sdk/config-runtime";
export { loadSessionStore, resolveSessionStoreEntry } from "getkova/plugin-sdk/config-runtime";
export { readJsonFileWithFallback } from "getkova/plugin-sdk/json-store";
export { createPersistentDedupe } from "getkova/plugin-sdk/persistent-dedupe";
export { normalizeAgentId } from "getkova/plugin-sdk/routing";
export { chunkTextForOutbound } from "getkova/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "getkova/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
