import { selectApplicableRuntimeConfig } from "../config/config.js";
import type { KovaConfig } from "../config/types.kova.js";
import { resolvePluginTools } from "../plugins/tools.js";
import { getActiveSecretsRuntimeSnapshot } from "../secrets/runtime.js";
import { normalizeDeliveryContext } from "../utils/delivery-context.js";
import {
  resolveApiKeyForProfile,
  resolveAuthProfileOrder,
  type AuthProfileStore,
} from "./auth-profiles.js";
import {
  resolveKovaPluginToolInputs,
  type KovaPluginToolOptions,
} from "./kova-tools.plugin-context.js";
import { applyPluginToolDeliveryDefaults } from "./plugin-tool-delivery-defaults.js";
import type { AnyAgentTool } from "./tools/common.js";

type ResolveKovaPluginToolsOptions = KovaPluginToolOptions & {
  pluginToolAllowlist?: string[];
  pluginToolDenylist?: string[];
  currentChannelId?: string;
  currentThreadTs?: string;
  currentMessageId?: string | number;
  sandboxRoot?: string;
  modelHasVision?: boolean;
  modelProvider?: string;
  allowMediaInvokeCommands?: boolean;
  requesterAgentIdOverride?: string;
  requireExplicitMessageTarget?: boolean;
  disableMessageTool?: boolean;
  disablePluginTools?: boolean;
  authProfileStore?: AuthProfileStore;
};

export function resolveKovaPluginToolsForOptions(params: {
  options?: ResolveKovaPluginToolsOptions;
  resolvedConfig?: KovaConfig;
  existingToolNames?: Set<string>;
}): AnyAgentTool[] {
  if (params.options?.disablePluginTools) {
    return [];
  }

  const deliveryContext = normalizeDeliveryContext({
    channel: params.options?.agentChannel,
    to: params.options?.agentTo,
    accountId: params.options?.agentAccountId,
    threadId: params.options?.agentThreadId,
  });

  const resolveCurrentRuntimeConfig = () => {
    const currentRuntimeSnapshot = getActiveSecretsRuntimeSnapshot();
    return selectApplicableRuntimeConfig({
      inputConfig: params.resolvedConfig ?? params.options?.config,
      runtimeConfig: currentRuntimeSnapshot?.config,
      runtimeSourceConfig: currentRuntimeSnapshot?.sourceConfig,
    });
  };
  const authProfileStore = params.options?.authProfileStore;
  const resolveAuthProfileIdsForProvider = authProfileStore
    ? (providerId: string): string[] =>
        resolveAuthProfileOrder({
          cfg: resolveCurrentRuntimeConfig(),
          store: authProfileStore,
          provider: providerId,
        })
    : undefined;
  const hasAuthForProvider = authProfileStore
    ? (providerId: string) => (resolveAuthProfileIdsForProvider?.(providerId) ?? []).length > 0
    : undefined;
  const resolveApiKeyForProvider = authProfileStore
    ? async (providerId: string): Promise<string | undefined> => {
        for (const profileId of resolveAuthProfileIdsForProvider?.(providerId) ?? []) {
          const resolved = await resolveApiKeyForProfile({
            cfg: resolveCurrentRuntimeConfig(),
            store: authProfileStore,
            profileId,
            agentDir: params.options?.agentDir,
          });
          if (resolved?.apiKey) {
            return resolved.apiKey;
          }
        }
        return undefined;
      }
    : undefined;
  const pluginToolInputs = resolveKovaPluginToolInputs({
    options: params.options,
    resolvedConfig: params.resolvedConfig,
    runtimeConfig: resolveCurrentRuntimeConfig(),
    getRuntimeConfig: resolveCurrentRuntimeConfig,
  });
  const pluginTools = resolvePluginTools({
    ...pluginToolInputs,
    context: {
      ...pluginToolInputs.context,
      ...(hasAuthForProvider ? { hasAuthForProvider } : {}),
      ...(resolveApiKeyForProvider ? { resolveApiKeyForProvider } : {}),
    },
    existingToolNames: params.existingToolNames ?? new Set<string>(),
    toolAllowlist: params.options?.pluginToolAllowlist,
    toolDenylist: params.options?.pluginToolDenylist,
    allowGatewaySubagentBinding: params.options?.allowGatewaySubagentBinding,
  });

  return applyPluginToolDeliveryDefaults({
    tools: pluginTools,
    deliveryContext,
  });
}
