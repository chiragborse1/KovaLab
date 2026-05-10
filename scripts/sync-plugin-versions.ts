import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compareComparableSemver, parseComparableSemver } from "../src/infra/semver-compare.js";

type PackageJson = {
  name?: string;
  version?: string;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  openclaw?: {
    install?: {
      minHostVersion?: string;
    };
    compat?: {
      pluginApi?: string;
    };
    build?: {
      openclawVersion?: string;
    };
  };
};

const KOVA_VERSION_RANGE_RE = /^(?:>=|\^)(\d+\.\d+\.\d+(?:[-.][^"\s]+)?)$/u;

function parseComparableRangeFloor(range: string): string | null {
  const match = KOVA_VERSION_RANGE_RE.exec(range);
  return match?.[1] ?? null;
}

function syncKovaDependencyRange(
  deps: Record<string, string> | undefined,
  targetVersion: string,
): boolean {
  let changed = false;
  for (const dependencyName of ["getkova", "openclaw"] as const) {
    const current = deps?.[dependencyName];
    if (!current || current === "workspace:*" || !parseComparableRangeFloor(current)) {
      continue;
    }
    const next = dependencyName === "getkova" ? `^${targetVersion}` : `>=${targetVersion}`;
    if (current === next) {
      continue;
    }
    deps[dependencyName] = next;
    changed = true;
  }
  return changed;
}

function syncPluginApiVersion(pkg: PackageJson, targetVersion: string): boolean {
  const compat = pkg.openclaw?.compat;
  const current = compat?.pluginApi;
  if (!current || !parseComparableRangeFloor(current)) {
    return false;
  }
  const next = `>=${targetVersion}`;
  if (current === next) {
    return false;
  }
  compat.pluginApi = next;
  return true;
}

function syncMinHostVersionFloor(pkg: PackageJson, targetVersion: string): boolean {
  const install = pkg.openclaw?.install;
  const current = install?.minHostVersion;
  const currentFloor = current ? parseComparableRangeFloor(current) : null;
  if (!install || !currentFloor) {
    return false;
  }
  const currentVersion = parseComparableSemver(currentFloor, { normalizeLegacyDotBeta: true });
  const target = parseComparableSemver(targetVersion, { normalizeLegacyDotBeta: true });
  const comparison = compareComparableSemver(currentVersion, target);
  if (comparison == null || comparison <= 0) {
    return false;
  }
  install.minHostVersion = `>=${targetVersion}`;
  return true;
}

function syncBuildOpenClawVersion(pkg: PackageJson, targetVersion: string): boolean {
  const build = pkg.openclaw?.build;
  const current = build?.openclawVersion;
  if (!current) {
    return false;
  }
  if (current === targetVersion) {
    return false;
  }
  build.openclawVersion = targetVersion;
  return true;
}

function ensureChangelogEntry(changelogPath: string, version: string): boolean {
  if (!existsSync(changelogPath)) {
    return false;
  }
  const content = readFileSync(changelogPath, "utf8");
  if (content.includes(`## ${version}`)) {
    return false;
  }
  const entry = `## ${version}\n\n### Changes\n- Version alignment with core Kova release numbers.\n\n`;
  if (content.startsWith("# Changelog\n\n")) {
    const next = content.replace("# Changelog\n\n", `# Changelog\n\n${entry}`);
    writeFileSync(changelogPath, next);
    return true;
  }
  const next = `# Changelog\n\n${entry}${content.trimStart()}`;
  writeFileSync(changelogPath, `${next}\n`);
  return true;
}

export function syncPluginVersions(rootDir = resolve(".")) {
  const rootPackagePath = join(rootDir, "package.json");
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8")) as PackageJson;
  const targetVersion = rootPackage.version;
  if (!targetVersion) {
    throw new Error("Root package.json missing version.");
  }

  const extensionsDir = join(rootDir, "extensions");
  const dirs = readdirSync(extensionsDir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );

  const updated: string[] = [];
  const changelogged: string[] = [];
  const skipped: string[] = [];

  for (const dir of dirs) {
    const packagePath = join(extensionsDir, dir.name, "package.json");
    let pkg: PackageJson;
    try {
      pkg = JSON.parse(readFileSync(packagePath, "utf8")) as PackageJson;
    } catch {
      continue;
    }

    if (!pkg.name) {
      skipped.push(dir.name);
      continue;
    }

    const changelogPath = join(extensionsDir, dir.name, "CHANGELOG.md");
    if (ensureChangelogEntry(changelogPath, targetVersion)) {
      changelogged.push(pkg.name);
    }

    const versionChanged = pkg.version !== targetVersion;
    const devDependencyChanged = syncKovaDependencyRange(pkg.devDependencies, targetVersion);
    const peerDependencyChanged = syncKovaDependencyRange(pkg.peerDependencies, targetVersion);
    // Bundled plugins cannot require a host newer than the release that ships them.
    // Lower impossible floors during release-scheme migrations, but keep older valid floors.
    const minHostVersionChanged = syncMinHostVersionFloor(pkg, targetVersion);
    const pluginApiChanged = syncPluginApiVersion(pkg, targetVersion);
    const buildOpenClawVersionChanged = syncBuildOpenClawVersion(pkg, targetVersion);
    const packageChanged =
      versionChanged ||
      devDependencyChanged ||
      peerDependencyChanged ||
      minHostVersionChanged ||
      pluginApiChanged ||
      buildOpenClawVersionChanged;
    if (!packageChanged) {
      skipped.push(pkg.name);
      continue;
    }

    if (versionChanged) {
      pkg.version = targetVersion;
    }
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    updated.push(pkg.name);
  }

  return {
    targetVersion,
    updated,
    changelogged,
    skipped,
  };
}

if (import.meta.main) {
  const summary = syncPluginVersions();
  console.log(
    `Synced plugin versions to ${summary.targetVersion}. Updated: ${summary.updated.length}. Changelogged: ${summary.changelogged.length}. Skipped: ${summary.skipped.length}.`,
  );
}
