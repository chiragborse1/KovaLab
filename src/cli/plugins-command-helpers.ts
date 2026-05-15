import type { KovaConfig } from "../config/types.kova.js";
import { parseRegistryNpmSpec } from "../infra/npm-registry-spec.js";
import { KOVAHUB_INSTALL_ERROR_CODE } from "../plugins/kovahub.js";
import { applyExclusiveSlotSelection } from "../plugins/slots.js";
import { buildPluginDiagnosticsReport } from "../plugins/status.js";
import { defaultRuntime } from "../runtime.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { theme } from "../terminal/theme.js";

type HookInternalEntryLike = Record<string, unknown> & { enabled?: boolean };

export function resolveFileNpmSpecToLocalPath(
  raw: string,
): { ok: true; path: string } | { ok: false; error: string } | null {
  const trimmed = raw.trim();
  if (!normalizeLowercaseStringOrEmpty(trimmed).startsWith("file:")) {
    return null;
  }
  const rest = trimmed.slice("file:".length);
  if (!rest) {
    return { ok: false, error: "unsupported file: spec: missing path" };
  }
  if (rest.startsWith("///")) {
    return { ok: true, path: rest.slice(2) };
  }
  if (rest.startsWith("//localhost/")) {
    return { ok: true, path: rest.slice("//localhost".length) };
  }
  if (rest.startsWith("//")) {
    return {
      ok: false,
      error: 'unsupported file: URL host (expected "file:<path>" or "file:///abs/path")',
    };
  }
  return { ok: true, path: rest };
}

export function applySlotSelectionForPlugin(
  config: KovaConfig,
  pluginId: string,
): { config: KovaConfig; warnings: string[] } {
  const report = buildPluginDiagnosticsReport({ config });
  const plugin = report.plugins.find((entry) => entry.id === pluginId);
  if (!plugin) {
    return { config, warnings: [] };
  }
  const result = applyExclusiveSlotSelection({
    config,
    selectedId: plugin.id,
    selectedKind: plugin.kind,
    registry: report,
  });
  return { config: result.config, warnings: result.warnings };
}

export function createPluginInstallLogger(): {
  info: (msg: string) => void;
  warn: (msg: string) => void;
} {
  return {
    info: (msg) => defaultRuntime.log(msg),
    warn: (msg) => defaultRuntime.log(theme.warn(msg)),
  };
}

export function createHookPackInstallLogger(): {
  info: (msg: string) => void;
  warn: (msg: string) => void;
} {
  return {
    info: (msg) => defaultRuntime.log(msg),
    warn: (msg) => defaultRuntime.log(theme.warn(msg)),
  };
}

export function enableInternalHookEntries(config: KovaConfig, hookNames: string[]): KovaConfig {
  const entries = { ...config.hooks?.internal?.entries } as Record<string, HookInternalEntryLike>;

  for (const hookName of hookNames) {
    entries[hookName] = {
      ...entries[hookName],
      enabled: true,
    };
  }

  return {
    ...config,
    hooks: {
      ...config.hooks,
      internal: {
        ...config.hooks?.internal,
        enabled: true,
        entries,
      },
    },
  };
}

export function formatPluginInstallWithHookFallbackError(
  pluginError: string,
  hookError: string,
): string {
  if (/plugin already exists: .+ \(delete it first\)/.test(pluginError)) {
    return `${pluginError}\nUse \`kova plugins update <id-or-npm-spec>\` to upgrade the tracked plugin, or rerun install with \`--force\` to replace it.`;
  }
  return `${pluginError}\nAlso not a valid hook pack: ${hookError}`;
}

export function logHookPackRestartHint() {
  defaultRuntime.log("Restart the gateway to load hooks.");
}

export function logSlotWarnings(warnings: string[]) {
  if (warnings.length === 0) {
    return;
  }
  for (const warning of warnings) {
    defaultRuntime.log(theme.warn(warning));
  }
}

export function buildPreferredKovaHubSpec(raw: string): string | null {
  const parsed = parseRegistryNpmSpec(raw);
  if (!parsed) {
    return null;
  }
  return `kovahub:${parsed.name}${parsed.selector ? `@${parsed.selector}` : ""}`;
}

export function parseNpmPrefixSpec(raw: string): string | null {
  const trimmed = raw.trim();
  if (!normalizeLowercaseStringOrEmpty(trimmed).startsWith("npm:")) {
    return null;
  }
  return trimmed.slice("npm:".length).trim();
}

export const PREFERRED_KOVAHUB_FALLBACK_DECISION = {
  FALLBACK_TO_NPM: "fallback_to_npm",
  STOP: "stop",
} as const;

export type PreferredKovaHubFallbackDecision =
  (typeof PREFERRED_KOVAHUB_FALLBACK_DECISION)[keyof typeof PREFERRED_KOVAHUB_FALLBACK_DECISION];

export function decidePreferredKovaHubFallback(params: {
  code?: string;
}): PreferredKovaHubFallbackDecision {
  if (
    params.code === KOVAHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND ||
    params.code === KOVAHUB_INSTALL_ERROR_CODE.VERSION_NOT_FOUND
  ) {
    return PREFERRED_KOVAHUB_FALLBACK_DECISION.FALLBACK_TO_NPM;
  }
  return PREFERRED_KOVAHUB_FALLBACK_DECISION.STOP;
}
