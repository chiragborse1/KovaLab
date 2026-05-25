import type { KovaConfig } from "../config/types.kova.js";
import type { SecretDefaults } from "./models-config.providers.secret-helpers.js";
type ModelsConfig = NonNullable<KovaConfig["models"]>;
export declare function normalizeProviders(params: {
    providers: ModelsConfig["providers"];
    agentDir: string;
    env?: NodeJS.ProcessEnv;
    secretDefaults?: SecretDefaults;
    sourceProviders?: ModelsConfig["providers"];
    sourceSecretDefaults?: SecretDefaults;
    secretRefManagedProviders?: Set<string>;
}): ModelsConfig["providers"];
export {};
