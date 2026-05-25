import type { HookInstallRecord } from "../config/types.hooks.js";
import type { PluginInstallRecord } from "../config/types.plugins.js";
export declare function resolvePluginUpdateSelection(params: {
    installs: Record<string, PluginInstallRecord>;
    rawId?: string;
    all?: boolean;
}): {
    pluginIds: string[];
    specOverrides?: Record<string, string>;
};
export declare function resolveHookPackUpdateSelection(params: {
    installs: Record<string, HookInstallRecord>;
    rawId?: string;
    all?: boolean;
}): {
    hookIds: string[];
    specOverrides?: Record<string, string>;
};
