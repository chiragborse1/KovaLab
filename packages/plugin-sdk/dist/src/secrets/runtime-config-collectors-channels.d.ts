import type { KovaConfig } from "../config/types.kova.js";
import { type ResolverContext, type SecretDefaults } from "./runtime-shared.js";
export declare function collectChannelConfigAssignments(params: {
    config: KovaConfig;
    defaults: SecretDefaults | undefined;
    context: ResolverContext;
}): void;
