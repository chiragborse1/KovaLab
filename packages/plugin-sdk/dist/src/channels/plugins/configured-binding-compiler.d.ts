import type { KovaConfig } from "../../config/types.kova.js";
import type { CompiledConfiguredBinding, ConfiguredBindingChannel } from "./binding-types.js";
export type CompiledConfiguredBindingRegistry = {
    rulesByChannel: Map<ConfiguredBindingChannel, CompiledConfiguredBinding[]>;
};
export declare function resolveCompiledBindingRegistry(cfg: KovaConfig): CompiledConfiguredBindingRegistry;
export declare function primeCompiledBindingRegistry(cfg: KovaConfig): CompiledConfiguredBindingRegistry;
export declare function countCompiledBindingRegistry(registry: CompiledConfiguredBindingRegistry): {
    bindingCount: number;
    channelCount: number;
};
