import type { KovaConfig } from "../../../config/types.kova.js";
import { resolveUserPath } from "../../../utils.js";
import type { OnboardOptions } from "../../onboard-types.js";

export function resolveNonInteractiveWorkspaceDir(params: {
  opts: OnboardOptions;
  baseConfig: KovaConfig;
  defaultWorkspaceDir: string;
  legacyDefaultWorkspaceDir?: string;
}) {
  const configured = params.baseConfig.agents?.defaults?.workspace?.trim();
  const configuredIsLegacyDefault =
    configured &&
    params.legacyDefaultWorkspaceDir &&
    resolveUserPath(configured) === resolveUserPath(params.legacyDefaultWorkspaceDir);
  const raw = (
    params.opts.workspace ??
    (configured && !configuredIsLegacyDefault ? configured : undefined) ??
    params.defaultWorkspaceDir
  ).trim();
  return resolveUserPath(raw);
}
