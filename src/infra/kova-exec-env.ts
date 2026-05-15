export const KOVA_CLI_ENV_VAR = "KOVA_CLI";
export const KOVA_CLI_ENV_VALUE = "1";

export function markKovaExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [KOVA_CLI_ENV_VAR]: KOVA_CLI_ENV_VALUE,
  };
}

export function ensureKovaExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[KOVA_CLI_ENV_VAR] = KOVA_CLI_ENV_VALUE;
  return env;
}
