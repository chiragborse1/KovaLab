import { definePluginEntry } from "getkova/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "getkova/plugin-sdk/provider-auth-api-key";
import type { ProviderPlugin } from "getkova/plugin-sdk/provider-model-shared";
import { buildGoogleGeminiCliBackend } from "./cli-backend.js";
import { buildGoogleGeminiCliProvider } from "./gemini-cli-provider.js";
import { GOOGLE_GEMINI_DEFAULT_MODEL, applyGoogleGeminiModelDefault } from "./onboard.js";

function buildGoogleSetupProvider(): ProviderPlugin {
  return {
    id: "google",
    label: "Google AI Studio",
    docsPath: "/providers/models",
    hookAliases: ["google-antigravity", "google-vertex"],
    envVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    auth: [
      createProviderApiKeyAuthMethod({
        providerId: "google",
        methodId: "api-key",
        label: "Google Gemini API key",
        hint: "AI Studio / Gemini API key",
        optionKey: "geminiApiKey",
        flagName: "--gemini-api-key",
        envVar: "GEMINI_API_KEY",
        promptMessage: "Enter Gemini API key",
        defaultModel: GOOGLE_GEMINI_DEFAULT_MODEL,
        expectedProviders: ["google"],
        applyConfig: (cfg) => applyGoogleGeminiModelDefault(cfg).next,
        wizard: {
          choiceId: "gemini-api-key",
          choiceLabel: "Google Gemini API key",
          groupId: "google",
          groupLabel: "Google",
          groupHint: "Gemini API key + OAuth",
        },
      }),
    ],
  };
}

export default definePluginEntry({
  id: "google",
  name: "Google Setup",
  description: "Lightweight Google setup hooks",
  register(api) {
    api.registerCliBackend(buildGoogleGeminiCliBackend());
    api.registerProvider(buildGoogleSetupProvider());
    api.registerProvider(buildGoogleGeminiCliProvider());
  },
});
