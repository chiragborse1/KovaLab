import { selectApplicableRuntimeConfig } from "../config/config.js";
import type { KovaConfig } from "../config/types.kova.js";
import { resolvePluginTools } from "../plugins/tools.js";
import { getActiveSecretsRuntimeSnapshot } from "../secrets/runtime.js";
import { normalizeDeliveryContext } from "../utils/delivery-context.js";
import {
  resolveKovaPluginToolInputs,
  type KovaPluginToolOptions,
} from "./kova-tools.plugin-context.js";
import { applyPluginToolDeliveryDefaults } from "./plugin-tool-delivery-defaults.js";
import type { AnyAgentTool } from "./tools/common.js";

type ResolveKovaPluginToolsOptions = KovaPluginToolOptions & {
  pluginToolAllowlist?: string[];
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
  const pluginTools = resolvePluginTools({
    ...resolveKovaPluginToolInputs({
      options: params.options,
      resolvedConfig: params.resolvedConfig,
      runtimeConfig: resolveCurrentRuntimeConfig(),
      getRuntimeConfig: resolveCurrentRuntimeConfig,
    }),
    existingToolNames: params.existingToolNames ?? new Set<string>(),
    toolAllowlist: params.options?.pluginToolAllowlist,
    allowGatewaySubagentBinding: params.options?.allowGatewaySubagentBinding,
  });

  return applyPluginToolDeliveryDefaults({
    tools: pluginTools,
    deliveryContext,
  });
}
