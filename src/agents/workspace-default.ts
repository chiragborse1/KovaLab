import os from "node:os";
import path from "node:path";
import { resolveRequiredHomeDir } from "../infra/home-dir.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";

export function resolveDefaultAgentWorkspaceDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return resolveAgentWorkspaceDirForStateDir(".kova", env, homedir);
}

export function resolveLegacyDefaultAgentWorkspaceDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return resolveAgentWorkspaceDirForStateDir(".kova", env, homedir);
}

function resolveAgentWorkspaceDirForStateDir(
  stateDirName: ".kova",
  env: NodeJS.ProcessEnv,
  homedir: () => string,
): string {
  const home = resolveRequiredHomeDir(env, homedir);
  const profile = env.KOVA_PROFILE?.trim();
  if (profile && normalizeOptionalLowercaseString(profile) !== "default") {
    return path.join(home, stateDirName, `workspace-${profile}`);
  }
  return path.join(home, stateDirName, "workspace");
}

export const DEFAULT_AGENT_WORKSPACE_DIR = resolveDefaultAgentWorkspaceDir();
