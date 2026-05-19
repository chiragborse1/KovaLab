import { resolveLivePluginConfigObject, type KovaConfig } from "getkova/plugin-sdk/config-runtime";
import { definePluginEntry } from "getkova/plugin-sdk/plugin-entry";
import { createCodexAppServerAgentHarness } from "./harness.js";
import { buildCodexMediaUnderstandingProvider } from "./media-understanding-provider.js";
import { buildCodexProvider } from "./provider.js";
import type { CodexPluginsConfigBlock } from "./src/command-plugins-management.js";
import { createCodexCommand } from "./src/commands.js";
import {
  handleCodexConversationBindingResolved,
  handleCodexConversationInboundClaim,
} from "./src/conversation-binding.js";

export default definePluginEntry({
  id: "codex",
  name: "Codex",
  description: "Codex app-server harness and Codex-managed GPT model catalog.",
  register(api) {
    const resolveCurrentPluginConfig = () =>
      resolveLivePluginConfigObject(
        api.runtime.config?.current ? () => api.runtime.config.current() as KovaConfig : undefined,
        "codex",
        api.pluginConfig as Record<string, unknown>,
      ) ?? api.pluginConfig;
    api.registerAgentHarness(createCodexAppServerAgentHarness({ pluginConfig: api.pluginConfig }));
    api.registerProvider(buildCodexProvider({ pluginConfig: api.pluginConfig }));
    api.registerMediaUnderstandingProvider(
      buildCodexMediaUnderstandingProvider({ pluginConfig: api.pluginConfig }),
    );
    api.registerCommand(
      createCodexCommand({
        pluginConfig: api.pluginConfig,
        deps: {
          codexPluginsManagementIo: {
            readConfig: async () => {
              const current = (api.runtime.config?.current?.() ?? {}) as KovaConfig;
              const plugins = (current as Record<string, unknown>).plugins;
              if (!plugins || typeof plugins !== "object") {
                return {};
              }
              const entries = (plugins as Record<string, unknown>).entries;
              if (!entries || typeof entries !== "object") {
                return {};
              }
              const codexEntry = (entries as Record<string, unknown>).codex;
              if (!codexEntry || typeof codexEntry !== "object") {
                return {};
              }
              const config = (codexEntry as Record<string, unknown>).config;
              if (!config || typeof config !== "object") {
                return {};
              }
              const codexPlugins = (config as Record<string, unknown>).codexPlugins;
              if (!codexPlugins || typeof codexPlugins !== "object") {
                return {};
              }
              const declared = (codexPlugins as Record<string, unknown>).plugins;
              return {
                enabled: (codexPlugins as Record<string, unknown>).enabled === true,
                ...(declared && typeof declared === "object"
                  ? { plugins: declared as Record<string, never> }
                  : {}),
              };
            },
            mutate: async (update) => {
              const mutateConfigFile = api.runtime.config?.mutateConfigFile;
              if (!mutateConfigFile) {
                throw new Error("runtime config mutation is unavailable");
              }
              await mutateConfigFile({
                afterWrite: { mode: "auto" },
                mutate: (draft) => {
                  const root = draft as Record<string, unknown>;
                  root.plugins = (root.plugins ?? {}) as Record<string, unknown>;
                  const pluginsBlock = root.plugins as Record<string, unknown>;
                  pluginsBlock.entries = (pluginsBlock.entries ?? {}) as Record<string, unknown>;
                  const entries = pluginsBlock.entries as Record<string, unknown>;
                  entries.codex = (entries.codex ?? {}) as Record<string, unknown>;
                  const codexEntry = entries.codex as Record<string, unknown>;
                  codexEntry.config = (codexEntry.config ?? {}) as Record<string, unknown>;
                  const config = codexEntry.config as Record<string, unknown>;
                  config.codexPlugins = (config.codexPlugins ?? {}) as Record<string, unknown>;
                  const codexPlugins = config.codexPlugins as Record<string, unknown>;
                  codexPlugins.plugins = (codexPlugins.plugins ?? {}) as Record<string, unknown>;
                  update(codexPlugins as CodexPluginsConfigBlock);
                },
              });
            },
          },
        },
      }),
    );
    api.on("inbound_claim", (event, ctx) =>
      handleCodexConversationInboundClaim(event, ctx, {
        pluginConfig: resolveCurrentPluginConfig(),
      }),
    );
    api.onConversationBindingResolved(handleCodexConversationBindingResolved);
  },
});
