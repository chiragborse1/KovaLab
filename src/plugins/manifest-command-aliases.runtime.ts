import type { KovaConfig } from "../config/types.kova.js";
import {
  resolveManifestCommandAliasOwnerInRegistry,
  type PluginManifestCommandAliasRegistry,
  type PluginManifestCommandAliasRecord,
} from "./manifest-command-aliases.js";
import { loadPluginManifestRegistryForPluginRegistry } from "./plugin-registry.js";

export function resolveManifestCommandAliasOwner(params: {
  command: string | undefined;
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  registry?: PluginManifestCommandAliasRegistry;
}): PluginManifestCommandAliasRecord | undefined {
  const registry =
    params.registry ??
    loadPluginManifestRegistryForPluginRegistry({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
      includeDisabled: true,
    });
  return resolveManifestCommandAliasOwnerInRegistry({
    command: params.command,
    registry,
  });
}
