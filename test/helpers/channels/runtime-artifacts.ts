import {
  loadBundledPluginPublicSurface,
  resolveRelativeBundledPluginPublicModuleId,
} from "../../../src/test-utils/bundled-plugin-public-surface.js";

const CURRENT_MODULE_URL = import.meta.url;

export function resolveBundledChannelContractArtifactUrl(
  pluginId: string,
  entryBaseName: string,
): string {
  const normalizedEntryBaseName = entryBaseName.replace(/\.(?:[cm]?js|ts)$/u, "");
  return new URL(
    resolveRelativeBundledPluginPublicModuleId({
      fromModuleUrl: CURRENT_MODULE_URL,
      pluginId,
      artifactBasename: `${normalizedEntryBaseName}.js`,
    }),
    CURRENT_MODULE_URL,
  ).href;
}

export async function importBundledChannelContractArtifact<T extends object>(
  pluginId: string,
  entryBaseName: string,
): Promise<T> {
  const normalizedEntryBaseName = entryBaseName.replace(/\.(?:[cm]?js|ts)$/u, "");
  return await loadBundledPluginPublicSurface<T>({
    pluginId,
    artifactBasename: `${normalizedEntryBaseName}.js`,
  });
}
