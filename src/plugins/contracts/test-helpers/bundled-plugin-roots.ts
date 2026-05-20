import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPluginManifestRegistry } from "../../manifest-registry.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const BUNDLED_PLUGIN_ROOT_DIR = "extensions";

const bundledPluginRoots = new Map(
  loadPluginManifestRegistry({ cache: true, config: {} })
    .plugins.filter((plugin) => plugin.origin === "bundled")
    .map((plugin) => [plugin.id, plugin.rootDir] as const),
);

export function getBundledPluginRoots(): ReadonlyMap<string, string> {
  return bundledPluginRoots;
}

export function resolveBundledPluginFile(params: {
  pluginId: string;
  relativePath: string;
}): string {
  const pluginRootDir = bundledPluginRoots.get(params.pluginId);
  if (!pluginRootDir) {
    const sourceRootDir = resolve(REPO_ROOT, BUNDLED_PLUGIN_ROOT_DIR, params.pluginId);
    if (existsSync(sourceRootDir)) {
      return resolve(sourceRootDir, params.relativePath);
    }
    throw new Error(`missing bundled plugin root for ${params.pluginId}`);
  }
  return resolve(pluginRootDir, params.relativePath);
}

export function bundledPluginFile(params: {
  rootDir: string;
  pluginId: string;
  relativePath: string;
}): string {
  return relative(resolve(params.rootDir, ".."), resolveBundledPluginFile(params)).replaceAll(
    "\\",
    "/",
  );
}
