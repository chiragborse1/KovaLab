import path from "node:path";
import { resolveIsNixMode } from "../config/paths.js";
import { safeRealpathSync } from "./path-safety.js";
import type { PluginOrigin } from "./plugin-origin.types.js";

const NIX_STORE_ROOT = "/nix/store";

// External plugin hardlinks are rejected by default because they can share an
// inode with code outside the plugin root. Nix store outputs are immutable, so
// hardlinks there are package layout rather than user mutation.
export function isNixStorePluginRoot(
  rootDir: string,
  realpathCache?: Map<string, string>,
): boolean {
  const rootRealPath = safeRealpathSync(rootDir, realpathCache) ?? path.resolve(rootDir);
  return rootRealPath === NIX_STORE_ROOT || rootRealPath.startsWith(`${NIX_STORE_ROOT}/`);
}

export function shouldRejectHardlinkedPluginFiles(params: {
  origin: PluginOrigin;
  rootDir: string;
  env?: NodeJS.ProcessEnv;
  realpathCache?: Map<string, string>;
}): boolean {
  if (params.origin === "bundled") {
    return false;
  }
  if (resolveIsNixMode(params.env) && isNixStorePluginRoot(params.rootDir, params.realpathCache)) {
    return false;
  }
  return true;
}
