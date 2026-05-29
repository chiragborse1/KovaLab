import { collectConfiguredAgentHarnessRuntimes } from "../agents/harness-runtimes.js";
import { normalizeProviderId } from "../agents/provider-id.js";
import { listPotentialConfiguredChannelIds } from "../channels/config-presence.js";
import type { KovaConfig } from "../config/types.kova.js";
import {
  DEFAULT_MEMORY_DREAMING_PLUGIN_ID,
  resolveMemoryDreamingConfig,
  resolveMemoryDreamingPluginConfig,
  resolveMemoryDreamingPluginId,
} from "../memory-host-sdk/dreaming.js";
import { planManifestModelCatalogRows } from "../model-catalog/manifest-planner.js";
import { buildModelCatalogMergeKey } from "../model-catalog/refs.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";
import { hasExplicitChannelConfig } from "./channel-presence-policy.js";
import { collectPluginConfigContractMatches } from "./config-contracts.js";
import { resolveEffectivePluginActivationState } from "./config-state.js";
import {
  collectConfiguredSpeechProviderIds,
  normalizeConfiguredSpeechProviderIdForStartup,
} from "./gateway-startup-speech-providers.js";
import type { InstalledPluginIndexRecord } from "./installed-plugin-index.js";
import { loadPluginManifestRegistryForInstalledIndex } from "./manifest-registry-installed.js";
import type { PluginManifestRecord, PluginManifestRegistry } from "./manifest-registry.js";
import {
  isPluginMetadataSnapshotCompatible,
  loadPluginMetadataSnapshot,
  type PluginMetadataSnapshot,
} from "./plugin-metadata-snapshot.js";
import {
  createPluginRegistryIdNormalizer,
  normalizePluginsConfigWithRegistry,
} from "./plugin-registry-contributions.js";
import { loadPluginRegistrySnapshot } from "./plugin-registry-snapshot.js";

export type GatewayStartupPluginPlan = {
  channelPluginIds: readonly string[];
  configuredDeferredChannelPluginIds: readonly string[];
  pluginIds: readonly string[];
};

type NormalizedPluginsConfig = ReturnType<typeof normalizePluginsConfigWithRegistry>;
type GenerationProviderContractKey =
  | "imageGenerationProviders"
  | "videoGenerationProviders"
  | "musicGenerationProviders";
type VoiceProviderContractKey =
  | "speechProviders"
  | "realtimeTranscriptionProviders"
  | "realtimeVoiceProviders";
type ConfiguredGenerationProviderIds = Record<GenerationProviderContractKey, ReadonlySet<string>>;
type ConfiguredVoiceProviderIds = Record<VoiceProviderContractKey, ReadonlySet<string>>;
const CORE_BUILT_IN_MODEL_APIS = new Set([
  "anthropic-messages",
  "azure-openai-responses",
  "google-generative-ai",
  "google-vertex",
  "mistral-conversations",
  "openai-codex-responses",
  "openai-completions",
  "openai-responses",
]);

function listDisabledChannelIds(config: KovaConfig): Set<string> {
  const channels = config.channels;
  if (!channels || typeof channels !== "object" || Array.isArray(channels)) {
    return new Set();
  }
  return new Set(
    Object.entries(channels)
      .filter(([, value]) => {
        return (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          (value as { enabled?: unknown }).enabled === false
        );
      })
      .map(([channelId]) => normalizeOptionalLowercaseString(channelId))
      .filter((channelId): channelId is string => Boolean(channelId)),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isConfigActivationValueEnabled(value: unknown): boolean {
  if (value === false) {
    return false;
  }
  if (isRecord(value) && value.enabled === false) {
    return false;
  }
  return true;
}

function listPotentialEnabledChannelIds(config: KovaConfig, env: NodeJS.ProcessEnv): string[] {
  const disabled = listDisabledChannelIds(config);
  return listPotentialConfiguredChannelIds(config, env, { includePersistedAuthState: false })
    .map((id) => normalizeOptionalLowercaseString(id) ?? "")
    .filter((id) => id && !disabled.has(id));
}

function isGatewayStartupMemoryPlugin(plugin: InstalledPluginIndexRecord): boolean {
  return plugin.startup.memory;
}

function isGatewayStartupSidecar(plugin: InstalledPluginIndexRecord): boolean {
  return plugin.startup.sidecar;
}

function resolveGatewayStartupDreamingPluginIds(config: KovaConfig): Set<string> {
  const dreamingConfig = resolveMemoryDreamingConfig({
    pluginConfig: resolveMemoryDreamingPluginConfig(config),
    cfg: config,
  });
  if (!dreamingConfig.enabled) {
    return new Set();
  }
  return new Set([DEFAULT_MEMORY_DREAMING_PLUGIN_ID, resolveMemoryDreamingPluginId(config)]);
}

function resolveMemorySlotStartupPluginId(params: {
  activationSourceConfig: KovaConfig;
  activationSourcePlugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  normalizePluginId: (pluginId: string) => string;
}): string | undefined {
  const { activationSourceConfig, activationSourcePlugins, normalizePluginId } = params;
  const configuredSlot = activationSourceConfig.plugins?.slots?.memory?.trim();
  if (configuredSlot?.toLowerCase() === "none") {
    return undefined;
  }
  if (!configuredSlot) {
    const defaultSlot = activationSourcePlugins.slots.memory;
    if (typeof defaultSlot !== "string") {
      return undefined;
    }
    if (
      activationSourcePlugins.allow.length > 0 &&
      !activationSourcePlugins.allow.includes(defaultSlot)
    ) {
      return undefined;
    }
    return defaultSlot;
  }
  return normalizePluginId(configuredSlot);
}

function resolveContextEngineSlotStartupPluginId(params: {
  activationSourceConfig: KovaConfig;
  activationSourcePlugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  normalizePluginId: (pluginId: string) => string;
}): string | undefined {
  const { activationSourceConfig, activationSourcePlugins, normalizePluginId } = params;
  const configuredSlot = activationSourceConfig.plugins?.slots?.contextEngine?.trim();
  if (!configuredSlot) {
    return undefined;
  }
  const normalized = normalizePluginId(configuredSlot);
  if (normalized === "legacy") {
    return undefined;
  }
  if (activationSourcePlugins.deny.includes(normalized)) {
    return undefined;
  }
  if (activationSourcePlugins.entries[normalized]?.enabled === false) {
    return undefined;
  }
  return normalized;
}

function shouldConsiderForGatewayStartup(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  startupDreamingPluginIds: ReadonlySet<string>;
  memorySlotStartupPluginId?: string;
  contextEngineSlotStartupPluginId?: string;
}): boolean {
  if (params.manifest?.activation?.onStartup === true || isGatewayStartupSidecar(params.plugin)) {
    return true;
  }
  if (params.contextEngineSlotStartupPluginId === params.plugin.pluginId) {
    return true;
  }
  if (!isGatewayStartupMemoryPlugin(params.plugin)) {
    return false;
  }
  if (params.startupDreamingPluginIds.has(params.plugin.pluginId)) {
    return true;
  }
  return params.memorySlotStartupPluginId === params.plugin.pluginId;
}

function hasConfiguredStartupChannel(params: {
  plugin: InstalledPluginIndexRecord;
  manifestRegistry: PluginManifestRegistry;
  configuredChannelIds: ReadonlySet<string>;
}): boolean {
  return listManifestChannelIds(params.manifestRegistry, params.plugin.pluginId).some((channelId) =>
    params.configuredChannelIds.has(channelId),
  );
}

function listManifestChannelIds(
  manifestRegistry: PluginManifestRegistry,
  pluginId: string,
): readonly string[] {
  return manifestRegistry.plugins.find((plugin) => plugin.id === pluginId)?.channels ?? [];
}

function findManifestPlugin(
  manifestRegistry: PluginManifestRegistry,
  pluginId: string,
): PluginManifestRecord | undefined {
  return manifestRegistry.plugins.find((plugin) => plugin.id === pluginId);
}

function hasConfiguredActivationPath(params: {
  manifest: PluginManifestRecord | undefined;
  config: KovaConfig;
}): boolean {
  const paths = params.manifest?.activation?.onConfigPaths;
  if (!paths?.length) {
    return false;
  }
  return paths.some((pathPattern) =>
    collectPluginConfigContractMatches({
      root: params.config,
      pathPattern,
    }).some((match) => isConfigActivationValueEnabled(match.value)),
  );
}

function manifestOwnsConfiguredSpeechProvider(params: {
  manifest: PluginManifestRecord | undefined;
  configuredSpeechProviderIds: ReadonlySet<string>;
}): boolean {
  if (params.configuredSpeechProviderIds.size === 0) {
    return false;
  }
  return (params.manifest?.contracts?.speechProviders ?? []).some((providerId) => {
    const normalized = normalizeConfiguredSpeechProviderIdForStartup(providerId);
    return normalized ? params.configuredSpeechProviderIds.has(normalized) : false;
  });
}

function collectConfiguredWebSearchProviderIds(config: KovaConfig): ReadonlySet<string> {
  const search = config.tools?.web?.search;
  if (search?.enabled === false || typeof search?.provider !== "string") {
    return new Set();
  }
  const providerId = normalizeOptionalLowercaseString(search.provider);
  return providerId ? new Set([providerId]) : new Set();
}

function manifestOwnsConfiguredWebSearchProvider(params: {
  manifest: PluginManifestRecord | undefined;
  configuredWebSearchProviderIds: ReadonlySet<string>;
}): boolean {
  if (params.configuredWebSearchProviderIds.size === 0) {
    return false;
  }
  return (params.manifest?.contracts?.webSearchProviders ?? []).some((providerId) => {
    const normalized = normalizeOptionalLowercaseString(providerId);
    return normalized ? params.configuredWebSearchProviderIds.has(normalized) : false;
  });
}

function listModelProviderRefs(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (!isRecord(value)) {
    return [];
  }
  const refs: string[] = [];
  if (typeof value.primary === "string") {
    refs.push(value.primary);
  }
  if (Array.isArray(value.fallbacks)) {
    for (const fallback of value.fallbacks) {
      if (typeof fallback === "string") {
        refs.push(fallback);
      }
    }
  }
  return refs;
}

function listModelProviderRefParts(value: unknown): Array<{ providerId: string; modelId: string }> {
  return listModelProviderRefs(value)
    .map((ref) => {
      const slashIndex = ref.indexOf("/");
      if (slashIndex <= 0 || slashIndex >= ref.length - 1) {
        return undefined;
      }
      return {
        providerId: normalizeProviderId(ref.slice(0, slashIndex)),
        modelId: ref.slice(slashIndex + 1).trim(),
      };
    })
    .filter((entry): entry is { providerId: string; modelId: string } =>
      Boolean(entry?.providerId && entry.modelId),
    );
}

function collectModelProviderIds(value: unknown): ReadonlySet<string> {
  return new Set(
    listModelProviderRefs(value)
      .map((ref) => {
        const slashIndex = ref.indexOf("/");
        return slashIndex > 0 ? normalizeProviderId(ref.slice(0, slashIndex)) : "";
      })
      .filter((providerId): providerId is string => Boolean(providerId)),
  );
}

type ManifestModelProviderLookup = {
  modelApis: ReadonlyMap<string, string>;
  providerIds: ReadonlySet<string>;
};

function buildManifestModelProviderLookup(
  manifestRegistry: PluginManifestRegistry,
): ManifestModelProviderLookup {
  const modelApis = new Map(
    planManifestModelCatalogRows({ registry: manifestRegistry }).rows.flatMap((row) =>
      row.api ? [[row.mergeKey, row.api] as const] : [],
    ),
  );
  return {
    modelApis,
    providerIds: new Set(
      manifestRegistry.plugins.flatMap((plugin) => plugin.providers.map(normalizeProviderId)),
    ),
  };
}

function collectConfiguredAgentModelProviderIds(
  config: KovaConfig,
  manifestRegistry: PluginManifestRegistry,
): ReadonlySet<string> {
  const modelIdsByProvider = new Map<string, Set<string>>();
  const manifestModelProviders = buildManifestModelProviderLookup(manifestRegistry);
  const addModelProviderRefs = (value: unknown) => {
    for (const { providerId, modelId } of listModelProviderRefParts(value)) {
      const modelIds = modelIdsByProvider.get(providerId) ?? new Set<string>();
      modelIds.add(modelId);
      modelIdsByProvider.set(providerId, modelIds);
    }
  };
  const addModelMapProviderIds = (models: unknown) => {
    if (!isRecord(models)) {
      return;
    }
    for (const modelRef of Object.keys(models)) {
      addModelProviderRefs(modelRef);
    }
  };

  const defaults = config.agents?.defaults;
  addModelProviderRefs(defaults?.model);
  addModelMapProviderIds(defaults?.models);

  const agents = Array.isArray(config.agents?.list) ? config.agents.list : [];
  for (const agent of agents) {
    if (!isRecord(agent)) {
      continue;
    }
    addModelProviderRefs(agent.model);
    addModelMapProviderIds((agent as Record<string, unknown>).models);
  }

  return new Set(
    [...modelIdsByProvider.entries()]
      .filter(([providerId, modelIds]) => {
        return [...modelIds].some((modelId) =>
          configuredModelProviderNeedsRuntimePlugin({
            config,
            manifestModelProviders,
            providerId,
            modelId,
          }),
        );
      })
      .map(([providerId]) => providerId),
  );
}

function configuredModelProviderNeedsRuntimePlugin(params: {
  config: KovaConfig;
  manifestModelProviders: ManifestModelProviderLookup;
  providerId: string;
  modelId: string;
}): boolean {
  const providerConfig = params.config.models?.providers?.[params.providerId];
  const configuredModel = providerConfig?.models?.find((model) => model.id === params.modelId);
  const modelApi =
    configuredModel?.api ??
    providerConfig?.api ??
    params.manifestModelProviders.modelApis.get(
      buildModelCatalogMergeKey(params.providerId, params.modelId),
    );
  if (typeof modelApi === "string") {
    return !CORE_BUILT_IN_MODEL_APIS.has(modelApi);
  }
  return params.manifestModelProviders.providerIds.has(params.providerId);
}

function manifestOwnsConfiguredModelProvider(params: {
  manifest: PluginManifestRecord | undefined;
  configuredModelProviderIds: ReadonlySet<string>;
}): boolean {
  if (params.configuredModelProviderIds.size === 0) {
    return false;
  }
  return (params.manifest?.providers ?? []).some((providerId) => {
    return params.configuredModelProviderIds.has(normalizeProviderId(providerId));
  });
}

function collectConfiguredGenerationProviderIds(
  config: KovaConfig,
): ConfiguredGenerationProviderIds {
  const defaults = config.agents?.defaults;
  return {
    imageGenerationProviders: collectModelProviderIds(defaults?.imageGenerationModel),
    videoGenerationProviders: collectModelProviderIds(defaults?.videoGenerationModel),
    musicGenerationProviders: collectModelProviderIds(defaults?.musicGenerationModel),
  };
}

function collectConfiguredVoiceProviderIds(config: KovaConfig): ConfiguredVoiceProviderIds {
  const providerIds = collectConfiguredSpeechProviderIds(config);
  return {
    speechProviders: providerIds,
    realtimeTranscriptionProviders: providerIds,
    realtimeVoiceProviders: providerIds,
  };
}

function manifestOwnsConfiguredGenerationProvider(params: {
  manifest: PluginManifestRecord | undefined;
  configuredGenerationProviderIds: ConfiguredGenerationProviderIds;
}): boolean {
  for (const contractKey of [
    "imageGenerationProviders",
    "videoGenerationProviders",
    "musicGenerationProviders",
  ] as const) {
    const configuredProviderIds = params.configuredGenerationProviderIds[contractKey];
    if (configuredProviderIds.size === 0) {
      continue;
    }
    if (
      (params.manifest?.contracts?.[contractKey] ?? []).some((providerId) => {
        const normalized = normalizeOptionalLowercaseString(providerId);
        return normalized ? configuredProviderIds.has(normalized) : false;
      })
    ) {
      return true;
    }
  }
  return false;
}

function manifestOwnsConfiguredVoiceProvider(params: {
  manifest: PluginManifestRecord | undefined;
  configuredVoiceProviderIds: ConfiguredVoiceProviderIds;
}): boolean {
  for (const contractKey of [
    "speechProviders",
    "realtimeTranscriptionProviders",
    "realtimeVoiceProviders",
  ] as const) {
    const configuredProviderIds = params.configuredVoiceProviderIds[contractKey];
    if (configuredProviderIds.size === 0) {
      continue;
    }
    if (
      (params.manifest?.contracts?.[contractKey] ?? []).some((providerId) => {
        const normalized = normalizeOptionalLowercaseString(providerId);
        return normalized ? configuredProviderIds.has(normalized) : false;
      })
    ) {
      return true;
    }
  }
  return false;
}

function canStartConfiguredRootPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: KovaConfig;
  pluginsConfig: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  activationSourcePlugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
}): boolean {
  if (params.plugin.origin !== "bundled") {
    return false;
  }
  if (!hasConfiguredActivationPath({ manifest: params.manifest, config: params.config })) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSourcePlugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSourcePlugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSourcePlugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  return true;
}

function canStartConfiguredProviderPlugin(params: {
  ownsConfiguredProvider: boolean;
  plugin: InstalledPluginIndexRecord;
  config: KovaConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
  };
}): boolean {
  if (!params.ownsConfiguredProvider) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSource.plugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSource.plugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSource.plugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: params.plugin.enabledByDefault,
    activationSource: params.activationSource,
  });
  return (
    activationState.enabled &&
    (params.plugin.origin === "bundled" || activationState.explicitlyEnabled)
  );
}

function canStartConfiguredSpeechProviderPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: KovaConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
  };
  configuredSpeechProviderIds: ReadonlySet<string>;
}): boolean {
  return canStartConfiguredProviderPlugin({
    ownsConfiguredProvider: manifestOwnsConfiguredSpeechProvider({
      manifest: params.manifest,
      configuredSpeechProviderIds: params.configuredSpeechProviderIds,
    }),
    plugin: params.plugin,
    config: params.config,
    pluginsConfig: params.pluginsConfig,
    activationSource: params.activationSource,
  });
}

function canStartConfiguredWebSearchProviderPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: KovaConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
  };
  configuredWebSearchProviderIds: ReadonlySet<string>;
}): boolean {
  return canStartConfiguredProviderPlugin({
    ownsConfiguredProvider: manifestOwnsConfiguredWebSearchProvider({
      manifest: params.manifest,
      configuredWebSearchProviderIds: params.configuredWebSearchProviderIds,
    }),
    plugin: params.plugin,
    config: params.config,
    pluginsConfig: params.pluginsConfig,
    activationSource: params.activationSource,
  });
}

function canStartConfiguredModelProviderPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: KovaConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
  };
  configuredModelProviderIds: ReadonlySet<string>;
}): boolean {
  return canStartConfiguredProviderPlugin({
    ownsConfiguredProvider: manifestOwnsConfiguredModelProvider({
      manifest: params.manifest,
      configuredModelProviderIds: params.configuredModelProviderIds,
    }),
    plugin: params.plugin,
    config: params.config,
    pluginsConfig: params.pluginsConfig,
    activationSource: params.activationSource,
  });
}

function canStartConfiguredGenerationProviderPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: KovaConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
  };
  configuredGenerationProviderIds: ConfiguredGenerationProviderIds;
}): boolean {
  return canStartConfiguredProviderPlugin({
    ownsConfiguredProvider: manifestOwnsConfiguredGenerationProvider({
      manifest: params.manifest,
      configuredGenerationProviderIds: params.configuredGenerationProviderIds,
    }),
    plugin: params.plugin,
    config: params.config,
    pluginsConfig: params.pluginsConfig,
    activationSource: params.activationSource,
  });
}

function canStartConfiguredVoiceProviderPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: KovaConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
  };
  configuredVoiceProviderIds: ConfiguredVoiceProviderIds;
}): boolean {
  return canStartConfiguredProviderPlugin({
    ownsConfiguredProvider: manifestOwnsConfiguredVoiceProvider({
      manifest: params.manifest,
      configuredVoiceProviderIds: params.configuredVoiceProviderIds,
    }),
    plugin: params.plugin,
    config: params.config,
    pluginsConfig: params.pluginsConfig,
    activationSource: params.activationSource,
  });
}

function hasExplicitHookPolicyConfig(
  entry: NormalizedPluginsConfig["entries"][string] | undefined,
): boolean {
  return (
    entry?.hooks?.allowConversationAccess === true ||
    entry?.hooks?.allowPromptInjection === true ||
    entry?.hooks?.timeoutMs !== undefined ||
    (entry?.hooks?.timeouts !== undefined && Object.keys(entry.hooks.timeouts).length > 0)
  );
}

function hasHookRuntimeStartupIntent(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  activationSourcePlugins: NormalizedPluginsConfig;
}): boolean {
  if (params.manifest?.activation?.onCapabilities?.includes("hook")) {
    return true;
  }
  return hasExplicitHookPolicyConfig(
    params.activationSourcePlugins.entries[params.plugin.pluginId],
  );
}

function canStartExplicitHookPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: KovaConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
  };
  activationSourcePlugins: NormalizedPluginsConfig;
}): boolean {
  const hasHookPolicyIntent = hasExplicitHookPolicyConfig(
    params.activationSourcePlugins.entries[params.plugin.pluginId],
  );
  if (
    !hasHookRuntimeStartupIntent({
      plugin: params.plugin,
      manifest: params.manifest,
      activationSourcePlugins: params.activationSourcePlugins,
    })
  ) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSourcePlugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSourcePlugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSourcePlugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: params.plugin.enabledByDefault,
    activationSource: params.activationSource,
  });
  return activationState.enabled && (activationState.explicitlyEnabled || hasHookPolicyIntent);
}

function canStartConfiguredChannelPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  config: KovaConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: KovaConfig;
  };
  manifestRegistry: PluginManifestRegistry;
}): boolean {
  if (!params.pluginsConfig.enabled) {
    return false;
  }
  if (params.pluginsConfig.deny.includes(params.plugin.pluginId)) {
    return false;
  }
  if (params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false) {
    return false;
  }
  const explicitBundledChannelConfig =
    params.plugin.origin === "bundled" &&
    listManifestChannelIds(params.manifestRegistry, params.plugin.pluginId).some((channelId) =>
      hasExplicitChannelConfig({
        config: params.activationSource.rootConfig ?? params.config,
        channelId,
      }),
    );
  if (
    params.pluginsConfig.allow.length > 0 &&
    !params.pluginsConfig.allow.includes(params.plugin.pluginId) &&
    !explicitBundledChannelConfig
  ) {
    return false;
  }
  if (params.plugin.origin === "bundled") {
    return true;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: params.plugin.enabledByDefault,
    activationSource: params.activationSource,
  });
  return activationState.enabled && activationState.explicitlyEnabled;
}

export function resolveChannelPluginIds(params: {
  config: KovaConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const index = loadPluginRegistrySnapshot({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  });
  const manifestRegistry = loadPluginManifestRegistryForInstalledIndex({
    index,
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    includeDisabled: true,
  });
  return resolveChannelPluginIdsFromRegistry({ manifestRegistry });
}

export function resolveChannelPluginIdsFromRegistry(params: {
  manifestRegistry: PluginManifestRegistry;
}): string[] {
  const { manifestRegistry } = params;
  return manifestRegistry.plugins
    .filter((plugin) => plugin.channels.length > 0)
    .map((plugin) => plugin.id);
}

export function resolveConfiguredDeferredChannelPluginIdsFromRegistry(params: {
  config: KovaConfig;
  env: NodeJS.ProcessEnv;
  index: ReturnType<typeof loadPluginRegistrySnapshot>;
  manifestRegistry: PluginManifestRegistry;
}): string[] {
  const configuredChannelIds = new Set(listPotentialEnabledChannelIds(params.config, params.env));
  if (configuredChannelIds.size === 0) {
    return [];
  }
  const pluginsConfig = normalizePluginsConfigWithRegistry(params.config.plugins, params.index, {
    manifestRegistry: params.manifestRegistry,
  });
  const activationSource = {
    plugins: pluginsConfig,
    rootConfig: params.config,
  };
  return params.index.plugins
    .filter(
      (plugin) =>
        hasConfiguredStartupChannel({
          plugin,
          manifestRegistry: params.manifestRegistry,
          configuredChannelIds,
        }) &&
        plugin.startup.deferConfiguredChannelFullLoadUntilAfterListen &&
        canStartConfiguredChannelPlugin({
          plugin,
          config: params.config,
          pluginsConfig,
          activationSource,
          manifestRegistry: params.manifestRegistry,
        }),
    )
    .map((plugin) => plugin.pluginId);
}

export function resolveConfiguredDeferredChannelPluginIds(params: {
  config: KovaConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const index = loadPluginRegistrySnapshot({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  });
  const manifestRegistry = loadPluginManifestRegistryForInstalledIndex({
    index,
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    includeDisabled: true,
  });
  return resolveConfiguredDeferredChannelPluginIdsFromRegistry({
    config: params.config,
    env: params.env,
    index,
    manifestRegistry,
  });
}

export function resolveGatewayStartupPluginPlanFromRegistry(params: {
  config: KovaConfig;
  activationSourceConfig?: KovaConfig;
  env: NodeJS.ProcessEnv;
  index: ReturnType<typeof loadPluginRegistrySnapshot>;
  manifestRegistry: PluginManifestRegistry;
}): GatewayStartupPluginPlan {
  const channelPluginIds = resolveChannelPluginIdsFromRegistry({
    manifestRegistry: params.manifestRegistry,
  });
  const configuredDeferredChannelPluginIds = resolveConfiguredDeferredChannelPluginIdsFromRegistry({
    config: params.config,
    env: params.env,
    index: params.index,
    manifestRegistry: params.manifestRegistry,
  });
  const configuredChannelIds = new Set(listPotentialEnabledChannelIds(params.config, params.env));
  const pluginsConfig = normalizePluginsConfigWithRegistry(params.config.plugins, params.index, {
    manifestRegistry: params.manifestRegistry,
  });
  // Startup must classify allowlist exceptions against the raw config snapshot,
  // not the auto-enabled effective snapshot, or configured-only channels can be
  // misclassified as explicit enablement.
  const activationSourceConfig = params.activationSourceConfig ?? params.config;
  const activationSourcePlugins = normalizePluginsConfigWithRegistry(
    activationSourceConfig.plugins,
    params.index,
    { manifestRegistry: params.manifestRegistry },
  );
  const activationSource = {
    plugins: activationSourcePlugins,
    rootConfig: activationSourceConfig,
  };
  const requiredAgentHarnessRuntimes = new Set(
    collectConfiguredAgentHarnessRuntimes(activationSourceConfig, params.env),
  );
  const startupDreamingPluginIds = resolveGatewayStartupDreamingPluginIds(params.config);
  const configuredSpeechProviderIds = collectConfiguredSpeechProviderIds(activationSourceConfig);
  const configuredWebSearchProviderIds =
    collectConfiguredWebSearchProviderIds(activationSourceConfig);
  const configuredModelProviderIds = collectConfiguredAgentModelProviderIds(
    activationSourceConfig,
    params.manifestRegistry,
  );
  const configuredGenerationProviderIds =
    collectConfiguredGenerationProviderIds(activationSourceConfig);
  const configuredVoiceProviderIds = collectConfiguredVoiceProviderIds(activationSourceConfig);
  const normalizePluginId = createPluginRegistryIdNormalizer(params.index, {
    manifestRegistry: params.manifestRegistry,
  });
  const memorySlotStartupPluginId = resolveMemorySlotStartupPluginId({
    activationSourceConfig,
    activationSourcePlugins,
    normalizePluginId,
  });
  const contextEngineSlotStartupPluginId = resolveContextEngineSlotStartupPluginId({
    activationSourceConfig,
    activationSourcePlugins,
    normalizePluginId,
  });
  const pluginIds = params.index.plugins
    .filter((plugin) => {
      const manifest = findManifestPlugin(params.manifestRegistry, plugin.pluginId);
      if (
        hasConfiguredStartupChannel({
          plugin,
          manifestRegistry: params.manifestRegistry,
          configuredChannelIds,
        })
      ) {
        return canStartConfiguredChannelPlugin({
          plugin,
          config: params.config,
          pluginsConfig,
          activationSource,
          manifestRegistry: params.manifestRegistry,
        });
      }
      if (
        plugin.startup.agentHarnesses.some((runtime) => requiredAgentHarnessRuntimes.has(runtime))
      ) {
        const activationState = resolveEffectivePluginActivationState({
          id: plugin.pluginId,
          origin: plugin.origin,
          config: pluginsConfig,
          rootConfig: params.config,
          enabledByDefault: plugin.enabledByDefault,
          activationSource,
        });
        return activationState.enabled;
      }
      if (
        canStartConfiguredRootPlugin({
          plugin,
          manifest,
          config: activationSourceConfig,
          pluginsConfig,
          activationSourcePlugins,
        })
      ) {
        return true;
      }
      if (
        canStartConfiguredSpeechProviderPlugin({
          plugin,
          manifest,
          config: params.config,
          pluginsConfig,
          activationSource,
          configuredSpeechProviderIds,
        })
      ) {
        return true;
      }
      if (
        canStartConfiguredWebSearchProviderPlugin({
          plugin,
          manifest,
          config: params.config,
          pluginsConfig,
          activationSource,
          configuredWebSearchProviderIds,
        })
      ) {
        return true;
      }
      if (
        canStartConfiguredModelProviderPlugin({
          plugin,
          manifest,
          config: params.config,
          pluginsConfig,
          activationSource,
          configuredModelProviderIds,
        })
      ) {
        return true;
      }
      if (
        canStartConfiguredGenerationProviderPlugin({
          plugin,
          manifest,
          config: params.config,
          pluginsConfig,
          activationSource,
          configuredGenerationProviderIds,
        })
      ) {
        return true;
      }
      if (
        canStartConfiguredVoiceProviderPlugin({
          plugin,
          manifest,
          config: params.config,
          pluginsConfig,
          activationSource,
          configuredVoiceProviderIds,
        })
      ) {
        return true;
      }
      if (
        canStartExplicitHookPlugin({
          plugin,
          manifest,
          config: params.config,
          pluginsConfig,
          activationSource,
          activationSourcePlugins,
        })
      ) {
        return true;
      }
      if (
        !shouldConsiderForGatewayStartup({
          plugin,
          manifest,
          startupDreamingPluginIds,
          memorySlotStartupPluginId,
          contextEngineSlotStartupPluginId,
        })
      ) {
        return false;
      }
      const activationState = resolveEffectivePluginActivationState({
        id: plugin.pluginId,
        origin: plugin.origin,
        config: pluginsConfig,
        rootConfig: params.config,
        enabledByDefault: plugin.enabledByDefault,
        activationSource,
      });
      if (!activationState.enabled) {
        return false;
      }
      if (plugin.origin !== "bundled") {
        return activationState.explicitlyEnabled;
      }
      return activationState.source === "explicit" || activationState.source === "default";
    })
    .map((plugin) => plugin.pluginId);
  return {
    channelPluginIds,
    configuredDeferredChannelPluginIds,
    pluginIds,
  };
}

export function resolveGatewayStartupPluginIdsFromRegistry(params: {
  config: KovaConfig;
  activationSourceConfig?: KovaConfig;
  env: NodeJS.ProcessEnv;
  index: ReturnType<typeof loadPluginRegistrySnapshot>;
  manifestRegistry: PluginManifestRegistry;
}): string[] {
  return [...resolveGatewayStartupPluginPlanFromRegistry(params).pluginIds];
}

export function resolveGatewayStartupPluginIds(params: {
  config: KovaConfig;
  activationSourceConfig?: KovaConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  return [...loadGatewayStartupPluginPlan(params).pluginIds];
}

export function loadGatewayStartupPluginPlan(params: {
  config: KovaConfig;
  activationSourceConfig?: KovaConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
  index?: ReturnType<typeof loadPluginRegistrySnapshot>;
  metadataSnapshot?: PluginMetadataSnapshot;
}): GatewayStartupPluginPlan {
  const snapshotConfig = params.activationSourceConfig ?? params.config;
  const metadataSnapshot =
    params.metadataSnapshot &&
    isPluginMetadataSnapshotCompatible({
      snapshot: params.metadataSnapshot,
      config: snapshotConfig,
      env: params.env,
      workspaceDir: params.workspaceDir,
      index: params.index,
    })
      ? params.metadataSnapshot
      : loadPluginMetadataSnapshot({
          config: snapshotConfig,
          workspaceDir: params.workspaceDir,
          env: params.env,
          ...(params.index ? { index: params.index } : {}),
        });
  return resolveGatewayStartupPluginPlanFromRegistry({
    config: params.config,
    ...(params.activationSourceConfig !== undefined
      ? { activationSourceConfig: params.activationSourceConfig }
      : {}),
    env: params.env,
    index: metadataSnapshot.index,
    manifestRegistry: metadataSnapshot.manifestRegistry,
  });
}

export function resolveGatewayStartupPluginIdsUncached(params: {
  config: KovaConfig;
  activationSourceConfig?: KovaConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const index = loadPluginRegistrySnapshot({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  });
  const manifestRegistry = loadPluginManifestRegistryForInstalledIndex({
    index,
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    includeDisabled: true,
  });
  return resolveGatewayStartupPluginIdsFromRegistry({
    config: params.config,
    ...(params.activationSourceConfig !== undefined
      ? { activationSourceConfig: params.activationSourceConfig }
      : {}),
    env: params.env,
    index,
    manifestRegistry,
  });
}
