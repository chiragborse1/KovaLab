import type { KovaConfig } from "../../config/types.kova.js";
import { normalizeEmbeddedAgentRuntime } from "../pi-embedded-runner/runtime.js";
import { resolveProviderIdForAuth } from "../provider-auth-aliases.js";
import type { AgentRuntimeAuthPlan } from "./types.js";

const CODEX_HARNESS_AUTH_PROVIDER = "openai-codex";

function resolveHarnessAuthProvider(params: {
  harnessId?: string;
  harnessRuntime?: string;
}): string | undefined {
  const harnessId = normalizeEmbeddedAgentRuntime(params.harnessId);
  const runtime = normalizeEmbeddedAgentRuntime(params.harnessRuntime);
  return harnessId === "codex" || runtime === "codex" ? CODEX_HARNESS_AUTH_PROVIDER : undefined;
}

export function buildAgentRuntimeAuthPlan(params: {
  provider: string;
  authProfileProvider?: string;
  authProfileMode?: string;
  sessionAuthProfileId?: string;
  config?: KovaConfig;
  workspaceDir?: string;
  harnessId?: string;
  harnessRuntime?: string;
  allowHarnessAuthProfileForwarding?: boolean;
}): AgentRuntimeAuthPlan {
  const aliasLookupParams = {
    config: params.config,
    workspaceDir: params.workspaceDir,
  };
  const providerForAuth = resolveProviderIdForAuth(params.provider, aliasLookupParams);
  const authProfileProviderForAuth = resolveProviderIdForAuth(
    params.authProfileProvider ?? params.provider,
    aliasLookupParams,
  );
  const harnessAuthProvider = resolveHarnessAuthProvider(params);
  const harnessProviderForAuth = harnessAuthProvider
    ? resolveProviderIdForAuth(harnessAuthProvider, aliasLookupParams)
    : undefined;
  const harnessCanForwardProfile =
    params.allowHarnessAuthProfileForwarding !== false &&
    harnessProviderForAuth &&
    (harnessProviderForAuth === authProfileProviderForAuth ||
      (harnessProviderForAuth === CODEX_HARNESS_AUTH_PROVIDER &&
        authProfileProviderForAuth === "openai" &&
        params.authProfileMode === "api_key"));
  const canForwardProfile =
    providerForAuth === authProfileProviderForAuth || harnessCanForwardProfile;

  return {
    providerForAuth,
    authProfileProviderForAuth,
    ...(harnessProviderForAuth ? { harnessAuthProvider: harnessProviderForAuth } : {}),
    ...(canForwardProfile ? { forwardedAuthProfileId: params.sessionAuthProfileId } : {}),
  };
}
