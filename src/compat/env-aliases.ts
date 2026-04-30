function getAliasKey(key: string): string | null {
  if (key.startsWith("KOVA_")) {
    return `OPENCLAW_${key.slice("KOVA_".length)}`;
  }
  if (key.startsWith("OPENCLAW_")) {
    return `KOVA_${key.slice("OPENCLAW_".length)}`;
  }
  return null;
}

export function applyKovaEnvAliases(
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const entries = Object.entries(env);

  for (const [key, value] of entries) {
    if (value === undefined) {
      continue;
    }
    const aliasKey = getAliasKey(key);
    if (!aliasKey || env[aliasKey] !== undefined) {
      continue;
    }
    env[aliasKey] = value;
  }

  return env;
}
