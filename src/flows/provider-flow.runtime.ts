import type { KovaConfig } from "../config/types.kova.js";
import {
  resolveProviderModelPickerEntries,
  type ProviderModelPickerEntry,
} from "../plugins/provider-wizard.js";
import { resolvePluginProviders } from "../plugins/providers.runtime.js";
import type { ProviderPlugin } from "../plugins/types.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import type { FlowContribution } from "./types.js";
import { sortFlowContributionsByLabel } from "./types.js";

export type ProviderModelPickerFlowEntry = ProviderModelPickerEntry;

export type ProviderModelPickerFlowContribution = FlowContribution & {
  kind: "provider";
  surface: "model-picker";
  providerId: string;
  option: ProviderModelPickerFlowEntry;
  source: "runtime";
};

function resolveProviderDocsById(params?: {
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  providerRefs?: readonly string[];
}): Map<string, string> {
  if (!params?.providerRefs?.length) {
    return new Map();
  }
  return new Map(
    resolvePluginProviders({
      config: params?.config,
      workspaceDir: params?.workspaceDir,
      env: params?.env,
      mode: "setup",
      providerRefs: params.providerRefs,
    })
      .filter((provider): provider is ProviderPlugin & { docsPath: string } =>
        Boolean(normalizeOptionalString(provider.docsPath)),
      )
      .map((provider) => [provider.id, normalizeOptionalString(provider.docsPath)!]),
  );
}

export function resolveProviderModelPickerFlowEntries(params?: {
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  providerRefs?: readonly string[];
}): ProviderModelPickerFlowEntry[] {
  return resolveProviderModelPickerFlowContributions(params).map(
    (contribution) => contribution.option,
  );
}

export function resolveProviderModelPickerFlowContributions(params?: {
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  providerRefs?: readonly string[];
}): ProviderModelPickerFlowContribution[] {
  const entries = resolveProviderModelPickerEntries(params ?? {});
  if (entries.length === 0) {
    return [];
  }
  const docsByProvider = resolveProviderDocsById(params ?? {});
  return sortFlowContributionsByLabel(
    entries.map((entry) => {
      const providerId = entry.value.startsWith("provider-plugin:")
        ? entry.value.slice("provider-plugin:".length).split(":")[0]
        : entry.value;
      return {
        id: `provider:model-picker:${entry.value}`,
        kind: "provider" as const,
        surface: "model-picker" as const,
        providerId,
        option: {
          value: entry.value,
          label: entry.label,
          ...(entry.hint ? { hint: entry.hint } : {}),
          ...(docsByProvider.get(providerId)
            ? { docs: { path: docsByProvider.get(providerId)! } }
            : {}),
        },
        source: "runtime" as const,
      };
    }),
  );
}
