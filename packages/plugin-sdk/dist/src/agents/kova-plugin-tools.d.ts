import type { KovaConfig } from "../config/types.kova.js";
import { type AuthProfileStore } from "./auth-profiles.js";
import { type KovaPluginToolOptions } from "./kova-tools.plugin-context.js";
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
    authProfileStore?: AuthProfileStore;
};
export declare function resolveKovaPluginToolsForOptions(params: {
    options?: ResolveKovaPluginToolsOptions;
    resolvedConfig?: KovaConfig;
    existingToolNames?: Set<string>;
}): AnyAgentTool[];
export {};
