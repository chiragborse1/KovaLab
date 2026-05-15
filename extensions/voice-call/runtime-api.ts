// Private runtime barrel for the bundled Voice Call extension.
// Keep this barrel thin and aligned with the local extension surface.

export { definePluginEntry } from "getkova/plugin-sdk/plugin-entry";
export type { KovaPluginApi } from "getkova/plugin-sdk/plugin-entry";
export type { GatewayRequestHandlerOptions } from "getkova/plugin-sdk/gateway-runtime";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "getkova/plugin-sdk/webhook-request-guards";
export { fetchWithSsrFGuard, isBlockedHostnameOrIp } from "getkova/plugin-sdk/ssrf-runtime";
export type { SessionEntry } from "getkova/plugin-sdk/session-store-runtime";
export {
  TtsAutoSchema,
  TtsConfigSchema,
  TtsModeSchema,
  TtsProviderSchema,
} from "getkova/plugin-sdk/tts-runtime";
export { sleep } from "getkova/plugin-sdk/runtime-env";
