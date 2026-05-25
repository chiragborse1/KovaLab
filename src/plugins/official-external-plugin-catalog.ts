import officialExternalChannelCatalog from "../../scripts/lib/official-external-channel-catalog.json" with { type: "json" };
import officialExternalPluginCatalog from "../../scripts/lib/official-external-plugin-catalog.json" with { type: "json" };
import { MANIFEST_KEY } from "../compat/legacy-names.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";
import type { PluginPackageInstall } from "./manifest.js";

type ManifestKey = typeof MANIFEST_KEY;

export type OfficialExternalPluginCatalogManifest = {
  plugin?: {
    id?: string;
    label?: string;
  };
  channel?: {
    id?: string;
    label?: string;
  };
  install?: PluginPackageInstall;
};

export type OfficialExternalPluginCatalogEntry = {
  name?: string;
  version?: string;
  description?: string;
  source?: string;
  kind?: string;
} & Partial<Record<ManifestKey, OfficialExternalPluginCatalogManifest>>;

const OFFICIAL_CATALOG_SOURCES = [
  officialExternalChannelCatalog,
  officialExternalPluginCatalog,
] as const;

function parseCatalogEntries(raw: unknown): OfficialExternalPluginCatalogEntry[] {
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is OfficialExternalPluginCatalogEntry => isRecord(entry));
  }
  if (!isRecord(raw)) {
    return [];
  }
  const list = raw.entries ?? raw.packages ?? raw.plugins;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((entry): entry is OfficialExternalPluginCatalogEntry => isRecord(entry));
}

function normalizeDefaultChoice(value: unknown): PluginPackageInstall["defaultChoice"] | undefined {
  return value === "npm" || value === "local" ? value : undefined;
}

export function getOfficialExternalPluginCatalogManifest(
  entry: OfficialExternalPluginCatalogEntry,
): OfficialExternalPluginCatalogManifest | undefined {
  const manifest = entry[MANIFEST_KEY];
  return isRecord(manifest) ? manifest : undefined;
}

export function resolveOfficialExternalPluginId(
  entry: OfficialExternalPluginCatalogEntry,
): string | undefined {
  const manifest = getOfficialExternalPluginCatalogManifest(entry);
  return (
    normalizeOptionalString(manifest?.plugin?.id) ?? normalizeOptionalString(manifest?.channel?.id)
  );
}

function resolveOfficialExternalPluginLookupIds(
  entry: OfficialExternalPluginCatalogEntry,
): string[] {
  const manifest = getOfficialExternalPluginCatalogManifest(entry);
  return [
    normalizeOptionalString(manifest?.plugin?.id),
    normalizeOptionalString(manifest?.channel?.id),
    normalizeOptionalString(entry.name),
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
}

export function resolveOfficialExternalPluginInstall(
  entry: OfficialExternalPluginCatalogEntry,
): PluginPackageInstall | null {
  const manifest = getOfficialExternalPluginCatalogManifest(entry);
  const install = manifest?.install;
  const npmSpec = normalizeOptionalString(install?.npmSpec) ?? normalizeOptionalString(entry.name);
  const localPath = normalizeOptionalString(install?.localPath);
  if (!npmSpec && !localPath) {
    return null;
  }
  const defaultChoice =
    normalizeDefaultChoice(install?.defaultChoice) ??
    (npmSpec ? "npm" : localPath ? "local" : undefined);
  return {
    ...(npmSpec ? { npmSpec } : {}),
    ...(localPath ? { localPath } : {}),
    ...(defaultChoice ? { defaultChoice } : {}),
    ...(install?.minHostVersion ? { minHostVersion: install.minHostVersion } : {}),
    ...(install?.expectedIntegrity ? { expectedIntegrity: install.expectedIntegrity } : {}),
    ...(install?.allowInvalidConfigRecovery === true ? { allowInvalidConfigRecovery: true } : {}),
  };
}

export function listOfficialExternalPluginCatalogEntries(): OfficialExternalPluginCatalogEntry[] {
  const resolved = new Map<string, OfficialExternalPluginCatalogEntry>();
  for (const entry of OFFICIAL_CATALOG_SOURCES.flatMap((source) => parseCatalogEntries(source))) {
    const pluginId = resolveOfficialExternalPluginId(entry);
    const key = pluginId ? `${entry.kind ?? "plugin"}:${pluginId}` : (entry.name ?? "");
    if (key && !resolved.has(key)) {
      resolved.set(key, entry);
    }
  }
  return [...resolved.values()];
}

export function getOfficialExternalPluginCatalogEntry(
  pluginIdOrPackage: string,
): OfficialExternalPluginCatalogEntry | undefined {
  const normalized = pluginIdOrPackage.trim();
  if (!normalized) {
    return undefined;
  }
  return listOfficialExternalPluginCatalogEntries().find((entry) =>
    resolveOfficialExternalPluginLookupIds(entry).includes(normalized),
  );
}

export function resolveOfficialExternalPluginNpmSpec(
  pluginIdOrPackage: string,
): string | undefined {
  const entry = getOfficialExternalPluginCatalogEntry(pluginIdOrPackage);
  if (!entry) {
    return undefined;
  }
  return normalizeOptionalString(resolveOfficialExternalPluginInstall(entry)?.npmSpec);
}

export function isOfficialExternalPluginId(pluginId: string | undefined): boolean {
  const normalized = normalizeOptionalString(pluginId);
  return normalized ? Boolean(getOfficialExternalPluginCatalogEntry(normalized)) : false;
}

export function isOfficialExternalPluginPackageName(packageName: string | undefined): boolean {
  const normalized = normalizeOptionalString(packageName);
  if (!normalized) {
    return false;
  }
  const entry = getOfficialExternalPluginCatalogEntry(normalized);
  return Boolean(entry && normalizeOptionalString(entry.name) === normalized);
}
