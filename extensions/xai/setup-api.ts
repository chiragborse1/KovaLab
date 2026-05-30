import { definePluginEntry } from "getkova/plugin-sdk/plugin-entry";
import type {
  ProviderAuthContext,
  ProviderAuthMethod,
  ProviderAuthMethodNonInteractiveContext,
} from "getkova/plugin-sdk/plugin-entry";
import { isRecord } from "./src/tool-config-shared.js";

const PROVIDER_ID = "xai";
const XAI_API_KEY_METHOD_ID = "api-key";
const XAI_OAUTH_METHOD_ID = "oauth";
const XAI_DEVICE_CODE_METHOD_ID = "device-code";

async function runXaiApiKeyAuthMethod(ctx: ProviderAuthContext) {
  const { createProviderApiKeyAuthMethod } =
    await import("getkova/plugin-sdk/provider-auth-api-key");
  const { applyXaiConfig, XAI_DEFAULT_MODEL_REF } = await import("./onboard.js");
  return createProviderApiKeyAuthMethod({
    providerId: PROVIDER_ID,
    methodId: XAI_API_KEY_METHOD_ID,
    label: "xAI API key",
    hint: "API key",
    optionKey: "xaiApiKey",
    flagName: "--xai-api-key",
    envVar: "XAI_API_KEY",
    promptMessage: "Enter xAI API key",
    defaultModel: XAI_DEFAULT_MODEL_REF,
    expectedProviders: [PROVIDER_ID],
    applyConfig: (cfg) => applyXaiConfig(cfg),
  }).run(ctx);
}

async function runXaiApiKeyAuthMethodNonInteractive(ctx: ProviderAuthMethodNonInteractiveContext) {
  const { createProviderApiKeyAuthMethod } =
    await import("getkova/plugin-sdk/provider-auth-api-key");
  const { applyXaiConfig, XAI_DEFAULT_MODEL_REF } = await import("./onboard.js");
  return (
    (await createProviderApiKeyAuthMethod({
      providerId: PROVIDER_ID,
      methodId: XAI_API_KEY_METHOD_ID,
      label: "xAI API key",
      hint: "API key",
      optionKey: "xaiApiKey",
      flagName: "--xai-api-key",
      envVar: "XAI_API_KEY",
      promptMessage: "Enter xAI API key",
      defaultModel: XAI_DEFAULT_MODEL_REF,
      expectedProviders: [PROVIDER_ID],
      applyConfig: (cfg) => applyXaiConfig(cfg),
    }).runNonInteractive?.(ctx)) ?? null
  );
}

function buildXaiApiKeyMethod(): ProviderAuthMethod {
  return {
    id: XAI_API_KEY_METHOD_ID,
    label: "xAI API key",
    hint: "API key",
    kind: "api_key",
    wizard: {
      choiceId: "xai-api-key",
      choiceLabel: "xAI API key",
      groupId: PROVIDER_ID,
      groupLabel: "xAI (Grok)",
      groupHint: "API key or browser OAuth",
    },
    run: (ctx) => runXaiApiKeyAuthMethod(ctx),
    runNonInteractive: (ctx) => runXaiApiKeyAuthMethodNonInteractive(ctx),
  };
}

function buildXaiOAuthMethod(): ProviderAuthMethod {
  return {
    id: XAI_OAUTH_METHOD_ID,
    label: "xAI OAuth",
    hint: "Browser sign-in for eligible xAI accounts",
    kind: "oauth",
    wizard: {
      choiceId: "xai-oauth",
      choiceLabel: "xAI OAuth",
      choiceHint: "Browser sign-in for eligible xAI accounts",
      groupId: PROVIDER_ID,
      groupLabel: "xAI (Grok)",
      groupHint: "API key or browser OAuth",
      methodId: XAI_OAUTH_METHOD_ID,
    },
    run: async (ctx) => {
      const { createXaiOAuthAuthMethod } = await import("./xai-oauth.js");
      return createXaiOAuthAuthMethod().run(ctx);
    },
  };
}

function buildXaiDeviceCodeMethod(): ProviderAuthMethod {
  return {
    id: XAI_DEVICE_CODE_METHOD_ID,
    label: "xAI device code",
    hint: "Remote-friendly browser sign-in without a localhost callback",
    kind: "device_code",
    wizard: {
      choiceId: "xai-device-code",
      choiceLabel: "xAI device code",
      choiceHint: "Remote-friendly browser sign-in without a localhost callback",
      groupId: PROVIDER_ID,
      groupLabel: "xAI (Grok)",
      groupHint: "API key or browser OAuth",
      methodId: XAI_DEVICE_CODE_METHOD_ID,
    },
    run: async (ctx) => {
      const { createXaiDeviceCodeAuthMethod } = await import("./xai-oauth.js");
      return createXaiDeviceCodeAuthMethod().run(ctx);
    },
  };
}

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "xAI Setup",
  description: "Lightweight xAI setup hooks",
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "xAI",
      aliases: ["x-ai"],
      docsPath: "/providers/xai",
      envVars: ["XAI_API_KEY"],
      auth: [buildXaiApiKeyMethod(), buildXaiOAuthMethod(), buildXaiDeviceCodeMethod()],
    });
    api.registerAutoEnableProbe(({ config }) => {
      const pluginConfig = config.plugins?.entries?.xai?.config;
      const web = config.tools?.web as Record<string, unknown> | undefined;
      if (
        isRecord(web?.x_search) ||
        (isRecord(pluginConfig) &&
          (isRecord(pluginConfig.xSearch) || isRecord(pluginConfig.codeExecution)))
      ) {
        return "xai tool configured";
      }
      return null;
    });
  },
});
