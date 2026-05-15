// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "getkova/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "getkova/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "getkova/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "getkova/plugin-sdk/channel-contract";
export { missingTargetError } from "getkova/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "getkova/plugin-sdk/channel-lifecycle";
export { createChannelPairingController } from "getkova/plugin-sdk/channel-pairing";
export { createChannelReplyPipeline } from "getkova/plugin-sdk/channel-reply-pipeline";
export {
  evaluateGroupRouteAccessForPolicy,
  resolveDmGroupAccessWithLists,
  resolveSenderScopedGroupPolicy,
} from "getkova/plugin-sdk/channel-policy";
export { PAIRING_APPROVED_MESSAGE } from "getkova/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "getkova/plugin-sdk/text-chunking";
export type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  isDangerousNameMatchingEnabled,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "getkova/plugin-sdk/config-runtime";
export { fetchRemoteMedia, resolveChannelMediaMaxBytes } from "getkova/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "getkova/plugin-sdk/outbound-media";
export type { PluginRuntime } from "getkova/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "getkova/plugin-sdk/ssrf-runtime";
export {
  GoogleChatConfigSchema,
  type GoogleChatAccountConfig,
  type GoogleChatConfig,
} from "getkova/plugin-sdk/googlechat-runtime-shared";
export { extractToolSend } from "getkova/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "getkova/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "getkova/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "getkova/plugin-sdk/webhook-path";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "getkova/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "getkova/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
