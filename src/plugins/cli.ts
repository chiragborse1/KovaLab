import type { Command } from "commander";
import { getRuntimeConfig, readConfigFileSnapshot } from "../config/config.js";
import type { KovaConfig } from "../config/types.kova.js";
import {
  createPluginCliLogger,
  loadPluginCliDescriptors,
  loadPluginCliRegistrationEntriesWithDefaults,
  type PluginCliLoaderOptions,
} from "./cli-registry-loader.js";
import { registerPluginCliCommandGroups } from "./register-plugin-cli-command-groups.js";
import type { KovaPluginCliCommandDescriptor } from "./types.js";

type PluginCliRegistrationMode = "eager" | "lazy";

type RegisterPluginCliOptions = {
  mode?: PluginCliRegistrationMode;
  primary?: string | null;
};

const logger = createPluginCliLogger();

export const loadValidatedConfigForPluginRegistration = async (): Promise<KovaConfig | null> => {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    return null;
  }
  return getRuntimeConfig();
};

export async function getPluginCliCommandDescriptors(
  cfg?: KovaConfig,
  env?: NodeJS.ProcessEnv,
  loaderOptions?: PluginCliLoaderOptions,
): Promise<KovaPluginCliCommandDescriptor[]> {
  return loadPluginCliDescriptors({ cfg, env, loaderOptions });
}

export async function registerPluginCliCommands(
  program: Command,
  cfg?: KovaConfig,
  env?: NodeJS.ProcessEnv,
  loaderOptions?: PluginCliLoaderOptions,
  options?: RegisterPluginCliOptions,
) {
  const mode = options?.mode ?? "eager";
  const primary = options?.primary ?? undefined;

  await registerPluginCliCommandGroups(
    program,
    await loadPluginCliRegistrationEntriesWithDefaults({
      cfg,
      env,
      loaderOptions,
      primaryCommand: primary,
    }),
    {
      mode,
      primary,
      existingCommands: new Set(program.commands.map((cmd) => cmd.name())),
      logger,
    },
  );
}

export async function registerPluginCliCommandsFromValidatedConfig(
  program: Command,
  env?: NodeJS.ProcessEnv,
  loaderOptions?: PluginCliLoaderOptions,
  options?: RegisterPluginCliOptions,
): Promise<KovaConfig | null> {
  const config = await loadValidatedConfigForPluginRegistration();
  if (!config) {
    return null;
  }
  await registerPluginCliCommands(program, config, env, loaderOptions, options);
  return config;
}
