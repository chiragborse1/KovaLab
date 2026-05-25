export declare const KOVA_CLI_ENV_VAR = "KOVA_CLI";
export declare const KOVA_CLI_ENV_VALUE = "1";
export declare function markKovaExecEnv<T extends Record<string, string | undefined>>(env: T): T;
export declare function ensureKovaExecMarkerOnProcess(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
