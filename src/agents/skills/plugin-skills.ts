import fs from "node:fs";
import path from "node:path";
import { isAcpRuntimeSpawnAvailable } from "../../acp/runtime/availability.js";
import type { KovaConfig } from "../../config/types.kova.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  normalizePluginsConfigWithResolver,
  resolveEffectivePluginActivationState,
  resolveMemorySlotDecision,
} from "../../plugins/config-policy.js";
import type { PluginManifestRegistry } from "../../plugins/manifest-registry.js";
import { loadPluginManifestRegistryForPluginRegistry } from "../../plugins/plugin-registry.js";
import { hasKind } from "../../plugins/slots.js";
import { isPathInsideWithRealpath } from "../../security/scan-paths.js";
import { CONFIG_DIR } from "../../utils.js";

const log = createSubsystemLogger("skills");

type PluginSkillLinkType = "dir" | "junction";

function buildRegistryPluginIdAliases(
  registry: PluginManifestRegistry,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    registry.plugins
      .flatMap((record) => [
        ...record.providers
          .filter((providerId) => providerId !== record.id)
          .map((providerId) => [providerId, record.id] as const),
        ...(record.legacyPluginIds ?? []).map(
          (legacyPluginId) => [legacyPluginId, record.id] as const,
        ),
      ])
      .toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

function createRegistryPluginIdNormalizer(
  registry: PluginManifestRegistry,
): (id: string) => string {
  const aliases = buildRegistryPluginIdAliases(registry);
  return (id: string) => {
    const trimmed = id.trim();
    return aliases[trimmed] ?? trimmed;
  };
}

export function resolvePluginSkillDirs(params: {
  workspaceDir: string | undefined;
  config?: KovaConfig;
  /** Override the generated plugin skills directory for tests or isolated runs. */
  pluginSkillsDir?: string;
}): string[] {
  const workspaceDir = (params.workspaceDir ?? "").trim();
  if (!workspaceDir) {
    publishPluginSkills([], {
      pluginSkillsDir: params.pluginSkillsDir,
    });
    return [];
  }
  const registry = loadPluginManifestRegistryForPluginRegistry({
    workspaceDir,
    config: params.config,
    includeDisabled: true,
  });
  if (registry.plugins.length === 0) {
    publishPluginSkills([], {
      pluginSkillsDir: params.pluginSkillsDir,
    });
    return [];
  }
  const normalizedPlugins = normalizePluginsConfigWithResolver(
    params.config?.plugins,
    createRegistryPluginIdNormalizer(registry),
  );
  const acpRuntimeAvailable = isAcpRuntimeSpawnAvailable({ config: params.config });
  const memorySlot = normalizedPlugins.slots.memory;
  let selectedMemoryPluginId: string | null = null;
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const record of registry.plugins) {
    if (!record.skills || record.skills.length === 0) {
      continue;
    }
    const activationState = resolveEffectivePluginActivationState({
      id: record.id,
      origin: record.origin,
      config: normalizedPlugins,
      rootConfig: params.config,
      enabledByDefault: record.enabledByDefault,
    });
    if (!activationState.activated) {
      continue;
    }
    // ACP router skills should not be attached unless ACP can actually spawn.
    if (!acpRuntimeAvailable && record.id === "acpx") {
      continue;
    }
    const memoryDecision = resolveMemorySlotDecision({
      id: record.id,
      kind: record.kind,
      slot: memorySlot,
      selectedId: selectedMemoryPluginId,
    });
    if (!memoryDecision.enabled) {
      continue;
    }
    if (memoryDecision.selected && hasKind(record.kind, "memory")) {
      selectedMemoryPluginId = record.id;
    }
    for (const raw of record.skills) {
      const trimmed = raw.trim();
      if (!trimmed) {
        continue;
      }
      const candidate = path.resolve(record.rootDir, trimmed);
      if (!fs.existsSync(candidate)) {
        log.warn(`plugin skill path not found (${record.id}): ${candidate}`);
        continue;
      }
      if (!isPathInsideWithRealpath(record.rootDir, candidate, { requireRealpath: true })) {
        log.warn(`plugin skill path escapes plugin root (${record.id}): ${candidate}`);
        continue;
      }
      if (seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      resolved.push(candidate);
    }
  }

  publishPluginSkills(resolved, {
    pluginSkillsDir: params.pluginSkillsDir,
  });

  return resolved;
}

function resolveDefaultPluginSkillsDir(): string {
  return path.join(CONFIG_DIR, "plugin-skills");
}

function resolvePluginSkillLinkType(
  platform: NodeJS.Platform = process.platform,
): PluginSkillLinkType {
  return platform === "win32" ? "junction" : "dir";
}

function hasPublishableSkillFile(params: { skillDir: string; rootDir: string }): boolean {
  const skillMd = path.join(params.skillDir, "SKILL.md");
  let skillMdStat: fs.Stats;
  try {
    skillMdStat = fs.lstatSync(skillMd);
  } catch {
    return false;
  }
  if (!skillMdStat.isFile() || skillMdStat.isSymbolicLink()) {
    log.warn(`plugin skill SKILL.md is not a regular file: ${skillMd}`);
    return false;
  }
  if (!isPathInsideWithRealpath(params.rootDir, skillMd, { requireRealpath: true })) {
    log.warn(`plugin skill SKILL.md escapes declared skill root: ${skillMd}`);
    return false;
  }
  return true;
}

function collectSkillTargets(dir: string, targets: Map<string, string>): void {
  if (hasPublishableSkillFile({ skillDir: dir, rootDir: dir })) {
    const basename = path.basename(dir);
    const existing = targets.get(basename);
    if (existing) {
      log.warn(
        `plugin skill name collision: "${basename}" resolves to both ${existing} and ${dir}; ` +
          `only the first will be published`,
      );
      return;
    }
    targets.set(basename, dir);
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue;
    }
    const childPath = path.join(dir, entry.name);
    if (!hasPublishableSkillFile({ skillDir: childPath, rootDir: dir })) {
      continue;
    }
    const existing = targets.get(entry.name);
    if (existing) {
      log.warn(
        `plugin skill name collision: "${entry.name}" resolves to both ${existing} and ${childPath}; ` +
          `only the first will be published`,
      );
      continue;
    }
    targets.set(entry.name, childPath);
  }
}

function publishPluginSkills(skillDirs: string[], opts?: { pluginSkillsDir?: string }): void {
  const pluginSkillsDir = opts?.pluginSkillsDir ?? resolveDefaultPluginSkillsDir();
  const managedTargets = new Map<string, string>();

  for (const dir of skillDirs) {
    collectSkillTargets(dir, managedTargets);
  }

  for (const [name, target] of managedTargets) {
    const linkPath = path.join(pluginSkillsDir, name);
    try {
      fs.mkdirSync(pluginSkillsDir, { recursive: true });
    } catch {
      // best-effort; symlink will fail below if the directory is unusable
    }
    try {
      const existingEntry = fs.lstatSync(linkPath);
      if (existingEntry.isSymbolicLink()) {
        const existingTarget = fs.readlinkSync(linkPath);
        if (existingTarget === target) {
          continue;
        }
        removeGeneratedPluginSkillEntry(linkPath);
      } else if (isGeneratedPluginSkillEntry(existingEntry)) {
        removeGeneratedPluginSkillEntry(linkPath);
      } else {
        log.warn(`plugin skill entry is not a generated symlink: ${linkPath}`);
        continue;
      }
    } catch (err) {
      if (!isNotFoundError(err)) {
        log.warn(`failed to inspect plugin skill symlink "${linkPath}": ${String(err)}`);
        continue;
      }
    }
    try {
      fs.symlinkSync(target, linkPath, resolvePluginSkillLinkType());
    } catch (err) {
      log.warn(
        `failed to create plugin skill symlink "${linkPath}" -> "${target}": ${String(err)}`,
      );
    }
  }

  let existingEntries: fs.Dirent[];
  try {
    existingEntries = fs.readdirSync(pluginSkillsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of existingEntries) {
    if (!isGeneratedPluginSkillEntry(entry)) {
      continue;
    }
    if (managedTargets.has(entry.name)) {
      continue;
    }
    removeGeneratedPluginSkillEntry(path.join(pluginSkillsDir, entry.name));
  }
}

function isGeneratedPluginSkillEntry(
  entry: Pick<fs.Dirent, "isDirectory" | "isSymbolicLink">,
): boolean {
  return entry.isSymbolicLink() || (process.platform === "win32" && entry.isDirectory());
}

function removeGeneratedPluginSkillEntry(linkPath: string): void {
  try {
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const code = (err as Record<string, unknown>).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

export const testing = {
  isGeneratedPluginSkillEntry,
  publishPluginSkills,
  resolvePluginSkillLinkType,
};
export { testing as __testing };
