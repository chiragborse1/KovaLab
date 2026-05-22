import { isDeepStrictEqual } from "node:util";
import type { KovaConfig } from "../../../config/types.kova.js";
import { applyLegacyDoctorMigrations } from "./legacy-config-compat.js";
import { normalizeRuntimeCompatibilityConfigValues } from "./legacy-config-runtime-migrate.js";

export function applyRuntimeLegacyConfigMigrations(
  raw: unknown,
  options: { pluginFallback?: "full" | "skip" } = {},
): {
  next: Record<string, unknown> | null;
  changes: string[];
} {
  if (!raw || typeof raw !== "object") {
    return { next: null, changes: [] };
  }

  const original = raw as Record<string, unknown>;
  const migrated = applyLegacyDoctorMigrations(original, {
    pluginFallback: options.pluginFallback,
  });
  const base = (migrated.next ?? original) as KovaConfig;
  const normalized = normalizeRuntimeCompatibilityConfigValues(base);
  const next = normalized.config as KovaConfig & Record<string, unknown>;
  const changes = [...migrated.changes, ...normalized.changes];

  if (changes.length === 0 || isDeepStrictEqual(next, original)) {
    return { next: null, changes: [] };
  }
  return { next, changes };
}
