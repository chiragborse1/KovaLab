import type { KovaConfig } from "../config/types.kova.js";
import { type ResolverContext, type SecretDefaults } from "./runtime-shared.js";
export declare function collectCoreConfigAssignments(params: {
    config: KovaConfig;
    defaults: SecretDefaults | undefined;
    context: ResolverContext;
}): void;
