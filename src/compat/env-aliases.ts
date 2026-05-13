function getAliasKey(key: string): string | null {
  if (key.startsWith("KOVA_")) {
    return `OPENCLAW_${key.slice("KOVA_".length)}`;
  }
  return null;
}

function getLegacyAliasKey(key: string): string | null {
  if (key.startsWith("OPENCLAW_")) {
    return `KOVA_${key.slice("OPENCLAW_".length)}`;
  }
  return null;
}

function allowOpenClawCompat(env: Record<string, string | undefined>): boolean {
  const value = (env.KOVA_ALLOW_OPENCLAW_COMPAT ?? env.KOVA_OPENCLAW_COMPAT)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function applyKovaEnvAliases(
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const entries = Object.entries(env);
  const legacyCompat = allowOpenClawCompat(env);

  for (const [key, value] of entries) {
    if (value === undefined) {
      continue;
    }
    const aliasKey = getAliasKey(key) ?? (legacyCompat ? getLegacyAliasKey(key) : null);
    if (!aliasKey || env[aliasKey] !== undefined) {
      continue;
    }
    env[aliasKey] = value;
  }

  return env;
}
