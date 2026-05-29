import { definePluginEntry } from "getkova/plugin-sdk/plugin-entry";
import type { ProviderAuthMethod } from "getkova/plugin-sdk/plugin-entry";

const PROVIDER_ID = "openrouter";
const OPENROUTER_DEFAULT_MODEL_REF = "openrouter/auto";

function buildOpenRouterApiKeyMethod(): ProviderAuthMethod {
  return {
    id: "api-key",
    label: "OpenRouter API key",
    hint: "API key",
    kind: "api_key",
    wizard: {
      choiceId: "openrouter-api-key",
      choiceLabel: "OpenRouter API key",
      groupId: PROVIDER_ID,
      groupLabel: "OpenRouter",
      groupHint: "API key",
    },
    run: async (ctx) => {
      const { createProviderApiKeyAuthMethod } =
        await import("getkova/plugin-sdk/provider-auth-api-key");
      const { applyOpenrouterConfig } = await import("./onboard.js");
      return createProviderApiKeyAuthMethod({
        providerId: PROVIDER_ID,
        methodId: "api-key",
        label: "OpenRouter API key",
        hint: "API key",
        optionKey: "openrouterApiKey",
        flagName: "--openrouter-api-key",
        envVar: "OPENROUTER_API_KEY",
        promptMessage: "Enter OpenRouter API key",
        defaultModel: OPENROUTER_DEFAULT_MODEL_REF,
        expectedProviders: [PROVIDER_ID],
        applyConfig: (cfg) => applyOpenrouterConfig(cfg),
      }).run(ctx);
    },
    runNonInteractive: async (ctx) => {
      const { createProviderApiKeyAuthMethod } =
        await import("getkova/plugin-sdk/provider-auth-api-key");
      const { applyOpenrouterConfig } = await import("./onboard.js");
      return (
        (await createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "OpenRouter API key",
          hint: "API key",
          optionKey: "openrouterApiKey",
          flagName: "--openrouter-api-key",
          envVar: "OPENROUTER_API_KEY",
          promptMessage: "Enter OpenRouter API key",
          defaultModel: OPENROUTER_DEFAULT_MODEL_REF,
          expectedProviders: [PROVIDER_ID],
          applyConfig: (cfg) => applyOpenrouterConfig(cfg),
        }).runNonInteractive?.(ctx)) ?? null
      );
    },
  };
}

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "OpenRouter Setup",
  description: "Lightweight OpenRouter setup hooks",
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "OpenRouter",
      docsPath: "/providers/models",
      envVars: ["OPENROUTER_API_KEY"],
      auth: [buildOpenRouterApiKeyMethod()],
    });
  },
});
