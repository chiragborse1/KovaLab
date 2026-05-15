// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "getkova/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "getkova/plugin-sdk/channel-contract";
export { logInboundDrop } from "getkova/plugin-sdk/channel-logging";
export { createChannelPairingController } from "getkova/plugin-sdk/channel-pairing";
export {
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithCommandGate,
} from "getkova/plugin-sdk/channel-policy";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  KovaConfig,
} from "getkova/plugin-sdk/config-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "getkova/plugin-sdk/config-runtime";
export { dispatchInboundReplyWithBase } from "getkova/plugin-sdk/inbound-reply-dispatch";
export type { OutboundReplyPayload } from "getkova/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "getkova/plugin-sdk/reply-payload";
export type { PluginRuntime } from "getkova/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "getkova/plugin-sdk/runtime";
export type { SecretInput } from "getkova/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "getkova/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
