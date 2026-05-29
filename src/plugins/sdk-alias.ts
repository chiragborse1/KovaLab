import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveKovaPackageRootSync } from "../infra/kova-root.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { PluginLruCache } from "./plugin-lru-cache.js";

type PluginSdkAliasCandidateKind = "dist" | "src";
export type PluginSdkResolutionPreference = "auto" | "dist" | "src";

export type LoaderModuleResolveParams = {
  modulePath?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
  pluginSdkResolution?: PluginSdkResolutionPreference;
};

export type PluginRuntimeModuleResolution = {
  modulePath?: string;
  packageRoot: string | null;
  candidates: string[];
  resolvedPath: string | null;
  error?: string;
};

type PluginSdkPackageJson = {
  exports?: Record<string, unknown>;
  bin?: string | Record<string, unknown>;
  version?: string;
};

const STARTUP_ARGV1 = process.argv[1];
const pluginSdkPackageJsonByRoot = new Map<string, PluginSdkPackageJson | null>();

export function normalizeJitiAliasTargetPath(targetPath: string): string {
  return process.platform === "win32" ? targetPath.replace(/\\/g, "/") : targetPath;
}

function resolveLoaderModulePath(params: LoaderModuleResolveParams = {}): string {
  return params.modulePath ?? fileURLToPath(params.moduleUrl ?? import.meta.url);
}

function readPluginSdkPackageJson(packageRoot: string): PluginSdkPackageJson | null {
  const cacheKey = path.resolve(packageRoot);
  if (pluginSdkPackageJsonByRoot.has(cacheKey)) {
    return pluginSdkPackageJsonByRoot.get(cacheKey) ?? null;
  }
  try {
    const pkgRaw = fs.readFileSync(path.join(packageRoot, "package.json"), "utf-8");
    const parsed = JSON.parse(pkgRaw) as PluginSdkPackageJson;
    pluginSdkPackageJsonByRoot.set(cacheKey, parsed);
    return parsed;
  } catch {
    pluginSdkPackageJsonByRoot.set(cacheKey, null);
    return null;
  }
}

function sanitizeJitiCachePathSegment(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unknown";
}

function resolveJitiFsCacheTmpDir(): string {
  let tmpDir = os.tmpdir();
  if (process.env.TMPDIR && tmpDir === process.cwd() && !process.env.JITI_RESPECT_TMPDIR_ENV) {
    const originalTmpDir = process.env.TMPDIR;
    delete process.env.TMPDIR;
    try {
      tmpDir = os.tmpdir();
    } finally {
      process.env.TMPDIR = originalTmpDir;
    }
  }
  return tmpDir;
}

function readJitiBooleanEnv(name: string, defaultValue: boolean): boolean {
  if (!(name in process.env)) {
    return defaultValue;
  }
  try {
    return Boolean(JSON.parse(process.env[name] ?? ""));
  } catch {
    return defaultValue;
  }
}

function shouldUseJitiFsCache(): boolean {
  return readJitiBooleanEnv("JITI_FS_CACHE", readJitiBooleanEnv("JITI_CACHE", true));
}

function resolveJitiCacheModulePath(params: LoaderModuleResolveParams = {}): string {
  if (params.modulePath?.startsWith("file://")) {
    try {
      return fileURLToPath(params.modulePath);
    } catch {
      // Fall through to the shared module resolver for malformed test inputs.
    }
  }
  return resolveLoaderModulePath(params);
}

export function resolvePluginLoaderJitiFsCacheDir(params: LoaderModuleResolveParams = {}): string {
  const modulePath = resolveJitiCacheModulePath(params);
  const packageRoot =
    resolveLoaderPackageRoot({ ...params, modulePath }) ?? path.dirname(modulePath);
  const packageJsonPath = path.join(packageRoot, "package.json");
  const version = sanitizeJitiCachePathSegment(
    readPluginSdkPackageJson(packageRoot)?.version ?? "unknown",
  );
  let installMarker = "no-package-json";
  try {
    const stat = fs.statSync(packageJsonPath);
    installMarker = `${Math.trunc(stat.mtimeMs)}-${stat.size}`;
  } catch {
    // Package installs should have package.json; keep cache setup best-effort.
  }
  return path.join(
    resolveJitiFsCacheTmpDir(),
    "jiti",
    "kova",
    version,
    sanitizeJitiCachePathSegment(installMarker),
  );
}

export function resolvePluginLoaderJitiFsCacheOption(
  params: LoaderModuleResolveParams = {},
): false | string {
  return shouldUseJitiFsCache() ? resolvePluginLoaderJitiFsCacheDir(params) : false;
}

function isSafePluginSdkSubpathSegment(subpath: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(subpath);
}

function listPluginSdkSubpathsFromPackageJson(pkg: PluginSdkPackageJson): string[] {
  return Object.keys(pkg.exports ?? {})
    .filter((key) => key.startsWith("./plugin-sdk/"))
    .map((key) => key.slice("./plugin-sdk/".length))
    .filter((subpath) => isSafePluginSdkSubpathSegment(subpath))
    .toSorted();
}

function hasTrustedKovaRootIndicator(params: {
  packageRoot: string;
  packageJson: PluginSdkPackageJson;
}): boolean {
  const packageExports = params.packageJson.exports ?? {};
  const hasPluginSdkRootExport = Object.prototype.hasOwnProperty.call(
    packageExports,
    "./plugin-sdk",
  );
  if (!hasPluginSdkRootExport) {
    return false;
  }
  const hasCliEntryExport = Object.prototype.hasOwnProperty.call(packageExports, "./cli-entry");
  const hasKovaBin =
    (typeof params.packageJson.bin === "string" &&
      normalizeLowercaseStringOrEmpty(params.packageJson.bin).includes("kova")) ||
    (typeof params.packageJson.bin === "object" &&
      params.packageJson.bin !== null &&
      typeof params.packageJson.bin.kova === "string");
  const hasKovaEntrypoint = fs.existsSync(path.join(params.packageRoot, "kova.mjs"));
  return hasCliEntryExport || hasKovaBin || hasKovaEntrypoint;
}

function readPluginSdkSubpathsFromPackageRoot(packageRoot: string): string[] | null {
  const pkg = readPluginSdkPackageJson(packageRoot);
  if (!pkg) {
    return null;
  }
  if (!hasTrustedKovaRootIndicator({ packageRoot, packageJson: pkg })) {
    return null;
  }
  const subpaths = listPluginSdkSubpathsFromPackageJson(pkg);
  return subpaths.length > 0 ? subpaths : null;
}

function resolveTrustedKovaRootFromArgvHint(params: {
  argv1?: string;
  cwd: string;
}): string | null {
  if (!params.argv1) {
    return null;
  }
  const packageRoot = resolveKovaPackageRootSync({
    cwd: params.cwd,
    argv1: params.argv1,
  });
  if (!packageRoot) {
    return null;
  }
  const packageJson = readPluginSdkPackageJson(packageRoot);
  if (!packageJson) {
    return null;
  }
  return hasTrustedKovaRootIndicator({ packageRoot, packageJson }) ? packageRoot : null;
}

function findNearestPluginSdkPackageRoot(startDir: string, maxDepth = 12): string | null {
  let cursor = path.resolve(startDir);
  for (let i = 0; i < maxDepth; i += 1) {
    const subpaths = readPluginSdkSubpathsFromPackageRoot(cursor);
    if (subpaths) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  return null;
}

export function resolveLoaderPackageRoot(
  params: LoaderModuleResolveParams & { modulePath: string },
): string | null {
  const cwd = params.cwd ?? path.dirname(params.modulePath);
  const fromModulePath = resolveKovaPackageRootSync({ cwd });
  if (fromModulePath) {
    return fromModulePath;
  }
  const argv1 = params.argv1 ?? process.argv[1];
  const moduleUrl = params.moduleUrl ?? (params.modulePath ? undefined : import.meta.url);
  return resolveKovaPackageRootSync({
    cwd,
    ...(argv1 ? { argv1 } : {}),
    ...(moduleUrl ? { moduleUrl } : {}),
  });
}

function createPluginRuntimeModuleCandidateMap(packageRoot: string) {
  return {
    src: path.join(packageRoot, "src", "plugins", "runtime", "index.ts"),
    dist: path.join(packageRoot, "dist", "plugins", "runtime", "index.js"),
  } as const;
}

function appendPluginRuntimeModuleCandidates(
  candidates: string[],
  packageRoot: string,
  orderedKinds: readonly PluginSdkAliasCandidateKind[],
): void {
  const candidateMap = createPluginRuntimeModuleCandidateMap(packageRoot);
  for (const kind of orderedKinds) {
    candidates.push(candidateMap[kind]);
  }
}

function appendSiblingPluginRuntimeModuleCandidates(
  candidates: string[],
  runtimeDir: string,
  orderedKinds: readonly PluginSdkAliasCandidateKind[],
): void {
  const candidateMap = {
    src: path.join(runtimeDir, "index.ts"),
    dist: path.join(runtimeDir, "index.js"),
  } as const;
  for (const kind of orderedKinds) {
    candidates.push(candidateMap[kind]);
  }
}

function dedupeResolvedPaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const candidate of paths) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    deduped.push(resolved);
  }
  return deduped;
}

function listAncestorPluginRuntimeModuleCandidates(params: {
  starts: readonly (string | undefined)[];
  orderedKinds: readonly PluginSdkAliasCandidateKind[];
  maxDepth?: number;
}): string[] {
  const candidates: string[] = [];
  for (const start of params.starts) {
    if (!start) {
      continue;
    }
    let cursor = path.resolve(start);
    const maxDepth = params.maxDepth ?? 12;
    for (let i = 0; i < maxDepth; i += 1) {
      appendPluginRuntimeModuleCandidates(candidates, cursor, params.orderedKinds);
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        break;
      }
      cursor = parent;
    }
  }
  return dedupeResolvedPaths(candidates);
}

function listArgvRuntimeFallbackStartDirs(argv1: string | undefined): string[] {
  if (!argv1) {
    return [];
  }
  const normalized = path.resolve(argv1);
  const starts: string[] = [];
  const parts = normalized.split(path.sep);
  const binIndex = parts.lastIndexOf(".bin");
  if (binIndex > 0 && parts[binIndex - 1] === "node_modules") {
    const binName = path.basename(normalized);
    const nodeModulesDir = parts.slice(0, binIndex).join(path.sep);
    if (binName === "kova") {
      starts.push(path.join(nodeModulesDir, "getkova"));
    }
    starts.push(path.join(nodeModulesDir, binName));
  }
  try {
    const resolved = fs.realpathSync(normalized);
    if (resolved !== normalized) {
      starts.push(path.dirname(resolved));
    }
  } catch {
    // Startup shims may not exist in tests; keep the unresolved argv path.
  }
  starts.push(path.dirname(normalized));
  return dedupeResolvedPaths(starts);
}

function formatResolutionError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveLoaderPluginSdkPackageRoot(
  params: LoaderModuleResolveParams & { modulePath: string },
): string | null {
  const cwd = params.cwd ?? path.dirname(params.modulePath);
  const fromCwd = resolveKovaPackageRootSync({ cwd });
  const fromExplicitHints =
    resolveTrustedKovaRootFromArgvHint({ cwd, argv1: params.argv1 }) ??
    (params.moduleUrl
      ? resolveKovaPackageRootSync({
          cwd,
          moduleUrl: params.moduleUrl,
        })
      : null);
  return (
    fromCwd ??
    fromExplicitHints ??
    findNearestPluginSdkPackageRoot(path.dirname(params.modulePath)) ??
    (params.cwd ? findNearestPluginSdkPackageRoot(params.cwd) : null) ??
    findNearestPluginSdkPackageRoot(process.cwd())
  );
}

export function resolvePluginSdkAliasCandidateOrder(params: {
  modulePath: string;
  isProduction: boolean;
  pluginSdkResolution?: PluginSdkResolutionPreference;
}): PluginSdkAliasCandidateKind[] {
  if (params.pluginSdkResolution === "dist") {
    return ["dist", "src"];
  }
  if (params.pluginSdkResolution === "src") {
    return ["src", "dist"];
  }
  const normalizedModulePath = params.modulePath.replace(/\\/g, "/");
  const isDistRuntime = normalizedModulePath.includes("/dist/");
  return isDistRuntime || params.isProduction ? ["dist", "src"] : ["src", "dist"];
}

export function listPluginSdkAliasCandidates(params: {
  srcFile: string;
  distFile: string;
  modulePath: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
  pluginSdkResolution?: PluginSdkResolutionPreference;
}) {
  const orderedKinds = resolvePluginSdkAliasCandidateOrder({
    modulePath: params.modulePath,
    isProduction: process.env.NODE_ENV === "production",
    pluginSdkResolution: params.pluginSdkResolution,
  });
  const packageRoot = resolveLoaderPluginSdkPackageRoot(params);
  if (packageRoot) {
    const candidateMap = {
      src: path.join(packageRoot, "src", "plugin-sdk", params.srcFile),
      dist: path.join(packageRoot, "dist", "plugin-sdk", params.distFile),
    } as const;
    return orderedKinds.map((kind) => candidateMap[kind]);
  }
  let cursor = path.dirname(params.modulePath);
  const candidates: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const candidateMap = {
      src: path.join(cursor, "src", "plugin-sdk", params.srcFile),
      dist: path.join(cursor, "dist", "plugin-sdk", params.distFile),
    } as const;
    for (const kind of orderedKinds) {
      candidates.push(candidateMap[kind]);
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  return candidates;
}

export function resolvePluginSdkAliasFile(params: {
  srcFile: string;
  distFile: string;
  modulePath?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
  pluginSdkResolution?: PluginSdkResolutionPreference;
}): string | null {
  try {
    const modulePath = resolveLoaderModulePath(params);
    for (const candidate of listPluginSdkAliasCandidates({
      srcFile: params.srcFile,
      distFile: params.distFile,
      modulePath,
      argv1: params.argv1,
      cwd: params.cwd,
      moduleUrl: params.moduleUrl,
      pluginSdkResolution: params.pluginSdkResolution,
    })) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

const MAX_PLUGIN_LOADER_ALIAS_CACHE_ENTRIES = 512;
const cachedPluginSdkExportedSubpaths = new PluginLruCache<string[]>(
  MAX_PLUGIN_LOADER_ALIAS_CACHE_ENTRIES,
);
const cachedPluginSdkScopedAliasMaps = new PluginLruCache<Record<string, string>>(
  MAX_PLUGIN_LOADER_ALIAS_CACHE_ENTRIES,
);
const cachedBundledPluginPublicSurfaceAliasMaps = new PluginLruCache<Record<string, string>>(
  MAX_PLUGIN_LOADER_ALIAS_CACHE_ENTRIES,
);
const PLUGIN_SDK_PACKAGE_NAMES = ["getkova/plugin-sdk", "@getkova/plugin-sdk"] as const;
const PLUGIN_SDK_SOURCE_CANDIDATE_EXTENSIONS = [
  ".ts",
  ".mts",
  ".js",
  ".mjs",
  ".cts",
  ".cjs",
] as const;
const BUNDLED_PLUGIN_PUBLIC_SURFACE_SOURCE_PATTERN = /^(?:api|runtime-api|test-api|.+-api)$/u;
const JS_STATIC_RELATIVE_DEPENDENCY_PATTERN =
  /(?:\bfrom\s*["']|\bimport\s*\(\s*["']|\brequire\s*\(\s*["'])(\.{1,2}\/[^"']+)["']/g;

function isUsableDistPluginSdkArtifact(candidate: string): boolean {
  if (!fs.existsSync(candidate)) {
    return false;
  }
  switch (normalizeLowercaseStringOrEmpty(path.extname(candidate))) {
    case ".js":
    case ".mjs":
    case ".cjs":
      break;
    default:
      return true;
  }
  try {
    const source = fs.readFileSync(candidate, "utf-8");
    for (const match of source.matchAll(JS_STATIC_RELATIVE_DEPENDENCY_PATTERN)) {
      const specifier = match[1];
      if (!specifier || fs.existsSync(path.resolve(path.dirname(candidate), specifier))) {
        continue;
      }
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

function readPrivateLocalOnlyPluginSdkSubpaths(packageRoot: string): string[] {
  try {
    const raw = fs.readFileSync(
      path.join(packageRoot, "scripts", "lib", "plugin-sdk-private-local-only-subpaths.json"),
      "utf-8",
    );
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((subpath): subpath is string => isSafePluginSdkSubpathSegment(subpath));
  } catch {
    return [];
  }
}

function readBundledPluginPackageName(packageJsonPath: string): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { name?: unknown };
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    return name.startsWith("@kovaai/") ? name : null;
  } catch {
    return null;
  }
}

function isBundledPluginPublicSurfaceSourceBasename(params: {
  basename: string;
  includePrivateQa: boolean;
}): boolean {
  if (params.basename === "test-api") {
    return params.includePrivateQa;
  }
  return BUNDLED_PLUGIN_PUBLIC_SURFACE_SOURCE_PATTERN.test(params.basename);
}

function listBundledPluginPublicSurfaceSourceBasenames(params: {
  extensionSourceRoot: string;
  includePrivateQa: boolean;
}): string[] {
  try {
    return fs
      .readdirSync(params.extensionSourceRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .flatMap((fileName) => {
        const ext = PLUGIN_SDK_SOURCE_CANDIDATE_EXTENSIONS.find((candidateExt) =>
          fileName.endsWith(candidateExt),
        );
        if (!ext) {
          return [];
        }
        const basename = fileName.slice(0, -ext.length);
        return isBundledPluginPublicSurfaceSourceBasename({
          basename,
          includePrivateQa: params.includePrivateQa,
        })
          ? [basename]
          : [];
      })
      .toSorted();
  } catch {
    return [];
  }
}

function resolveBundledPluginPublicSurfaceAliasTarget(params: {
  packageRoot: string;
  dirName: string;
  basename: string;
  orderedKinds: PluginSdkAliasCandidateKind[];
}): string | null {
  for (const kind of params.orderedKinds) {
    if (kind === "dist") {
      const candidate = path.join(
        params.packageRoot,
        "dist",
        "extensions",
        params.dirName,
        `${params.basename}.js`,
      );
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    for (const ext of PLUGIN_SDK_SOURCE_CANDIDATE_EXTENSIONS) {
      const candidate = path.join(
        params.packageRoot,
        "extensions",
        params.dirName,
        `${params.basename}${ext}`,
      );
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function resolveBundledPluginPackagePublicSurfaceAliasMap(params: {
  modulePath: string;
  argv1?: string;
  moduleUrl?: string;
  pluginSdkResolution: PluginSdkResolutionPreference;
}): Record<string, string> {
  const packageRoot = resolveLoaderPluginSdkPackageRoot(params);
  if (!packageRoot) {
    return {};
  }
  const orderedKinds = resolvePluginSdkAliasCandidateOrder({
    modulePath: params.modulePath,
    isProduction: process.env.NODE_ENV === "production",
    pluginSdkResolution: params.pluginSdkResolution,
  });
  const includePrivateQa = shouldIncludePrivateLocalOnlyPluginSdkSubpaths();
  const cacheKey = `${packageRoot}::${orderedKinds.join(",")}::privateQa=${includePrivateQa ? "1" : "0"}`;
  const cached = cachedBundledPluginPublicSurfaceAliasMaps.get(cacheKey);
  if (cached) {
    return cached;
  }
  const extensionsRoot = path.join(packageRoot, "extensions");
  let extensionDirs: fs.Dirent[];
  try {
    extensionDirs = fs.readdirSync(extensionsRoot, { withFileTypes: true });
  } catch {
    cachedBundledPluginPublicSurfaceAliasMaps.set(cacheKey, {});
    return {};
  }
  const aliasMap: Record<string, string> = {};
  for (const entry of extensionDirs) {
    if (!entry.isDirectory()) {
      continue;
    }
    const dirName = entry.name;
    const packageName = readBundledPluginPackageName(
      path.join(extensionsRoot, dirName, "package.json"),
    );
    if (!packageName) {
      continue;
    }
    for (const basename of listBundledPluginPublicSurfaceSourceBasenames({
      extensionSourceRoot: path.join(extensionsRoot, dirName),
      includePrivateQa,
    })) {
      const target = resolveBundledPluginPublicSurfaceAliasTarget({
        packageRoot,
        dirName,
        basename,
        orderedKinds,
      });
      if (!target) {
        continue;
      }
      aliasMap[`${packageName}/${basename}.js`] = normalizeJitiAliasTargetPath(target);
    }
  }
  cachedBundledPluginPublicSurfaceAliasMaps.set(cacheKey, aliasMap);
  return aliasMap;
}

function shouldIncludePrivateLocalOnlyPluginSdkSubpaths() {
  return process.env.KOVA_ENABLE_PRIVATE_QA_CLI === "1";
}

function hasPluginSdkSubpathArtifact(packageRoot: string, subpath: string) {
  const distPath = path.join(packageRoot, "dist", "plugin-sdk", `${subpath}.js`);
  if (isUsableDistPluginSdkArtifact(distPath)) {
    return true;
  }
  return PLUGIN_SDK_SOURCE_CANDIDATE_EXTENSIONS.some((ext) =>
    fs.existsSync(path.join(packageRoot, "src", "plugin-sdk", `${subpath}${ext}`)),
  );
}

function listDistPluginSdkArtifactSubpaths(packageRoot: string): Set<string> {
  try {
    const distPluginSdkDir = path.join(packageRoot, "dist", "plugin-sdk");
    return new Set(
      fs
        .readdirSync(distPluginSdkDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
        .map((entry) => entry.name.slice(0, -".js".length))
        .filter((subpath) => isSafePluginSdkSubpathSegment(subpath)),
    );
  } catch {
    return new Set();
  }
}

function listPrivateLocalOnlyPluginSdkSubpaths(packageRoot: string): string[] {
  if (!shouldIncludePrivateLocalOnlyPluginSdkSubpaths()) {
    return [];
  }
  return readPrivateLocalOnlyPluginSdkSubpaths(packageRoot).filter((subpath) =>
    hasPluginSdkSubpathArtifact(packageRoot, subpath),
  );
}

export function listPluginSdkExportedSubpaths(
  params: {
    modulePath?: string;
    argv1?: string;
    moduleUrl?: string;
    pluginSdkResolution?: PluginSdkResolutionPreference;
  } = {},
): string[] {
  const modulePath = params.modulePath ?? fileURLToPath(import.meta.url);
  const packageRoot = resolveLoaderPluginSdkPackageRoot({
    modulePath,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot) {
    return [];
  }
  const cacheKey = `${packageRoot}::privateQa=${shouldIncludePrivateLocalOnlyPluginSdkSubpaths() ? "1" : "0"}`;
  const cached = cachedPluginSdkExportedSubpaths.get(cacheKey);
  if (cached) {
    return cached;
  }
  const subpaths = [
    ...new Set([
      ...(readPluginSdkSubpathsFromPackageRoot(packageRoot) ?? []),
      ...listPrivateLocalOnlyPluginSdkSubpaths(packageRoot),
    ]),
  ].toSorted();
  cachedPluginSdkExportedSubpaths.set(cacheKey, subpaths);
  return subpaths;
}

export function resolvePluginSdkScopedAliasMap(
  params: {
    modulePath?: string;
    argv1?: string;
    moduleUrl?: string;
    pluginSdkResolution?: PluginSdkResolutionPreference;
  } = {},
): Record<string, string> {
  const modulePath = params.modulePath ?? fileURLToPath(import.meta.url);
  const packageRoot = resolveLoaderPluginSdkPackageRoot({
    modulePath,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot) {
    return {};
  }
  const orderedKinds = resolvePluginSdkAliasCandidateOrder({
    modulePath,
    isProduction: process.env.NODE_ENV === "production",
    pluginSdkResolution: params.pluginSdkResolution,
  });
  const cacheKey = `${packageRoot}::${orderedKinds.join(",")}::privateQa=${shouldIncludePrivateLocalOnlyPluginSdkSubpaths() ? "1" : "0"}`;
  const cached = cachedPluginSdkScopedAliasMaps.get(cacheKey);
  if (cached) {
    return cached;
  }
  const aliasMap: Record<string, string> = {};
  const distPluginSdkArtifacts = orderedKinds.includes("dist")
    ? listDistPluginSdkArtifactSubpaths(packageRoot)
    : new Set<string>();
  for (const subpath of listPluginSdkExportedSubpaths({
    modulePath,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
    pluginSdkResolution: params.pluginSdkResolution,
  })) {
    for (const kind of orderedKinds) {
      if (kind === "dist") {
        if (!distPluginSdkArtifacts.has(subpath)) {
          continue;
        }
        const candidate = path.join(packageRoot, "dist", "plugin-sdk", `${subpath}.js`);
        if (isUsableDistPluginSdkArtifact(candidate)) {
          for (const packageName of PLUGIN_SDK_PACKAGE_NAMES) {
            aliasMap[`${packageName}/${subpath}`] = candidate;
          }
          break;
        }
        continue;
      }
      for (const ext of PLUGIN_SDK_SOURCE_CANDIDATE_EXTENSIONS) {
        const candidate = path.join(packageRoot, "src", "plugin-sdk", `${subpath}${ext}`);
        if (!fs.existsSync(candidate)) {
          continue;
        }
        for (const packageName of PLUGIN_SDK_PACKAGE_NAMES) {
          aliasMap[`${packageName}/${subpath}`] = candidate;
        }
        break;
      }
      if (Object.prototype.hasOwnProperty.call(aliasMap, `getkova/plugin-sdk/${subpath}`)) {
        break;
      }
    }
  }
  cachedPluginSdkScopedAliasMaps.set(cacheKey, aliasMap);
  return aliasMap;
}

export function resolveExtensionApiAlias(params: LoaderModuleResolveParams = {}): string | null {
  try {
    const modulePath = resolveLoaderModulePath(params);
    const packageRoot = resolveLoaderPackageRoot({ ...params, modulePath });
    if (!packageRoot) {
      return null;
    }

    const orderedKinds = resolvePluginSdkAliasCandidateOrder({
      modulePath,
      isProduction: process.env.NODE_ENV === "production",
      pluginSdkResolution: params.pluginSdkResolution,
    });
    for (const kind of orderedKinds) {
      if (kind === "dist") {
        const candidate = path.join(packageRoot, "dist", "extensionAPI.js");
        if (fs.existsSync(candidate)) {
          return candidate;
        }
        continue;
      }
      for (const ext of PLUGIN_SDK_SOURCE_CANDIDATE_EXTENSIONS) {
        const candidate = path.join(packageRoot, "src", `extensionAPI${ext}`);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

const JITI_NORMALIZED_ALIAS_SYMBOL = Symbol.for("pathe:normalizedAlias");
const JITI_ALIAS_ROOT_SENTINELS = new Set<string | undefined>(["/", "\\", undefined]);
const JITI_CONCRETE_ALIAS_TARGET_PATTERN = /^(?:[A-Za-z]:[/\\]|[/\\])/;

// Memoize loader alias/config by effective resolution context so repeated
// loader setup avoids rebuilding the same filesystem-derived map and cache key.
// Include cwd/env inputs because the fallback root and private QA alias
// surfaces depend on them.
const aliasMapCache = new PluginLruCache<Record<string, string>>(
  MAX_PLUGIN_LOADER_ALIAS_CACHE_ENTRIES,
);
const normalizedJitiAliasMapCache = new PluginLruCache<Record<string, string>>(
  MAX_PLUGIN_LOADER_ALIAS_CACHE_ENTRIES,
);
const normalizedJitiAliasMapByInput = new WeakMap<Record<string, string>, Record<string, string>>();
const pluginLoaderJitiCacheKeyByAliasMap = new WeakMap<Record<string, string>, string>();
const pluginLoaderJitiConfigCache = new PluginLruCache<{
  tryNative: boolean;
  aliasMap: Record<string, string>;
  cacheKey: string;
}>(MAX_PLUGIN_LOADER_ALIAS_CACHE_ENTRIES);

function hasJitiNormalizedAliasMarker(aliasMap: Record<string, string>) {
  return Boolean((aliasMap as Record<symbol, unknown>)[JITI_NORMALIZED_ALIAS_SYMBOL]);
}

function createJitiAliasContentCacheKey(aliasMap: Record<string, string>) {
  return Object.entries(aliasMap)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}\0${value}`)
    .join("\0");
}

function isConcreteJitiAliasTarget(target: string | undefined): boolean {
  return typeof target === "string" && JITI_CONCRETE_ALIAS_TARGET_PATTERN.test(target);
}

function resolveJitiAliasTarget(
  aliasKey: string,
  aliasKeys: string[],
  aliasMap: Record<string, string>,
) {
  let target = aliasMap[aliasKey];
  const seenTargets = new Set<string>();
  const seenAliasKeys = new Set<string>();
  while (target && !isConcreteJitiAliasTarget(target) && !seenTargets.has(target)) {
    seenTargets.add(target);
    let nextTarget: string | undefined;
    for (const candidateKey of aliasKeys) {
      if (
        candidateKey === aliasKey ||
        aliasKey.startsWith(candidateKey) ||
        !target.startsWith(candidateKey) ||
        !JITI_ALIAS_ROOT_SENTINELS.has(target[candidateKey.length])
      ) {
        continue;
      }
      if (seenAliasKeys.has(candidateKey)) {
        return target;
      }
      seenAliasKeys.add(candidateKey);
      nextTarget = aliasMap[candidateKey] + target.slice(candidateKey.length);
      break;
    }
    if (!nextTarget || nextTarget === target) {
      break;
    }
    target = nextTarget;
  }
  return target;
}

function normalizePluginLoaderAliasMapForJiti(
  aliasMap: Record<string, string>,
): Record<string, string> {
  if (hasJitiNormalizedAliasMarker(aliasMap)) {
    return aliasMap;
  }
  const cachedByInput = normalizedJitiAliasMapByInput.get(aliasMap);
  if (cachedByInput) {
    return cachedByInput;
  }
  const cacheKey = createJitiAliasContentCacheKey(aliasMap);
  const cached = normalizedJitiAliasMapCache.get(cacheKey);
  if (cached) {
    normalizedJitiAliasMapByInput.set(aliasMap, cached);
    return cached;
  }
  const aliasDepth = new Map<string, number>();
  const getAliasDepth = (key: string) => {
    const cachedDepth = aliasDepth.get(key);
    if (cachedDepth !== undefined) {
      return cachedDepth;
    }
    const depth = key.split("/").length;
    aliasDepth.set(key, depth);
    return depth;
  };
  const normalizedAliasMap = Object.fromEntries(
    Object.entries(aliasMap).toSorted(
      ([left], [right]) => getAliasDepth(right) - getAliasDepth(left),
    ),
  );
  const aliasKeys = Object.keys(normalizedAliasMap);
  for (const aliasKey of aliasKeys) {
    const target = normalizedAliasMap[aliasKey];
    if (!target || isConcreteJitiAliasTarget(target)) {
      continue;
    }
    const resolvedTarget = resolveJitiAliasTarget(aliasKey, aliasKeys, normalizedAliasMap);
    if (resolvedTarget) {
      normalizedAliasMap[aliasKey] = resolvedTarget;
    }
  }
  Object.defineProperty(normalizedAliasMap, JITI_NORMALIZED_ALIAS_SYMBOL, {
    value: true,
    enumerable: false,
  });
  normalizedJitiAliasMapCache.set(cacheKey, normalizedAliasMap);
  normalizedJitiAliasMapByInput.set(aliasMap, normalizedAliasMap);
  return normalizedAliasMap;
}

function buildPluginLoaderAliasMapCacheKey(params: {
  modulePath: string;
  argv1?: string;
  moduleUrl?: string;
  pluginSdkResolution: PluginSdkResolutionPreference;
}) {
  return [
    params.modulePath,
    params.argv1 ?? "",
    params.moduleUrl ?? "",
    params.pluginSdkResolution,
    process.cwd(),
    process.env.NODE_ENV === "production" ? "production" : "non-production",
    shouldIncludePrivateLocalOnlyPluginSdkSubpaths() ? "private-qa" : "public",
  ].join("\0");
}

function buildPluginLoaderJitiConfigCacheKey(params: {
  modulePath: string;
  argv1?: string;
  moduleUrl: string;
  preferBuiltDist?: boolean;
  pluginSdkResolution?: PluginSdkResolutionPreference;
}) {
  return [
    buildPluginLoaderAliasMapCacheKey({
      modulePath: params.modulePath,
      argv1: params.argv1,
      moduleUrl: params.moduleUrl,
      pluginSdkResolution: params.pluginSdkResolution ?? "auto",
    }),
    params.preferBuiltDist === true ? "prefer-built-dist" : "default-dist",
  ].join("\0");
}

export function buildPluginLoaderAliasMap(
  modulePath: string,
  argv1: string | undefined = STARTUP_ARGV1,
  moduleUrl?: string,
  pluginSdkResolution: PluginSdkResolutionPreference = "auto",
): Record<string, string> {
  const cacheKey = buildPluginLoaderAliasMapCacheKey({
    modulePath,
    argv1,
    moduleUrl,
    pluginSdkResolution,
  });
  const cached = aliasMapCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pluginSdkAlias = resolvePluginSdkAliasFile({
    srcFile: "root-alias.cjs",
    distFile: "root-alias.cjs",
    modulePath,
    argv1,
    moduleUrl,
    pluginSdkResolution,
  });
  const extensionApiAlias = resolveExtensionApiAlias({ modulePath, pluginSdkResolution });
  const result: Record<string, string> = {
    ...(extensionApiAlias
      ? { "getkova/extension-api": normalizeJitiAliasTargetPath(extensionApiAlias) }
      : {}),
    ...resolveBundledPluginPackagePublicSurfaceAliasMap({
      modulePath,
      argv1,
      moduleUrl,
      pluginSdkResolution,
    }),
    ...(pluginSdkAlias
      ? Object.fromEntries(
          PLUGIN_SDK_PACKAGE_NAMES.map((packageName) => [
            packageName,
            normalizeJitiAliasTargetPath(pluginSdkAlias),
          ]),
        )
      : {}),
    ...Object.fromEntries(
      Object.entries(
        resolvePluginSdkScopedAliasMap({ modulePath, argv1, moduleUrl, pluginSdkResolution }),
      ).map(([key, value]) => [key, normalizeJitiAliasTargetPath(value)]),
    ),
  };
  aliasMapCache.set(cacheKey, result);
  return result;
}

export function resolvePluginRuntimeModulePath(
  params: LoaderModuleResolveParams = {},
): string | null {
  return resolvePluginRuntimeModulePathWithDiagnostics(params).resolvedPath;
}

export function resolvePluginRuntimeModulePathWithDiagnostics(
  params: LoaderModuleResolveParams = {},
): PluginRuntimeModuleResolution {
  let modulePath: string | undefined;
  let packageRoot: string | null = null;
  const candidates: string[] = [];
  try {
    modulePath = resolveLoaderModulePath(params);
    const orderedKinds = resolvePluginSdkAliasCandidateOrder({
      modulePath,
      isProduction: process.env.NODE_ENV === "production",
      pluginSdkResolution: params.pluginSdkResolution,
    });
    packageRoot = resolveLoaderPackageRoot({ ...params, modulePath });
    if (packageRoot) {
      appendPluginRuntimeModuleCandidates(candidates, packageRoot, orderedKinds);
    } else {
      const argv1 = params.argv1 ?? process.argv[1];
      candidates.push(
        ...listAncestorPluginRuntimeModuleCandidates({
          starts: listArgvRuntimeFallbackStartDirs(argv1),
          orderedKinds,
        }),
      );
      appendSiblingPluginRuntimeModuleCandidates(
        candidates,
        path.join(path.dirname(modulePath), "runtime"),
        orderedKinds,
      );
    }
    const dedupedCandidates = dedupeResolvedPaths(candidates);
    for (const candidate of dedupedCandidates) {
      if (fs.existsSync(candidate)) {
        return {
          modulePath,
          packageRoot,
          candidates: dedupedCandidates,
          resolvedPath: candidate,
        };
      }
    }
  } catch (error) {
    return {
      modulePath,
      packageRoot,
      candidates: dedupeResolvedPaths(candidates),
      resolvedPath: null,
      error: formatResolutionError(error),
    };
  }
  return {
    modulePath,
    packageRoot,
    candidates: dedupeResolvedPaths(candidates),
    resolvedPath: null,
  };
}

export function buildPluginLoaderJitiOptions(
  aliasMap: Record<string, string>,
  params: LoaderModuleResolveParams = {},
) {
  const hasAliases = Object.keys(aliasMap).length > 0;
  const jitiAliasMap = hasAliases ? normalizePluginLoaderAliasMapForJiti(aliasMap) : aliasMap;
  return {
    interopDefault: true,
    fsCache: resolvePluginLoaderJitiFsCacheOption(params),
    // Prefer Node's native sync ESM loader for built dist/*.js modules so
    // bundled plugins and plugin-sdk subpaths stay on the canonical module graph.
    tryNative: true,
    extensions: [".ts", ".tsx", ".mts", ".cts", ".mtsx", ".ctsx", ".js", ".mjs", ".cjs", ".json"],
    ...(hasAliases
      ? {
          alias: jitiAliasMap,
        }
      : {}),
  };
}

function supportsNativeJitiRuntime(): boolean {
  const versions = process.versions as { bun?: string };
  return typeof versions.bun !== "string";
}

function isBundledPluginDistModulePath(modulePath: string): boolean {
  return modulePath.replace(/\\/g, "/").includes("/dist/extensions/");
}

export function shouldPreferNativeJiti(modulePath: string): boolean {
  if (!supportsNativeJitiRuntime()) {
    return false;
  }
  switch (normalizeLowercaseStringOrEmpty(path.extname(modulePath))) {
    case ".js":
    case ".mjs":
    case ".cjs":
    case ".json":
      return true;
    default:
      return false;
  }
}

export function resolvePluginLoaderJitiTryNative(
  modulePath: string,
  options?: {
    preferBuiltDist?: boolean;
  },
): boolean {
  if (isBundledPluginDistModulePath(modulePath)) {
    return shouldPreferNativeJiti(modulePath);
  }
  return (
    shouldPreferNativeJiti(modulePath) ||
    (supportsNativeJitiRuntime() &&
      options?.preferBuiltDist === true &&
      modulePath.includes(`${path.sep}dist${path.sep}`))
  );
}

export function createPluginLoaderJitiCacheKey(params: {
  tryNative: boolean;
  aliasMap: Record<string, string>;
}): string {
  const aliasMapKey =
    pluginLoaderJitiCacheKeyByAliasMap.get(params.aliasMap) ??
    createJitiAliasContentCacheKey(params.aliasMap);
  pluginLoaderJitiCacheKeyByAliasMap.set(params.aliasMap, aliasMapKey);
  return `${params.tryNative ? "native" : "transform"}\0${aliasMapKey}`;
}

export function resolvePluginLoaderJitiConfig(params: {
  modulePath: string;
  argv1?: string;
  moduleUrl: string;
  preferBuiltDist?: boolean;
  pluginSdkResolution?: PluginSdkResolutionPreference;
}): {
  tryNative: boolean;
  aliasMap: Record<string, string>;
  cacheKey: string;
} {
  const configCacheKey = buildPluginLoaderJitiConfigCacheKey(params);
  const cached = pluginLoaderJitiConfigCache.get(configCacheKey);
  if (cached) {
    return cached;
  }

  const tryNative = resolvePluginLoaderJitiTryNative(
    params.modulePath,
    params.preferBuiltDist ? { preferBuiltDist: true } : {},
  );
  const aliasMap = buildPluginLoaderAliasMap(
    params.modulePath,
    params.argv1,
    params.moduleUrl,
    params.pluginSdkResolution,
  );
  const result = {
    tryNative,
    aliasMap,
    cacheKey: createPluginLoaderJitiCacheKey({
      tryNative,
      aliasMap,
    }),
  };
  pluginLoaderJitiConfigCache.set(configCacheKey, result);
  return result;
}

export function isBundledPluginExtensionPath(params: {
  modulePath: string;
  kovaPackageRoot: string;
  bundledPluginsDir?: string;
}): boolean {
  const normalizedModulePath = path.resolve(params.modulePath);
  const roots = [
    params.bundledPluginsDir ? path.resolve(params.bundledPluginsDir) : null,
    path.join(params.kovaPackageRoot, "extensions"),
    path.join(params.kovaPackageRoot, "dist", "extensions"),
    path.join(params.kovaPackageRoot, "dist-runtime", "extensions"),
  ].filter((root): root is string => typeof root === "string");
  return roots.some(
    (root) =>
      normalizedModulePath === root || normalizedModulePath.startsWith(`${root}${path.sep}`),
  );
}
