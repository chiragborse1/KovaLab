import type { KovaConfig } from "../config/types.kova.js";
import type { PluginOrigin } from "../plugins/plugin-origin.types.js";
import type { ResolverContext } from "./runtime-shared.js";
export declare function collectConfigAssignments(params: {
    config: KovaConfig;
    context: ResolverContext;
    loadablePluginOrigins?: ReadonlyMap<string, PluginOrigin>;
}): void;
