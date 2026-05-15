import fs from "node:fs";
import path from "node:path";
import { normalizeChatChannelId } from "../channels/ids.js";
import { resolveBundledInstallPlanForCatalogEntry } from "../cli/plugin-install-plan.js";
import type { KovaConfig } from "../config/types.kova.js";
import { isPrereleaseSemverVersion, parseRegistryNpmSpec } from "../infra/npm-registry-spec.js";
import {
  findBundledPluginSourceInMap,
  resolveBundledPluginSources,
} from "../plugins/bundled-sources.js";
import { enablePluginInConfig, type PluginEnableResult } from "../plugins/enable.js";
import { installPluginFromNpmSpec, resolvePluginInstallDir } from "../plugins/install.js";
import { buildNpmResolutionInstallFields, recordPluginInstall } from "../plugins/installs.js";
import type { PluginPackageInstall } from "../plugins/manifest.js";
import type { RuntimeEnv } from "../runtime.js";
import { sanitizeTerminalText } from "../terminal/safe-text.js";
import { withTimeout } from "../utils/with-timeout.js";
import { VERSION } from "../version.js";
import type { WizardPrompter } from "../wizard/prompts.js";

type InstallChoice = "npm" | "local" | "skip";
const ONBOARDING_PLUGIN_INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
const ONBOARDING_PLUGIN_INSTALL_WATCHDOG_TIMEOUT_MS = ONBOARDING_PLUGIN_INSTALL_TIMEOUT_MS + 5_000;

export type OnboardingPluginInstallEntry = {
  pluginId: string;
  label: string;
  install: PluginPackageInstall;
};

export type OnboardingPluginInstallStatus = "installed" | "skipped" | "failed" | "timed_out";

export type OnboardingPluginInstallResult = {
  cfg: KovaConfig;
  installed: boolean;
  pluginId: string;
  status: OnboardingPluginInstallStatus;
};

function resolveRealDirectory(dir: string): string | null {
  try {
    const resolved = fs.realpathSync(dir);
    return fs.statSync(resolved).isDirectory() ? resolved : null;
  } catch {
    return null;
  }
}

function resolveGitDirectoryMarker(dir: string): string | null {
  const marker = path.join(dir, ".git");
  try {
    const stat = fs.statSync(marker);
    if (stat.isDirectory()) {
      return resolveRealDirectory(marker);
    }
    if (!stat.isFile()) {
      return null;
    }
    const content = fs.readFileSync(marker, "utf8").trim();
    const match = /^gitdir:\s*(.+)$/i.exec(content);
    if (!match) {
      return null;
    }
    const gitDir = match[1]?.trim();
    if (!gitDir) {
      return null;
    }
    return resolveRealDirectory(path.isAbsolute(gitDir) ? gitDir : path.resolve(dir, gitDir));
  } catch {
    return null;
  }
}

function isWithinBaseDirectory(baseDir: string, targetPath: string): boolean {
  const relative = path.relative(baseDir, targetPath);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) && !relative.startsWith(`..${path.sep}`) && relative !== "..")
  );
}

function hasTrustedGitWorkspace(root: string): boolean {
  const realRoot = resolveRealDirectory(root);
  if (!realRoot) {
    return false;
  }
  for (let dir = realRoot; ; dir = path.dirname(dir)) {
    if (resolveGitDirectoryMarker(dir)) {
      return true;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return false;
    }
  }
}

function hasGitWorkspace(workspaceDir?: string): boolean {
  const roots = [process.cwd()];
  if (workspaceDir && workspaceDir !== process.cwd()) {
    roots.push(workspaceDir);
  }
  return roots.some((root) => hasTrustedGitWorkspace(root));
}

function addPluginLoadPath(cfg: KovaConfig, pluginPath: string): KovaConfig {
  const existing = cfg.plugins?.load?.paths ?? [];
  const merged = Array.from(new Set([...existing, pluginPath]));
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      load: {
        ...cfg.plugins?.load,
        paths: merged,
      },
    },
  };
}

function pathsReferToSameDirectory(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }
  const realLeft = resolveRealDirectory(left);
  const realRight = resolveRealDirectory(right);
  return Boolean(realLeft && realRight && realLeft === realRight);
}

function formatPortableLocalPath(localPath: string, workspaceDir?: string): string | undefined {
  const bases = [workspaceDir, process.cwd()].filter((entry): entry is string => Boolean(entry));
  for (const base of bases) {
    const realBase = resolveRealDirectory(base);
    if (!realBase) {
      continue;
    }
    const relative = path.relative(realBase, localPath);
    if (
      relative === "" ||
      (!path.isAbsolute(relative) && !relative.startsWith(`..${path.sep}`) && relative !== "..")
    ) {
      const portable = relative.split(path.sep).join("/");
      return portable ? `./${portable}` : ".";
    }
  }
  return undefined;
}

async function recordLocalPluginInstall(params: {
  cfg: KovaConfig;
  entry: OnboardingPluginInstallEntry;
  localPath: string;
  npmSpec?: string | null;
  workspaceDir?: string;
}): Promise<KovaConfig> {
  const sourcePath = formatPortableLocalPath(params.localPath, params.workspaceDir);
  const install = {
    pluginId: params.entry.pluginId,
    source: "path",
    ...(sourcePath ? { sourcePath } : {}),
    ...(params.npmSpec ? { spec: params.npmSpec } : {}),
  } as const;
  return recordPluginInstall(params.cfg, install);
}

function resolveLocalPath(params: {
  entry: OnboardingPluginInstallEntry;
  workspaceDir?: string;
  allowLocal: boolean;
}): string | null {
  if (!params.allowLocal) {
    return null;
  }
  const raw = params.entry.install.localPath?.trim();
  if (!raw) {
    return null;
  }
  const candidates = new Set<string>();
  const bases = [process.cwd()];
  if (params.workspaceDir && params.workspaceDir !== process.cwd()) {
    bases.push(params.workspaceDir);
  }
  for (const base of bases) {
    const realBase = resolveRealDirectory(base);
    if (!realBase) {
      continue;
    }
    candidates.add(path.resolve(realBase, raw));
  }
  for (const candidate of candidates) {
    try {
      const resolved = fs.realpathSync(candidate);
      if (
        !bases.some((base) => {
          const realBase = resolveRealDirectory(base);
          return realBase ? isWithinBaseDirectory(realBase, resolved) : false;
        })
      ) {
        continue;
      }
      if (fs.statSync(resolved).isDirectory()) {
        return resolved;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function resolveBundledLocalPath(params: {
  entry: OnboardingPluginInstallEntry;
  workspaceDir?: string;
}): string | null {
  const bundledSources = resolveBundledPluginSources({ workspaceDir: params.workspaceDir });
  const npmSpec = params.entry.install.npmSpec?.trim();
  if (npmSpec) {
    return (
      resolveBundledInstallPlanForCatalogEntry({
        pluginId: params.entry.pluginId,
        npmSpec,
        findBundledSource: (lookup) =>
          findBundledPluginSourceInMap({
            bundled: bundledSources,
            lookup,
          }),
      })?.bundledSource.localPath ?? null
    );
  }
  return (
    findBundledPluginSourceInMap({
      bundled: bundledSources,
      lookup: {
        kind: "pluginId",
        value: params.entry.pluginId,
      },
    })?.localPath ?? null
  );
}

function resolveExistingInstalledPluginDir(pluginId: string): string | null {
  try {
    const targetDir = resolvePluginInstallDir(pluginId);
    return fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory() ? targetDir : null;
  } catch {
    return null;
  }
}

function shouldUseBetaPluginSpec(cfg: KovaConfig): boolean {
  return cfg.update?.channel === "beta" || isPrereleaseSemverVersion(VERSION);
}

function resolveNpmSpecForOnboarding(
  install: PluginPackageInstall,
  cfg: KovaConfig,
): string | null {
  const npmSpec = install.npmSpec?.trim();
  if (!npmSpec) {
    return null;
  }
  const parsed = parseRegistryNpmSpec(npmSpec);
  if (!parsed) {
    return null;
  }
  if (
    shouldUseBetaPluginSpec(cfg) &&
    (parsed.selectorKind === "none" || parsed.selector === "latest")
  ) {
    return `${parsed.name}@beta`;
  }
  return npmSpec;
}

function resolveInstallDefaultChoice(params: {
  cfg: KovaConfig;
  entry: OnboardingPluginInstallEntry;
  localPath?: string | null;
  bundledLocalPath?: string | null;
  hasNpmSpec: boolean;
}): InstallChoice {
  const { cfg, entry, localPath, bundledLocalPath, hasNpmSpec } = params;
  if (!hasNpmSpec) {
    return localPath ? "local" : "skip";
  }
  if (!localPath) {
    return "npm";
  }
  if (bundledLocalPath) {
    return "local";
  }
  const updateChannel = cfg.update?.channel;
  if (updateChannel === "dev") {
    return "local";
  }
  if (updateChannel === "stable" || updateChannel === "beta") {
    return "npm";
  }
  const entryDefault = entry.install.defaultChoice;
  if (entryDefault === "local") {
    return "local";
  }
  if (entryDefault === "npm") {
    return "npm";
  }
  return "local";
}

async function promptInstallChoice(params: {
  cfg: KovaConfig;
  entry: OnboardingPluginInstallEntry;
  localPath?: string | null;
  defaultChoice: InstallChoice;
  prompter: WizardPrompter;
}): Promise<InstallChoice> {
  const npmSpec = resolveNpmSpecForOnboarding(params.entry.install, params.cfg);
  const safeLabel = sanitizeTerminalText(params.entry.label);
  const safeNpmSpec = npmSpec ? sanitizeTerminalText(npmSpec) : null;
  const safeLocalPath = params.localPath ? sanitizeTerminalText(params.localPath) : null;
  const options: Array<{ value: InstallChoice; label: string; hint?: string }> = [];
  if (safeNpmSpec) {
    options.push({
      value: "npm",
      label: `Download from npm (${safeNpmSpec})`,
    });
  }
  if (params.localPath) {
    options.push({
      value: "local",
      label: "Use local plugin path",
      ...(safeLocalPath ? { hint: safeLocalPath } : {}),
    });
  }
  options.push({ value: "skip", label: "Skip for now" });

  const initialValue =
    params.defaultChoice === "local" && !params.localPath
      ? npmSpec
        ? "npm"
        : "skip"
      : params.defaultChoice;

  return await params.prompter.select<InstallChoice>({
    message: `Install ${safeLabel} plugin?`,
    options,
    initialValue,
  });
}

function formatDurationLabel(timeoutMs: number): string {
  if (timeoutMs % 60_000 === 0) {
    const minutes = timeoutMs / 60_000;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const seconds = Math.round(timeoutMs / 1000);
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

function summarizeInstallError(message: string): string {
  const cleaned = sanitizeTerminalText(message)
    .replace(/^Install failed(?:\s*\([^)]*\))?\s*:?\s*/i, "")
    .trim();
  if (!cleaned) {
    return "Unknown install failure";
  }
  return cleaned.length > 180 ? `${cleaned.slice(0, 179)}…` : cleaned;
}

function resolvePluginAlreadyExistsInstallPath(error: string): string | null {
  const match = /^plugin already exists:\s+(.+?)\s+\(delete it first\)$/i.exec(error.trim());
  if (!match?.[1]) {
    return null;
  }
  return resolveRealDirectory(match[1]);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === "timeout";
}

async function applyPluginEnablement(params: {
  cfg: KovaConfig;
  pluginId: string;
  label: string;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
}): Promise<PluginEnableResult> {
  let enableResult = enablePluginInConfig(params.cfg, params.pluginId);
  if (!enableResult.enabled && enableResult.reason === "blocked by allowlist") {
    const resolvedId = normalizeChatChannelId(params.pluginId) ?? params.pluginId;
    const allow = params.cfg.plugins?.allow;
    if (Array.isArray(allow) && allow.length > 0) {
      const nextAllow = Array.from(new Set([...allow, params.pluginId, resolvedId]));
      enableResult = enablePluginInConfig(
        {
          ...params.cfg,
          plugins: {
            ...params.cfg.plugins,
            allow: nextAllow,
          },
        },
        params.pluginId,
      );
      if (enableResult.enabled) {
        await params.prompter.note(
          `Added ${sanitizeTerminalText(resolvedId)} to plugins.allow and enabled it.`,
          "Plugin install",
        );
        return enableResult;
      }
    }
  }
  if (enableResult.enabled) {
    return enableResult;
  }
  const safeLabel = sanitizeTerminalText(params.label);
  const reason = enableResult.reason ?? "plugin disabled";
  await params.prompter.note(`Cannot enable ${safeLabel}: ${reason}.`, "Plugin install");
  params.runtime.error?.(
    `Plugin install failed: ${sanitizeTerminalText(params.pluginId)} is disabled (${reason}).`,
  );
  return enableResult;
}

async function reuseExistingNpmPluginInstall(params: {
  cfg: KovaConfig;
  entry: OnboardingPluginInstallEntry;
  npmSpec: string;
  existingInstallPath: string;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
}): Promise<OnboardingPluginInstallResult> {
  const enableResult = await applyPluginEnablement({
    cfg: params.cfg,
    pluginId: params.entry.pluginId,
    label: params.entry.label,
    prompter: params.prompter,
    runtime: params.runtime,
  });
  if (!enableResult.enabled) {
    return {
      cfg: enableResult.config,
      installed: false,
      pluginId: params.entry.pluginId,
      status: "failed",
    };
  }
  await params.prompter.note(
    `Using existing ${sanitizeTerminalText(params.entry.label)} plugin install at ${sanitizeTerminalText(params.existingInstallPath)}.`,
    "Plugin install",
  );
  const next = recordPluginInstall(enableResult.config, {
    pluginId: params.entry.pluginId,
    source: "npm",
    spec: params.npmSpec,
    installPath: params.existingInstallPath,
  });
  return {
    cfg: next,
    installed: true,
    pluginId: params.entry.pluginId,
    status: "installed",
  };
}

async function installPluginFromNpmSpecWithProgress(params: {
  entry: OnboardingPluginInstallEntry;
  npmSpec: string;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
}): Promise<
  | { status: "timed_out" }
  | {
      status: "completed";
      result: Awaited<ReturnType<typeof installPluginFromNpmSpec>>;
    }
> {
  const safeLabel = sanitizeTerminalText(params.entry.label);
  const progress = params.prompter.progress(`Installing ${safeLabel} plugin…`);
  const updateProgress = (message: string) => {
    const next = sanitizeTerminalText(message).trim();
    if (!next) {
      return;
    }
    progress.update(next);
  };

  try {
    const result = await withTimeout(
      installPluginFromNpmSpec({
        spec: params.npmSpec,
        mode: "update",
        timeoutMs: ONBOARDING_PLUGIN_INSTALL_TIMEOUT_MS,
        expectedIntegrity: params.entry.install.expectedIntegrity,
        logger: {
          info: updateProgress,
          warn: (message) => {
            updateProgress(message);
            params.runtime.log?.(sanitizeTerminalText(message));
          },
        },
      }),
      ONBOARDING_PLUGIN_INSTALL_WATCHDOG_TIMEOUT_MS,
    );
    if (result.ok) {
      progress.stop(`Installed ${safeLabel} plugin`);
    } else {
      progress.stop(`Install failed: ${safeLabel}`);
    }
    return {
      status: "completed",
      result,
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      progress.stop(`Install timed out: ${safeLabel}`);
      return { status: "timed_out" };
    }
    progress.stop(`Install failed: ${safeLabel}`);
    return {
      status: "completed",
      result: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function ensureOnboardingPluginInstalled(params: {
  cfg: KovaConfig;
  entry: OnboardingPluginInstallEntry;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  workspaceDir?: string;
  promptInstall?: boolean;
  autoConfirmSingleSource?: boolean;
}): Promise<OnboardingPluginInstallResult> {
  const { entry, prompter, runtime, workspaceDir } = params;
  let next = params.cfg;
  const allowLocal = hasGitWorkspace(workspaceDir);
  const bundledLocalPath = resolveBundledLocalPath({ entry, workspaceDir });
  const localPath =
    bundledLocalPath ??
    resolveLocalPath({
      entry,
      workspaceDir,
      allowLocal,
    });
  const npmSpec = resolveNpmSpecForOnboarding(entry.install, next);
  const defaultChoice = resolveInstallDefaultChoice({
    cfg: next,
    entry,
    localPath,
    bundledLocalPath,
    hasNpmSpec: Boolean(npmSpec),
  });
  const installSources: InstallChoice[] = [
    ...(npmSpec ? (["npm"] as const) : []),
    ...(localPath ? (["local"] as const) : []),
  ];
  const choice =
    bundledLocalPath && localPath
      ? "local"
      : params.promptInstall === false
        ? defaultChoice
        : params.autoConfirmSingleSource && installSources.length === 1
          ? installSources[0]
          : await promptInstallChoice({
              cfg: next,
              entry,
              localPath,
              defaultChoice,
              prompter,
            });

  if (choice === "skip") {
    return {
      cfg: next,
      installed: false,
      pluginId: entry.pluginId,
      status: "skipped",
    };
  }

  if (choice === "local" && localPath) {
    const enableResult = await applyPluginEnablement({
      cfg: next,
      pluginId: entry.pluginId,
      label: entry.label,
      prompter,
      runtime,
    });
    if (!enableResult.enabled) {
      return {
        cfg: enableResult.config,
        installed: false,
        pluginId: entry.pluginId,
        status: "failed",
      };
    }
    if (pathsReferToSameDirectory(localPath, bundledLocalPath)) {
      return {
        cfg: enableResult.config,
        installed: true,
        pluginId: entry.pluginId,
        status: "installed",
      };
    }
    next = addPluginLoadPath(enableResult.config, localPath);
    next = await recordLocalPluginInstall({ cfg: next, entry, localPath, npmSpec, workspaceDir });
    return {
      cfg: next,
      installed: true,
      pluginId: entry.pluginId,
      status: "installed",
    };
  }

  if (!npmSpec) {
    await prompter.note(
      `No npm install source is available for ${sanitizeTerminalText(entry.label)}. Returning to selection.`,
      "Plugin install",
    );
    runtime.error?.(
      `Plugin install failed: no npm spec available for ${sanitizeTerminalText(entry.pluginId)}.`,
    );
    return {
      cfg: next,
      installed: false,
      pluginId: entry.pluginId,
      status: "failed",
    };
  }

  const existingInstallPath = resolveExistingInstalledPluginDir(entry.pluginId);
  if (existingInstallPath) {
    return await reuseExistingNpmPluginInstall({
      cfg: next,
      entry,
      npmSpec,
      existingInstallPath,
      prompter,
      runtime,
    });
  }

  const installOutcome = await installPluginFromNpmSpecWithProgress({
    entry,
    npmSpec,
    prompter,
    runtime,
  });

  if (installOutcome.status === "timed_out") {
    await prompter.note(
      [
        `Installing ${sanitizeTerminalText(npmSpec)} timed out after ${formatDurationLabel(ONBOARDING_PLUGIN_INSTALL_TIMEOUT_MS)}.`,
        "Returning to selection.",
      ].join("\n"),
      "Plugin install",
    );
    runtime.error?.(
      `Plugin install timed out after ${ONBOARDING_PLUGIN_INSTALL_TIMEOUT_MS}ms: ${sanitizeTerminalText(npmSpec)}`,
    );
    return {
      cfg: next,
      installed: false,
      pluginId: entry.pluginId,
      status: "timed_out",
    };
  }

  const { result } = installOutcome;

  if (result.ok) {
    const enableResult = await applyPluginEnablement({
      cfg: next,
      pluginId: result.pluginId,
      label: entry.label,
      prompter,
      runtime,
    });
    if (!enableResult.enabled) {
      return {
        cfg: enableResult.config,
        installed: false,
        pluginId: result.pluginId,
        status: "failed",
      };
    }
    next = enableResult.config;
    const install = {
      pluginId: result.pluginId,
      source: "npm",
      spec: npmSpec,
      installPath: result.targetDir,
      version: result.version,
      ...buildNpmResolutionInstallFields(result.npmResolution),
    } as const;
    next = recordPluginInstall(next, install);
    return {
      cfg: next,
      installed: true,
      pluginId: result.pluginId,
      status: "installed",
    };
  }

  const existingInstallPathFromError = resolvePluginAlreadyExistsInstallPath(result.error);
  if (existingInstallPathFromError) {
    return await reuseExistingNpmPluginInstall({
      cfg: next,
      entry,
      npmSpec,
      existingInstallPath: existingInstallPathFromError,
      prompter,
      runtime,
    });
  }

  await prompter.note(
    [
      `Failed to install ${sanitizeTerminalText(npmSpec)}: ${summarizeInstallError(result.error)}`,
      "Returning to selection.",
    ].join("\n"),
    "Plugin install",
  );

  if (localPath) {
    const fallback = await prompter.confirm({
      message: `Use local plugin path instead? (${sanitizeTerminalText(localPath)})`,
      initialValue: true,
    });
    if (fallback) {
      const enableResult = await applyPluginEnablement({
        cfg: next,
        pluginId: entry.pluginId,
        label: entry.label,
        prompter,
        runtime,
      });
      if (!enableResult.enabled) {
        return {
          cfg: enableResult.config,
          installed: false,
          pluginId: entry.pluginId,
          status: "failed",
        };
      }
      if (pathsReferToSameDirectory(localPath, bundledLocalPath)) {
        return {
          cfg: enableResult.config,
          installed: true,
          pluginId: entry.pluginId,
          status: "installed",
        };
      }
      next = addPluginLoadPath(enableResult.config, localPath);
      next = await recordLocalPluginInstall({ cfg: next, entry, localPath, npmSpec, workspaceDir });
      return {
        cfg: next,
        installed: true,
        pluginId: entry.pluginId,
        status: "installed",
      };
    }
  }

  runtime.error?.(`Plugin install failed: ${sanitizeTerminalText(result.error)}`);
  return {
    cfg: next,
    installed: false,
    pluginId: entry.pluginId,
    status: "failed",
  };
}
