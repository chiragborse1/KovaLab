import { normalizeProviderId } from "../agents/provider-id.js";
import { formatCliCommand } from "../cli/command-format.js";
import { commitConfigWriteWithPendingPluginInstalls } from "../cli/plugins-install-record-commit.js";
import type {
  AuthChoice,
  GatewayAuthChoice,
  OnboardMode,
  OnboardOptions,
  ResetScope,
} from "../commands/onboard-types.js";
import { createConfigIO, replaceConfigFile, resolveGatewayPort } from "../config/config.js";
import type { KovaConfig } from "../config/types.kova.js";
import { normalizeSecretInputString } from "../config/types.secrets.js";
import { readGatewayCredentialEnv } from "../gateway/credentials.js";
import { formatErrorMessage } from "../infra/errors.js";
import {
  buildPluginCompatibilitySnapshotNotices,
  formatPluginCompatibilityNotice,
} from "../plugins/status.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { WizardCancelledError, type WizardPrompter } from "./prompts.js";
import {
  promptSetupBuilderModules,
  resolveGatewaySettingsFromDefaults,
  type SetupBuilderModule,
} from "./setup.builder.js";
import { detectSetupMigrationSources, runSetupMigrationImport } from "./setup.migration-import.js";
import { resolveSetupSecretInputString } from "./setup.secret-input.js";
import {
  SECURITY_CONFIRM_MESSAGE,
  SECURITY_NOTE_MESSAGE,
  SECURITY_NOTE_TITLE,
} from "./setup.security-note.js";
import type { QuickstartGatewayDefaults, WizardFlow } from "./setup.types.js";

type SetupFlowChoice = WizardFlow | "import";
type ExistingSetupAction = "use" | "tune" | "reset";

type AuthChoiceModule = typeof import("../commands/auth-choice.js");
type ConfigLoggingModule = typeof import("../config/logging.js");
type ModelPickerModule = typeof import("../commands/model-picker.js");

let authChoiceModulePromise: Promise<AuthChoiceModule> | undefined;
let configLoggingModulePromise: Promise<ConfigLoggingModule> | undefined;
let modelPickerModulePromise: Promise<ModelPickerModule> | undefined;

function loadAuthChoiceModule(): Promise<AuthChoiceModule> {
  authChoiceModulePromise ??= import("../commands/auth-choice.js");
  return authChoiceModulePromise;
}

function loadConfigLoggingModule(): Promise<ConfigLoggingModule> {
  configLoggingModulePromise ??= import("../config/logging.js");
  return configLoggingModulePromise;
}

function loadModelPickerModule(): Promise<ModelPickerModule> {
  modelPickerModulePromise ??= import("../commands/model-picker.js");
  return modelPickerModulePromise;
}

async function writeWizardConfigFile(
  config: KovaConfig,
  opts: { deferConfigReload?: boolean } = {},
): Promise<KovaConfig> {
  const committed = await commitConfigWriteWithPendingPluginInstalls({
    nextConfig: config,
    commit: async (nextConfig, writeOptions) => {
      await replaceConfigFile({
        nextConfig,
        ...(writeOptions ? { writeOptions } : {}),
        afterWrite: opts.deferConfigReload
          ? { mode: "none", reason: "browser setup wizard is still running" }
          : { mode: "auto" },
      });
    },
  });
  return committed.config;
}

async function readSetupConfigFileSnapshot() {
  return await createConfigIO({ pluginValidation: "skip" }).readConfigFileSnapshot();
}

async function resolveAuthChoiceModelSelectionPolicy(params: {
  authChoice: string;
  config: KovaConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  resolvePreferredProviderForAuthChoice: (params: {
    choice: string;
    config?: KovaConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  }) => Promise<string | undefined>;
}): Promise<{
  preferredProvider?: string;
  promptWhenAuthChoiceProvided: boolean;
  allowKeepCurrent: boolean;
}> {
  const preferredProvider = await params.resolvePreferredProviderForAuthChoice({
    choice: params.authChoice,
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  });

  const [{ resolveManifestProviderAuthChoice }, { resolvePluginSetupProvider }] = await Promise.all(
    [import("../plugins/provider-auth-choices.js"), import("../plugins/setup-registry.js")],
  );
  const manifestChoice = resolveManifestProviderAuthChoice(params.authChoice, {
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    includeUntrustedWorkspacePlugins: false,
  });
  if (manifestChoice) {
    const setupProvider = resolvePluginSetupProvider({
      provider: manifestChoice.providerId,
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
      pluginIds: [manifestChoice.pluginId],
    });
    const setupMethod = setupProvider?.auth.find(
      (method) => normalizeProviderId(method.id) === normalizeProviderId(manifestChoice.methodId),
    );
    const setupPolicy =
      setupMethod?.wizard?.modelSelection ?? setupProvider?.wizard?.setup?.modelSelection;
    return {
      preferredProvider,
      promptWhenAuthChoiceProvided: setupPolicy?.promptWhenAuthChoiceProvided === true,
      allowKeepCurrent: setupPolicy?.allowKeepCurrent ?? true,
    };
  }

  const { resolvePluginProviders, resolveProviderPluginChoice } =
    await import("../plugins/provider-auth-choice.runtime.js");
  const providers = resolvePluginProviders({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    mode: "setup",
  });
  const resolvedChoice = resolveProviderPluginChoice({
    providers,
    choice: params.authChoice,
  });
  const matchedProvider =
    resolvedChoice?.provider ??
    (() => {
      const preferredId = preferredProvider?.trim();
      if (!preferredId) {
        return undefined;
      }
      return providers.find(
        (provider) => typeof provider.id === "string" && provider.id.trim() === preferredId,
      );
    })();
  const setupPolicy =
    resolvedChoice?.wizard?.modelSelection ?? matchedProvider?.wizard?.setup?.modelSelection;

  return {
    preferredProvider,
    promptWhenAuthChoiceProvided: setupPolicy?.promptWhenAuthChoiceProvided === true,
    allowKeepCurrent: setupPolicy?.allowKeepCurrent ?? true,
  };
}

async function requireRiskAcknowledgement(params: {
  opts: OnboardOptions;
  prompter: WizardPrompter;
}) {
  if (params.opts.acceptRisk === true) {
    return;
  }

  await params.prompter.note(SECURITY_NOTE_MESSAGE, SECURITY_NOTE_TITLE);

  const ok = await params.prompter.confirm({
    message: SECURITY_CONFIRM_MESSAGE,
    initialValue: false,
  });
  if (!ok) {
    throw new WizardCancelledError("risk not accepted");
  }
}

export async function runSetupWizard(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
) {
  const onboardHelpers = await import("../commands/onboard-helpers.js");
  onboardHelpers.printWizardHeader(runtime);
  await prompter.intro("Kova Setup");
  await requireRiskAcknowledgement({ opts, prompter });

  let snapshotLoadedMessage = "Kova home loaded.";
  const snapshotProgress = prompter.progress("Reading Kova home");
  let snapshot!: Awaited<ReturnType<typeof readSetupConfigFileSnapshot>>;
  try {
    snapshot = await readSetupConfigFileSnapshot();
  } catch (error) {
    snapshotLoadedMessage = "Kova home failed to load.";
    throw error;
  } finally {
    snapshotProgress.stop(snapshotLoadedMessage);
  }
  let baseConfig: KovaConfig = snapshot.valid
    ? snapshot.exists
      ? (snapshot.sourceConfig ?? snapshot.config)
      : {}
    : {};

  if (snapshot.exists && !snapshot.valid) {
    await prompter.note(onboardHelpers.summarizeExistingConfig(baseConfig), "Invalid config");
    if (snapshot.issues.length > 0) {
      await prompter.note(
        [
          ...snapshot.issues.map((iss) => `- ${iss.path}: ${iss.message}`),
          "",
          "Docs: https://docs.neuralstudio.in/gateway/configuration",
        ].join("\n"),
        "Config issues",
      );
    }
    await prompter.outro(
      `Config invalid. Run \`${formatCliCommand("kova doctor")}\` to repair it, then re-run setup.`,
    );
    runtime.exit(1);
    return;
  }

  const compatibilityNotices = snapshot.valid
    ? buildPluginCompatibilitySnapshotNotices({ config: baseConfig })
    : [];
  if (compatibilityNotices.length > 0) {
    await prompter.note(
      [
        `Detected ${compatibilityNotices.length} plugin compatibility notice${compatibilityNotices.length === 1 ? "" : "s"} in the current config.`,
        ...compatibilityNotices
          .slice(0, 4)
          .map((notice) => `- ${formatPluginCompatibilityNotice(notice)}`),
        ...(compatibilityNotices.length > 4
          ? [`- ... +${compatibilityNotices.length - 4} more`]
          : []),
        "",
        `Review: ${formatCliCommand("kova doctor")}`,
        `Inspect: ${formatCliCommand("kova plugins inspect --all")}`,
      ].join("\n"),
      "Plugin compatibility",
    );
  }

  const quickstartHint = "First chat first: model/auth, workspace, then terminal chat.";
  const builderHint =
    "Goal-based setup: choose only Gateway, channels, web, skills, plugins, or hooks when you want them.";
  const explicitFlowRaw = opts.flow?.trim();
  const normalizedExplicitFlow =
    explicitFlowRaw === "manual" || explicitFlowRaw === "advanced" ? "builder" : explicitFlowRaw;
  if (
    normalizedExplicitFlow &&
    normalizedExplicitFlow !== "quickstart" &&
    normalizedExplicitFlow !== "builder" &&
    normalizedExplicitFlow !== "import"
  ) {
    runtime.error("Invalid --flow (use quickstart, builder, manual, advanced, or import).");
    runtime.exit(1);
    return;
  }
  const explicitFlow: SetupFlowChoice | undefined =
    normalizedExplicitFlow === "quickstart" ||
    normalizedExplicitFlow === "builder" ||
    normalizedExplicitFlow === "import"
      ? normalizedExplicitFlow
      : undefined;
  let migrationDetections: Awaited<ReturnType<typeof detectSetupMigrationSources>> = [];
  let migrationDetectionsLoaded = false;
  const loadMigrationDetections = async () => {
    if (!migrationDetectionsLoaded) {
      migrationDetections = await detectSetupMigrationSources({ config: baseConfig, runtime });
      migrationDetectionsLoaded = true;
    }
    return migrationDetections;
  };
  const importOption = {
    value: "import" as const,
    label: "Import or migrate",
    hint: "Bring supported agent homes into Kova",
  };
  let flow: SetupFlowChoice =
    explicitFlow ??
    (await prompter.select({
      message: "How should Kova start?",
      options: [
        { value: "quickstart", label: "Kova Start", hint: quickstartHint },
        { value: "builder", label: "Kova Builder", hint: builderHint },
        importOption,
      ],
      initialValue: "quickstart",
    }));

  if (opts.mode === "remote" && flow === "quickstart") {
    await prompter.note(
      "Kova Start is local-only. Switching to Kova Builder for remote Gateway setup.",
      "Setup path",
    );
    flow = "builder";
  }

  let existingSetupAction: ExistingSetupAction = snapshot.exists ? "use" : "tune";
  if (snapshot.exists) {
    await prompter.note(onboardHelpers.summarizeExistingConfig(baseConfig), "Kova home");

    const selectedAction = await prompter.select({
      message: "Kova found an existing home. What should happen next?",
      options: [
        {
          value: "use",
          label: "Use current home",
          hint: "Keep model, workspace, Gateway, and secrets unchanged",
        },
        {
          value: "tune",
          label: "Tune model or workspace",
          hint: "Change the base chat setup before choosing extras",
        },
        { value: "reset", label: "Reset Kova", hint: "Clear config before rebuilding" },
      ],
      initialValue: "use",
    });
    existingSetupAction =
      selectedAction === "tune" || selectedAction === "reset" || selectedAction === "use"
        ? selectedAction
        : "use";

    if (existingSetupAction === "reset") {
      const workspaceDefault = onboardHelpers.resolveOnboardWorkspaceDefault(baseConfig);
      const resetScope = (await prompter.select({
        message: "What should be cleared?",
        options: [
          { value: "config", label: "Config only" },
          {
            value: "config+creds+sessions",
            label: "Config, credentials, and sessions",
          },
          {
            value: "full",
            label: "Full reset, including workspace",
          },
        ],
      })) as ResetScope;
      await onboardHelpers.handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
      baseConfig = {};
      existingSetupAction = "tune";
    }
  }

  if (opts.importFrom || flow === "import") {
    const detections = await loadMigrationDetections();
    await runSetupMigrationImport({
      opts,
      baseConfig,
      detections,
      prompter,
      runtime,
      commitConfigFile: writeWizardConfigFile,
    });
    return;
  }
  const wizardFlow: WizardFlow = flow;

  const quickstartGateway: QuickstartGatewayDefaults = (() => {
    const hasExisting =
      typeof baseConfig.gateway?.port === "number" ||
      baseConfig.gateway?.bind !== undefined ||
      baseConfig.gateway?.auth?.mode !== undefined ||
      baseConfig.gateway?.auth?.token !== undefined ||
      baseConfig.gateway?.auth?.password !== undefined ||
      baseConfig.gateway?.customBindHost !== undefined ||
      baseConfig.gateway?.tailscale?.mode !== undefined;

    const bindRaw = baseConfig.gateway?.bind;
    const bind =
      bindRaw === "loopback" ||
      bindRaw === "lan" ||
      bindRaw === "auto" ||
      bindRaw === "custom" ||
      bindRaw === "tailnet"
        ? bindRaw
        : "loopback";

    let authMode: GatewayAuthChoice = "token";
    if (
      baseConfig.gateway?.auth?.mode === "token" ||
      baseConfig.gateway?.auth?.mode === "password"
    ) {
      authMode = baseConfig.gateway.auth.mode;
    } else if (baseConfig.gateway?.auth?.token) {
      authMode = "token";
    } else if (baseConfig.gateway?.auth?.password) {
      authMode = "password";
    }

    const tailscaleRaw = baseConfig.gateway?.tailscale?.mode;
    const tailscaleMode =
      tailscaleRaw === "off" || tailscaleRaw === "serve" || tailscaleRaw === "funnel"
        ? tailscaleRaw
        : "off";

    return {
      hasExisting,
      port: resolveGatewayPort(baseConfig),
      bind,
      authMode,
      tailscaleMode,
      token: baseConfig.gateway?.auth?.token,
      password: baseConfig.gateway?.auth?.password,
      customBindHost: baseConfig.gateway?.customBindHost,
      tailscaleResetOnExit: baseConfig.gateway?.tailscale?.resetOnExit ?? false,
    };
  })();

  if (flow === "quickstart") {
    const formatBind = (value: "loopback" | "lan" | "auto" | "custom" | "tailnet") => {
      if (value === "loopback") {
        return "Loopback (127.0.0.1)";
      }
      if (value === "lan") {
        return "LAN";
      }
      if (value === "custom") {
        return "Custom IP";
      }
      if (value === "tailnet") {
        return "Tailnet (Tailscale IP)";
      }
      return "Auto";
    };
    const formatAuth = (value: GatewayAuthChoice) => {
      if (value === "token") {
        return "Token (default)";
      }
      return "Password";
    };
    const formatTailscale = (value: "off" | "serve" | "funnel") => {
      if (value === "off") {
        return "Off";
      }
      if (value === "serve") {
        return "Serve";
      }
      return "Funnel";
    };
    const quickstartLines = quickstartGateway.hasExisting
      ? [
          "Kova Start keeps your current Gateway settings, but opens terminal chat first:",
          `Gateway port: ${quickstartGateway.port}`,
          `Gateway bind: ${formatBind(quickstartGateway.bind)}`,
          ...(quickstartGateway.bind === "custom" && quickstartGateway.customBindHost
            ? [`Gateway custom IP: ${quickstartGateway.customBindHost}`]
            : []),
          `Gateway auth: ${formatAuth(quickstartGateway.authMode)}`,
          `Tailscale exposure: ${formatTailscale(quickstartGateway.tailscaleMode)}`,
          "Skipped for now: channels, web search, skills, hooks, and service install.",
          "Next: model/auth, workspace, terminal chat.",
        ]
      : [
          "Kova Start prepares a private terminal-first setup:",
          `Gateway port: ${quickstartGateway.port}`,
          "Gateway bind: Loopback (127.0.0.1)",
          "Gateway auth: Token (default)",
          "Tailscale exposure: Off",
          "Skipped for now: channels, web search, skills, hooks, and service install.",
          "Next: model/auth, workspace, terminal chat.",
        ];
    await prompter.note(quickstartLines.join("\n"), "Kova Start");
  }

  const localPort = resolveGatewayPort(baseConfig);
  const localUrl = `ws://127.0.0.1:${localPort}`;
  const remoteUrl = baseConfig.gateway?.remote?.url?.trim() ?? "";
  const needsModeProbe = flow !== "quickstart" || opts.mode !== undefined;
  let localProbe: Awaited<ReturnType<typeof onboardHelpers.probeGatewayReachable>> | null = null;
  let remoteProbe: Awaited<ReturnType<typeof onboardHelpers.probeGatewayReachable>> | null = null;
  if (needsModeProbe) {
    let localGatewayToken = readGatewayCredentialEnv(process.env, "KOVA_GATEWAY_TOKEN");
    try {
      const resolvedGatewayToken = await resolveSetupSecretInputString({
        config: baseConfig,
        value: baseConfig.gateway?.auth?.token,
        path: "gateway.auth.token",
        env: process.env,
      });
      if (resolvedGatewayToken) {
        localGatewayToken = resolvedGatewayToken;
      }
    } catch (error) {
      await prompter.note(
        [
          "Could not resolve gateway.auth.token SecretRef for setup probe.",
          formatErrorMessage(error),
        ].join("\n"),
        "Gateway auth",
      );
    }
    let localGatewayPassword = readGatewayCredentialEnv(process.env, "KOVA_GATEWAY_PASSWORD");
    try {
      const resolvedGatewayPassword = await resolveSetupSecretInputString({
        config: baseConfig,
        value: baseConfig.gateway?.auth?.password,
        path: "gateway.auth.password",
        env: process.env,
      });
      if (resolvedGatewayPassword) {
        localGatewayPassword = resolvedGatewayPassword;
      }
    } catch (error) {
      await prompter.note(
        [
          "Could not resolve gateway.auth.password SecretRef for setup probe.",
          formatErrorMessage(error),
        ].join("\n"),
        "Gateway auth",
      );
    }

    localProbe = await onboardHelpers.probeGatewayReachable({
      url: localUrl,
      token: localGatewayToken,
      password: localGatewayPassword,
    });
    let remoteGatewayToken = normalizeSecretInputString(baseConfig.gateway?.remote?.token);
    try {
      const resolvedRemoteGatewayToken = await resolveSetupSecretInputString({
        config: baseConfig,
        value: baseConfig.gateway?.remote?.token,
        path: "gateway.remote.token",
        env: process.env,
      });
      if (resolvedRemoteGatewayToken) {
        remoteGatewayToken = resolvedRemoteGatewayToken;
      }
    } catch (error) {
      await prompter.note(
        [
          "Could not resolve gateway.remote.token SecretRef for setup probe.",
          formatErrorMessage(error),
        ].join("\n"),
        "Gateway auth",
      );
    }
    remoteProbe = remoteUrl
      ? await onboardHelpers.probeGatewayReachable({
          url: remoteUrl,
          token: remoteGatewayToken,
        })
      : null;
  }

  const mode =
    opts.mode ??
    (flow === "quickstart"
      ? "local"
      : ((await prompter.select({
          message: "Where should Kova run?",
          options: [
            {
              value: "local",
              label: "This machine",
              hint: localProbe?.ok
                ? `Gateway reachable (${localUrl})`
                : `No gateway detected (${localUrl})`,
            },
            {
              value: "remote",
              label: "Remote gateway",
              hint: !remoteUrl
                ? "No remote URL configured yet"
                : remoteProbe?.ok
                  ? `Gateway reachable (${remoteUrl})`
                  : `Configured but unreachable (${remoteUrl})`,
            },
          ],
        })) as OnboardMode));

  if (mode === "remote") {
    const { promptRemoteGatewayConfig } = await import("../commands/onboard-remote.js");
    const { applySkipBootstrapConfig } = await import("../commands/onboard-config.js");
    const { logConfigUpdated } = await loadConfigLoggingModule();
    let nextConfig = await promptRemoteGatewayConfig(baseConfig, prompter, {
      secretInputMode: opts.secretInputMode,
    });
    if (opts.skipBootstrap) {
      nextConfig = applySkipBootstrapConfig(nextConfig);
    }
    nextConfig = onboardHelpers.applyWizardMetadata(nextConfig, { command: "onboard", mode });
    nextConfig = await writeWizardConfigFile(nextConfig);
    logConfigUpdated(runtime);
    await prompter.outro("Remote Kova gateway setup saved.");
    return;
  }

  const shouldPromptCoreSetup =
    !snapshot.exists ||
    existingSetupAction !== "use" ||
    opts.workspace !== undefined ||
    opts.authChoice !== undefined;
  const workspaceInput =
    opts.workspace ??
    (shouldPromptCoreSetup && flow !== "quickstart"
      ? await prompter.text({
          message: "Kova workspace",
          initialValue: onboardHelpers.resolveOnboardWorkspaceDefault(baseConfig),
        })
      : onboardHelpers.resolveOnboardWorkspaceDefault(baseConfig));

  const workspaceDir = resolveUserPath(workspaceInput.trim() || onboardHelpers.DEFAULT_WORKSPACE);

  const { applyLocalSetupWorkspaceConfig, applySkipBootstrapConfig } =
    await import("../commands/onboard-config.js");
  let nextConfig: KovaConfig = applyLocalSetupWorkspaceConfig(baseConfig, workspaceDir);
  if (opts.skipBootstrap) {
    nextConfig = applySkipBootstrapConfig(nextConfig);
  }

  const authChoiceFromPrompt = opts.authChoice === undefined && shouldPromptCoreSetup;
  let authChoice: AuthChoice | undefined = opts.authChoice;
  let authStore:
    | ReturnType<(typeof import("../agents/auth-profiles.runtime.js"))["ensureAuthProfileStore"]>
    | undefined;
  let promptAuthChoiceGrouped:
    | (typeof import("../commands/auth-choice-prompt.js"))["promptAuthChoiceGrouped"]
    | undefined;
  if (authChoiceFromPrompt) {
    const { ensureAuthProfileStore } = await import("../agents/auth-profiles.runtime.js");
    ({ promptAuthChoiceGrouped } = await import("../commands/auth-choice-prompt.js"));
    authStore = ensureAuthProfileStore(undefined, {
      allowKeychainPrompt: false,
    });
  }
  if (!shouldPromptCoreSetup && opts.authChoice === undefined) {
    await prompter.note(
      [
        "Using your current model/auth and workspace.",
        "Kova Builder will only touch modules you choose next.",
      ].join("\n"),
      "Current chat base",
    );
  }
  while (shouldPromptCoreSetup || opts.authChoice !== undefined) {
    if (authChoiceFromPrompt) {
      authChoice = await promptAuthChoiceGrouped!({
        prompter,
        store: authStore!,
        includeSkip: true,
        config: nextConfig,
        workspaceDir,
      });
    }
    if (authChoice === undefined) {
      throw new WizardCancelledError("auth choice is required");
    }

    if (authChoice === "custom-api-key") {
      const { promptCustomApiConfig } = await import("../commands/onboard-custom.js");
      const customResult = await promptCustomApiConfig({
        prompter,
        runtime,
        config: nextConfig,
        secretInputMode: opts.secretInputMode,
      });
      nextConfig = customResult.config;
      break;
    }
    if (authChoice === "skip") {
      // Explicit skip should stay cold: do not bootstrap auth/profile machinery
      // or run model/auth checks when the caller already chose to skip setup.
      if (authChoiceFromPrompt) {
        const { applyPrimaryModel, promptDefaultModel } = await loadModelPickerModule();
        const modelSelection = await promptDefaultModel({
          config: nextConfig,
          prompter,
          allowKeep: true,
          ignoreAllowlist: true,
          includeProviderPluginSetups: false,
          loadCatalog: false,
          workspaceDir,
          runtime,
        });
        if (modelSelection.config) {
          nextConfig = modelSelection.config;
        }
        if (modelSelection.model) {
          nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
        }

        const { warnIfModelConfigLooksOff } = await loadAuthChoiceModule();
        await warnIfModelConfigLooksOff(nextConfig, prompter, { validateCatalog: false });
      }
      break;
    }

    const [
      { applyAuthChoice, resolvePreferredProviderForAuthChoice, warnIfModelConfigLooksOff },
      { applyPrimaryModel, promptDefaultModel },
    ] = await Promise.all([loadAuthChoiceModule(), loadModelPickerModule()]);
    const authResult = await applyAuthChoice({
      authChoice,
      config: nextConfig,
      prompter,
      runtime,
      setDefaultModel: true,
      opts: {
        tokenProvider: opts.tokenProvider,
        token: opts.authChoice === "apiKey" && opts.token ? opts.token : undefined,
      },
    });
    nextConfig = authResult.config;
    if (authResult.retrySelection) {
      if (authChoiceFromPrompt) {
        continue;
      }
      break;
    }
    if (authResult.agentModelOverride) {
      nextConfig = applyPrimaryModel(nextConfig, authResult.agentModelOverride);
    }

    const authChoiceModelSelectionPolicy = await resolveAuthChoiceModelSelectionPolicy({
      authChoice,
      config: nextConfig,
      workspaceDir,
      resolvePreferredProviderForAuthChoice,
    });
    const shouldPromptModelSelection =
      authChoiceFromPrompt || authChoiceModelSelectionPolicy?.promptWhenAuthChoiceProvided;
    if (shouldPromptModelSelection) {
      const modelSelection = await promptDefaultModel({
        config: nextConfig,
        prompter,
        allowKeep: authChoiceModelSelectionPolicy?.allowKeepCurrent ?? true,
        ignoreAllowlist: true,
        includeProviderPluginSetups: true,
        preferredProvider: authChoiceModelSelectionPolicy?.preferredProvider,
        browseCatalogOnDemand: true,
        workspaceDir,
        runtime,
      });
      if (modelSelection.config) {
        nextConfig = modelSelection.config;
      }
      if (modelSelection.model) {
        nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
      }
    }

    await warnIfModelConfigLooksOff(nextConfig, prompter, { validateCatalog: false });
    break;
  }

  const builderModules: SetupBuilderModule[] =
    flow === "builder"
      ? await promptSetupBuilderModules({
          config: nextConfig,
          workspaceDir,
          gatewayDefaults: quickstartGateway,
          prompter,
        })
      : [];

  let settings = resolveGatewaySettingsFromDefaults(quickstartGateway);
  const shouldConfigureGateway =
    flow === "quickstart" ||
    flow === "advanced" ||
    builderModules.includes("gateway") ||
    (flow === "builder" && opts.installDaemon === true);
  if (shouldConfigureGateway) {
    const { configureGatewayForSetup } = await import("./setup.gateway-config.js");
    const gateway = await configureGatewayForSetup({
      flow: flow === "builder" ? "advanced" : wizardFlow,
      baseConfig,
      nextConfig,
      localPort,
      quickstartGateway,
      secretInputMode: opts.secretInputMode,
      prompter,
      runtime,
    });
    nextConfig = gateway.nextConfig;
    settings = gateway.settings;
  } else if (flow === "builder") {
    await prompter.note(
      [
        "Gateway setup left unchanged.",
        `Add it later: ${formatCliCommand("kova settings")}`,
        `Or run: ${formatCliCommand("kova configure --section gateway")}`,
      ].join("\n"),
      "Gateway",
    );
  }

  const channelsExplicitlyRequested = opts.withChannels === true || opts.skipChannels === false;
  const skipChannelSetup =
    opts.skipChannels === true ||
    opts.skipProviders === true ||
    (flow === "quickstart" && !channelsExplicitlyRequested) ||
    (flow === "builder" && !builderModules.includes("channels"));
  if (skipChannelSetup) {
    const message =
      flow === "quickstart" && opts.skipChannels !== true && opts.skipProviders !== true
        ? [
            "Quick setup keeps the first run terminal-only and skips chat channel setup.",
            `Add channels later: ${formatCliCommand("kova channels add --channel telegram")}`,
            `Or reopen Kova Builder: ${formatCliCommand("kova onboard --flow builder")}`,
          ].join("\n")
        : flow === "builder"
          ? [
              "Messaging channels left unchanged.",
              `Add later: ${formatCliCommand("kova channels add --channel telegram")}`,
              `Or reopen Kova Builder: ${formatCliCommand("kova onboard --flow builder")}`,
            ].join("\n")
          : "Chat channels skipped. You can add them later.";
    await prompter.note(message, "Channels");
  } else {
    const { listChannelPlugins } = await import("../channels/plugins/index.js");
    const { setupChannels } = await import("../commands/onboard-channels.js");
    const quickstartAllowFromChannels =
      flow === "quickstart"
        ? listChannelPlugins()
            .filter((plugin) => plugin.meta.quickstartAllowFrom)
            .map((plugin) => plugin.id)
        : [];
    nextConfig = await setupChannels(nextConfig, runtime, prompter, {
      allowSignalInstall: true,
      deferStatusUntilSelection: flow === "quickstart",
      forceAllowFromChannels: quickstartAllowFromChannels,
      skipDmPolicyPrompt: flow === "quickstart",
      skipConfirm: flow === "quickstart",
      quickstartDefaults: flow === "quickstart",
      secretInputMode: opts.secretInputMode,
    });
  }

  nextConfig = await writeWizardConfigFile(nextConfig, {
    deferConfigReload: opts.deferConfigReload,
  });
  const { logConfigUpdated } = await loadConfigLoggingModule();
  logConfigUpdated(runtime);
  await onboardHelpers.ensureWorkspaceAndSessions(workspaceDir, runtime, {
    skipBootstrap: Boolean(nextConfig.agents?.defaults?.skipBootstrap),
  });

  const skipWebSearchSetup =
    opts.skipSearch ||
    flow === "quickstart" ||
    (flow === "builder" && !builderModules.includes("web"));
  if (skipWebSearchSetup) {
    const message =
      flow === "quickstart" && !opts.skipSearch
        ? [
            "Kova Start skips web search until terminal chat works.",
            `Add it later: ${formatCliCommand("kova configure --section web")}`,
            `Or reopen Kova Builder: ${formatCliCommand("kova onboard --flow builder")}`,
          ].join("\n")
        : flow === "builder" && !builderModules.includes("web")
          ? [
              "Web search left unchanged.",
              `Add later: ${formatCliCommand("kova configure --section web")}`,
            ].join("\n")
          : "Web search skipped. You can add it later.";
    await prompter.note(message, "Web search");
  } else {
    const { setupSearch } = await import("../commands/onboard-search.js");
    nextConfig = await setupSearch(nextConfig, runtime, prompter, {
      quickstartDefaults: flow === "quickstart",
      secretInputMode: opts.secretInputMode,
    });
  }

  const skipSkillSetup =
    opts.skipSkills ||
    flow === "quickstart" ||
    (flow === "builder" && !builderModules.includes("skills"));
  if (skipSkillSetup) {
    const message =
      flow === "quickstart" && !opts.skipSkills
        ? [
            "Kova Start skips skill installation for a faster first run.",
            `Inspect later: ${formatCliCommand("kova skills")}`,
            `Configure later: ${formatCliCommand("kova settings")}`,
          ].join("\n")
        : flow === "builder" && !builderModules.includes("skills")
          ? ["Skills left unchanged.", `Inspect later: ${formatCliCommand("kova skills")}`].join(
              "\n",
            )
          : "Skills skipped. You can install them later.";
    await prompter.note(message, "Skills");
  } else {
    const { setupSkills } = await import("../commands/onboard-skills.js");
    nextConfig = await setupSkills(nextConfig, workspaceDir, runtime, prompter);
  }

  // Plugin configuration (sandbox backends, tool plugins, etc.)
  if (flow !== "quickstart" && (flow !== "builder" || builderModules.includes("plugins"))) {
    const { setupPluginConfig } = await import("./setup.plugin-config.js");
    nextConfig = await setupPluginConfig({
      config: nextConfig,
      prompter,
      workspaceDir,
    });
  } else if (flow === "builder" && !builderModules.includes("plugins")) {
    await prompter.note(
      ["Plugin setup left unchanged.", `Review later: ${formatCliCommand("kova settings")}`].join(
        "\n",
      ),
      "Plugins",
    );
  }

  // Setup hooks (session memory on /new)
  if (flow !== "quickstart" && (flow !== "builder" || builderModules.includes("hooks"))) {
    const { setupInternalHooks } = await import("../commands/onboard-hooks.js");
    nextConfig = await setupInternalHooks(nextConfig, runtime, prompter);
  } else {
    const message =
      flow === "quickstart"
        ? [
            "Automation hooks skipped for Kova Start.",
            `Review later: ${formatCliCommand("kova hooks list")}`,
            `Enable later: ${formatCliCommand("kova hooks enable <name>")}`,
          ].join("\n")
        : [
            "Automation hooks left unchanged.",
            `Review later: ${formatCliCommand("kova hooks list")}`,
          ].join("\n");
    await prompter.note(message, "Automation hooks");
  }

  nextConfig = onboardHelpers.applyWizardMetadata(nextConfig, { command: "onboard", mode });
  nextConfig = await writeWizardConfigFile(nextConfig, {
    deferConfigReload: opts.deferConfigReload,
  });

  const { finalizeSetupWizard } = await import("./setup.finalize.js");
  const { launchedTui } = await finalizeSetupWizard({
    flow: wizardFlow,
    opts,
    baseConfig,
    nextConfig,
    workspaceDir,
    settings,
    builderModules,
    prompter,
    runtime,
  });
  if (launchedTui) {
    return;
  }
}
