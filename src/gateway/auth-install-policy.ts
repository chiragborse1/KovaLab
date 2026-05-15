import { collectDurableServiceEnvVars } from "../config/state-dir-dotenv.js";
import type { KovaConfig } from "../config/types.kova.js";
import { hasConfiguredSecretInput } from "../config/types.secrets.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";

type GatewayInstallAuthMode = NonNullable<NonNullable<KovaConfig["gateway"]>["auth"]>["mode"];

function hasExplicitGatewayInstallAuthMode(
  mode: GatewayInstallAuthMode | undefined,
): boolean | undefined {
  if (mode === "token") {
    return true;
  }
  if (mode === "password" || mode === "none" || mode === "trusted-proxy") {
    return false;
  }
  return undefined;
}

function hasConfiguredGatewayPasswordForInstall(cfg: KovaConfig): boolean {
  return hasConfiguredSecretInput(cfg.gateway?.auth?.password, cfg.secrets?.defaults);
}

function hasDurableGatewayPasswordEnvForInstall(cfg: KovaConfig, env: NodeJS.ProcessEnv): boolean {
  const durableServiceEnv = collectDurableServiceEnvVars({ env, config: cfg });
  return Boolean(
    normalizeOptionalString(durableServiceEnv.KOVA_GATEWAY_PASSWORD) ||
    normalizeOptionalString(durableServiceEnv.KOVA_GATEWAY_PASSWORD) ||
    normalizeOptionalString(durableServiceEnv.KOVA_GATEWAY_PASSWORD),
  );
}

export function shouldRequireGatewayTokenForInstall(
  cfg: KovaConfig,
  env: NodeJS.ProcessEnv,
): boolean {
  const explicitModeDecision = hasExplicitGatewayInstallAuthMode(cfg.gateway?.auth?.mode);
  if (explicitModeDecision !== undefined) {
    return explicitModeDecision;
  }

  if (hasConfiguredGatewayPasswordForInstall(cfg)) {
    return false;
  }

  // Service install should only infer password mode from durable sources that
  // survive outside the invoking shell.
  if (hasDurableGatewayPasswordEnvForInstall(cfg, env)) {
    return false;
  }

  return true;
}
