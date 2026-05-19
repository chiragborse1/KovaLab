// Public auth/onboarding helpers for provider plugins.

import { resolveKovaAgentDir } from "../agents/agent-paths.js";
import { resolveApiKeyForProfile } from "../agents/auth-profiles/oauth.js";
import { resolveAuthProfileOrder } from "../agents/auth-profiles/order.js";
import { listProfilesForProvider } from "../agents/auth-profiles/profiles.js";
import { ensureAuthProfileStore } from "../agents/auth-profiles/store.js";
import { resolveEnvApiKey } from "../agents/model-auth-env.js";
import type { KovaConfig } from "../config/config.js";

export type { KovaConfig } from "../config/config.js";
export type { SecretInput } from "../config/types.secrets.js";
export type { SecretInputMode } from "../plugins/provider-auth-types.js";
export type { ProviderAuthResult } from "../plugins/types.js";
export type { ProviderAuthContext } from "../plugins/types.js";
export type { AuthProfileStore, OAuthCredential } from "../agents/auth-profiles/types.js";

export { CLAUDE_CLI_PROFILE_ID, CODEX_CLI_PROFILE_ID } from "../agents/auth-profiles/constants.js";
export {
  ensureAuthProfileStore,
  ensureAuthProfileStoreForLocalUpdate,
  updateAuthProfileStoreWithLock,
} from "../agents/auth-profiles/store.js";
export {
  listProfilesForProvider,
  removeProviderAuthProfilesWithLock,
  upsertAuthProfile,
  upsertAuthProfileWithLock,
} from "../agents/auth-profiles/profiles.js";
export { resolveEnvApiKey } from "../agents/model-auth-env.js";
export { readClaudeCliCredentialsCached } from "../agents/cli-credentials.js";
export { suggestOAuthProfileIdForLegacyDefault } from "../agents/auth-profiles/repair.js";
export {
  CUSTOM_LOCAL_AUTH_MARKER,
  MINIMAX_OAUTH_MARKER,
  isKnownEnvApiKeyMarker,
  isNonSecretApiKeyMarker,
  resolveOAuthApiKeyMarker,
  resolveNonEnvSecretRefApiKeyMarker,
} from "../agents/model-auth-markers.js";
export {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
} from "../plugins/provider-auth-input.js";
export {
  ensureApiKeyFromEnvOrPrompt,
  ensureApiKeyFromOptionEnvOrPrompt,
  normalizeSecretInputModeInput,
  promptSecretRefForSetup,
  resolveSecretInputModeForEnvSelection,
} from "../plugins/provider-auth-input.js";
export { normalizeApiKeyConfig } from "../agents/models-config.providers.secrets.js";
export {
  buildTokenProfileId,
  validateAnthropicSetupToken,
} from "../plugins/provider-auth-token.js";
export {
  applyAuthProfileConfig,
  buildApiKeyCredential,
  upsertApiKeyProfile,
  writeOAuthCredentials,
  type ApiKeyStorageOptions,
  type WriteOAuthCredentialsOptions,
} from "../plugins/provider-auth-helpers.js";
export { createProviderApiKeyAuthMethod } from "../plugins/provider-api-key-auth.js";
export { coerceSecretRef, hasConfiguredSecretInput } from "../config/types.secrets.js";
export { resolveDefaultSecretProviderAlias } from "../secrets/ref-contract.js";
export { resolveRequiredHomeDir } from "../infra/home-dir.js";
export { resolveKovaAgentDir } from "../agents/agent-paths.js";
export {
  normalizeOptionalSecretInput,
  normalizeSecretInput,
} from "../utils/normalize-secret-input.js";
export {
  listKnownProviderAuthEnvVarNames,
  omitEnvKeysCaseInsensitive,
} from "../secrets/provider-env-vars.js";
export { buildOauthProviderAuthResult } from "./provider-auth-result.js";
export {
  generateHexPkceVerifierChallenge,
  generatePkceVerifierChallenge,
  toFormUrlEncoded,
} from "./oauth-utils.js";
export {
  DEFAULT_OAUTH_REFRESH_MARGIN_MS,
  hasUsableOAuthCredential,
} from "../agents/auth-profiles/credential-state.js";
export {
  COPILOT_EDITOR_PLUGIN_VERSION,
  COPILOT_EDITOR_VERSION,
  COPILOT_GITHUB_API_VERSION,
  COPILOT_INTEGRATION_ID,
  COPILOT_USER_AGENT,
  buildCopilotIdeHeaders,
} from "../agents/copilot-dynamic-headers.js";

export function isProviderApiKeyConfigured(params: {
  provider: string;
  agentDir?: string;
}): boolean {
  if (resolveEnvApiKey(params.provider)?.apiKey) {
    return true;
  }
  const agentDir = params.agentDir?.trim();
  if (!agentDir) {
    return false;
  }
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false,
  });
  return listProfilesForProvider(store, params.provider).length > 0;
}

export function listUsableProviderAuthProfileIds(params: {
  provider: string;
  cfg?: KovaConfig;
  agentDir?: string;
}): { agentDir: string; profileIds: string[] } {
  try {
    const agentDir = params.agentDir?.trim() || resolveKovaAgentDir();
    const store = ensureAuthProfileStore(agentDir, {
      allowKeychainPrompt: false,
    });
    return {
      agentDir,
      profileIds: resolveAuthProfileOrder({
        cfg: params.cfg,
        store,
        provider: params.provider,
      }),
    };
  } catch {
    return { agentDir: "", profileIds: [] };
  }
}

export function isProviderAuthProfileConfigured(params: {
  provider: string;
  cfg?: KovaConfig;
  agentDir?: string;
}): boolean {
  return listUsableProviderAuthProfileIds(params).profileIds.length > 0;
}

export async function resolveProviderAuthProfileApiKey(params: {
  provider: string;
  cfg?: KovaConfig;
  agentDir?: string;
}): Promise<string | undefined> {
  const { agentDir, profileIds } = listUsableProviderAuthProfileIds(params);
  if (!agentDir || profileIds.length === 0) {
    return undefined;
  }
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false,
  });
  for (const profileId of profileIds) {
    const resolved = await resolveApiKeyForProfile({
      cfg: params.cfg,
      store,
      agentDir,
      profileId,
    });
    if (resolved?.apiKey) {
      return resolved.apiKey;
    }
  }
  return undefined;
}
