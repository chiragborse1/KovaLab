import { DEFAULT_PROVIDER } from "../agents/defaults.js";
import { normalizeProviderId } from "../agents/model-selection.js";
import type { KovaConfig } from "../config/types.kova.js";
import {
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { resolveManifestProviderAuthChoices } from "./provider-auth-choices.js";
import { resolvePluginProviders } from "./providers.runtime.js";
import { resolvePluginSetupProvider } from "./setup-registry.js";
import type {
  ProviderAuthMethod,
  ProviderPlugin,
  ProviderPluginWizardModelPicker,
  ProviderPluginWizardSetup,
} from "./types.js";

export const PROVIDER_PLUGIN_CHOICE_PREFIX = "provider-plugin:";

export type ProviderWizardOption = {
  value: string;
  label: string;
  hint?: string;
  groupId: string;
  groupLabel: string;
  groupHint?: string;
  onboardingScopes?: Array<"text-inference" | "image-generation">;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
};

export type ProviderModelPickerEntry = {
  value: string;
  label: string;
  hint?: string;
};

function resolveWizardSetupChoiceId(
  provider: ProviderPlugin,
  wizard: ProviderPluginWizardSetup,
): string {
  const explicit = normalizeOptionalString(wizard.choiceId);
  if (explicit) {
    return explicit;
  }
  const explicitMethodId = normalizeOptionalString(wizard.methodId);
  if (explicitMethodId) {
    return buildProviderPluginMethodChoice(provider.id, explicitMethodId);
  }
  if (provider.auth.length === 1) {
    return provider.id;
  }
  return buildProviderPluginMethodChoice(provider.id, provider.auth[0]?.id ?? "default");
}

function resolveMethodById(
  provider: ProviderPlugin,
  methodId?: string,
): ProviderAuthMethod | undefined {
  const normalizedMethodId = normalizeOptionalLowercaseString(methodId);
  if (!normalizedMethodId) {
    return provider.auth[0];
  }
  return provider.auth.find(
    (method) => normalizeOptionalLowercaseString(method.id) === normalizedMethodId,
  );
}

function listMethodWizardSetups(provider: ProviderPlugin): Array<{
  method: ProviderAuthMethod;
  wizard: ProviderPluginWizardSetup;
}> {
  return provider.auth
    .map((method) => (method.wizard ? { method, wizard: method.wizard } : null))
    .filter((entry): entry is { method: ProviderAuthMethod; wizard: ProviderPluginWizardSetup } =>
      Boolean(entry),
    );
}

function buildSetupOptionForMethod(params: {
  provider: ProviderPlugin;
  wizard: ProviderPluginWizardSetup;
  method: ProviderAuthMethod;
  value: string;
}): ProviderWizardOption {
  const normalizedGroupId = normalizeOptionalString(params.wizard.groupId) || params.provider.id;
  return {
    value: normalizeOptionalString(params.value) ?? "",
    label:
      normalizeOptionalString(params.wizard.choiceLabel) ||
      (params.provider.auth.length === 1 ? params.provider.label : params.method.label),
    hint: normalizeOptionalString(params.wizard.choiceHint) || params.method.hint,
    groupId: normalizedGroupId,
    groupLabel: normalizeOptionalString(params.wizard.groupLabel) || params.provider.label,
    groupHint: normalizeOptionalString(params.wizard.groupHint),
    ...(params.wizard.onboardingScopes ? { onboardingScopes: params.wizard.onboardingScopes } : {}),
    ...(typeof params.wizard.assistantPriority === "number" &&
    Number.isFinite(params.wizard.assistantPriority)
      ? { assistantPriority: params.wizard.assistantPriority }
      : {}),
    ...(params.wizard.assistantVisibility
      ? { assistantVisibility: params.wizard.assistantVisibility }
      : {}),
  };
}

export function buildProviderPluginMethodChoice(providerId: string, methodId: string): string {
  return `${PROVIDER_PLUGIN_CHOICE_PREFIX}${normalizeOptionalString(providerId) ?? ""}:${normalizeOptionalString(methodId) ?? ""}`;
}

function resolveProviderWizardProviders(params: {
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  providerRefs?: readonly string[];
}): ProviderPlugin[] {
  return resolvePluginProviders({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    mode: "setup",
    ...(params.providerRefs ? { providerRefs: params.providerRefs } : {}),
  });
}

export function resolveProviderWizardOptions(params: {
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): ProviderWizardOption[] {
  return resolveManifestProviderAuthChoices({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    includeUntrustedWorkspacePlugins: false,
  }).map((choice) => ({
    value: choice.choiceId,
    label: choice.choiceLabel,
    ...(choice.choiceHint ? { hint: choice.choiceHint } : {}),
    groupId: choice.groupId ?? choice.providerId,
    groupLabel: choice.groupLabel ?? choice.choiceLabel,
    ...(choice.groupHint ? { groupHint: choice.groupHint } : {}),
    ...(choice.onboardingScopes ? { onboardingScopes: choice.onboardingScopes } : {}),
    ...(typeof choice.assistantPriority === "number"
      ? { assistantPriority: choice.assistantPriority }
      : {}),
    ...(choice.assistantVisibility ? { assistantVisibility: choice.assistantVisibility } : {}),
  }));
}

function resolveModelPickerChoiceValue(
  provider: ProviderPlugin,
  modelPicker: ProviderPluginWizardModelPicker,
): string {
  const explicitMethodId = normalizeOptionalString(modelPicker.methodId);
  if (explicitMethodId) {
    return buildProviderPluginMethodChoice(provider.id, explicitMethodId);
  }
  if (provider.auth.length === 1) {
    return provider.id;
  }
  return buildProviderPluginMethodChoice(provider.id, provider.auth[0]?.id ?? "default");
}

export function resolveProviderModelPickerEntries(params: {
  config?: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  providerRefs?: readonly string[];
}): ProviderModelPickerEntry[] {
  if (!params.providerRefs?.length) {
    return [];
  }
  const setupProviders = params.providerRefs
    .map((provider) =>
      resolvePluginSetupProvider({
        provider,
        config: params.config,
        workspaceDir: params.workspaceDir,
        env: params.env,
      }),
    )
    .filter((provider): provider is ProviderPlugin => Boolean(provider));
  const providers = setupProviders;
  const entries: ProviderModelPickerEntry[] = [];

  for (const provider of providers) {
    const modelPicker = provider.wizard?.modelPicker;
    if (!modelPicker) {
      continue;
    }
    entries.push({
      value: resolveModelPickerChoiceValue(provider, modelPicker),
      label: normalizeOptionalString(modelPicker.label) || `${provider.label} (custom)`,
      hint: normalizeOptionalString(modelPicker.hint),
    });
  }

  return entries;
}

export function resolveProviderPluginChoice(params: {
  providers: ProviderPlugin[];
  choice: string;
}): {
  provider: ProviderPlugin;
  method: ProviderAuthMethod;
  wizard?: ProviderPluginWizardSetup;
} | null {
  const choice = normalizeOptionalString(params.choice) ?? "";
  if (!choice) {
    return null;
  }

  if (choice.startsWith(PROVIDER_PLUGIN_CHOICE_PREFIX)) {
    const payload = choice.slice(PROVIDER_PLUGIN_CHOICE_PREFIX.length);
    const separator = payload.indexOf(":");
    const providerId = separator >= 0 ? payload.slice(0, separator) : payload;
    const methodId = separator >= 0 ? payload.slice(separator + 1) : undefined;
    const provider = params.providers.find(
      (entry) => normalizeProviderId(entry.id) === normalizeProviderId(providerId),
    );
    if (!provider) {
      return null;
    }
    const method = resolveMethodById(provider, methodId);
    return method ? { provider, method } : null;
  }

  for (const provider of params.providers) {
    for (const { method, wizard } of listMethodWizardSetups(provider)) {
      const choiceId =
        normalizeOptionalString(wizard.choiceId) ||
        buildProviderPluginMethodChoice(provider.id, method.id);
      if ((normalizeOptionalString(choiceId) ?? "") === choice) {
        return { provider, method, wizard };
      }
    }
    const setup = provider.wizard?.setup;
    if (setup) {
      const setupChoiceId = resolveWizardSetupChoiceId(provider, setup);
      if ((normalizeOptionalString(setupChoiceId) ?? "") === choice) {
        const method = resolveMethodById(provider, setup.methodId);
        if (method) {
          return { provider, method, wizard: setup };
        }
      }
    }
    if (
      normalizeProviderId(provider.id) === normalizeProviderId(choice) &&
      provider.auth.length > 0
    ) {
      return { provider, method: provider.auth[0] };
    }
  }

  return null;
}

export async function runProviderModelSelectedHook(params: {
  config: KovaConfig;
  model: string;
  prompter: WizardPrompter;
  agentDir?: string;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const rawModel = params.model.trim();
  if (!rawModel) {
    return;
  }
  const slashIndex = rawModel.indexOf("/");
  const selectedProviderId =
    slashIndex === -1
      ? DEFAULT_PROVIDER
      : normalizeProviderId(rawModel.slice(0, slashIndex).trim());
  if (!selectedProviderId || (slashIndex !== -1 && !rawModel.slice(slashIndex + 1).trim())) {
    return;
  }

  const setupProvider = resolvePluginSetupProvider({
    provider: selectedProviderId,
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  });
  const provider =
    setupProvider ??
    resolveProviderWizardProviders({
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
      providerRefs: [selectedProviderId],
    }).find((entry) => normalizeProviderId(entry.id) === selectedProviderId);
  if (!provider?.onModelSelected) {
    return;
  }

  await provider.onModelSelected({
    config: params.config,
    model: params.model,
    prompter: params.prompter,
    agentDir: params.agentDir,
    workspaceDir: params.workspaceDir,
  });
}
