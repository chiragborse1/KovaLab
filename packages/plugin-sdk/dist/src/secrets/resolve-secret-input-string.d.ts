import type { KovaConfig } from "../config/types.kova.js";
import { type SecretRef } from "../config/types.secrets.js";
type SecretDefaults = NonNullable<KovaConfig["secrets"]>["defaults"];
export declare function resolveSecretInputString(params: {
    config: KovaConfig;
    value: unknown;
    env: NodeJS.ProcessEnv;
    defaults?: SecretDefaults;
    normalize?: (value: unknown) => string | undefined;
    onResolveRefError?: (error: unknown, ref: SecretRef) => never;
}): Promise<string | undefined>;
export {};
