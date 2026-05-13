import { normalizeOptionalString } from "../shared/string-coerce.js";

export function resolveDaemonContainerContext(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return (
    normalizeOptionalString(env.KOVA_CONTAINER_HINT) ||
    normalizeOptionalString(env.KOVA_CONTAINER) ||
    normalizeOptionalString(env.OPENCLAW_CONTAINER_HINT) ||
    normalizeOptionalString(env.OPENCLAW_CONTAINER) ||
    null
  );
}
