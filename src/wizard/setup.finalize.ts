import fs from "node:fs/promises";
import path from "node:path";
import { describeCodexNativeWebSearch } from "../agents/codex-native-web-search.shared.js";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../agents/workspace.js";
import { formatCliCommand } from "../cli/command-format.js";
import {
  buildGatewayInstallPlan,
  gatewayInstallErrorHint,
} from "../commands/daemon-install-helpers.js";
import {
  DEFAULT_GATEWAY_DAEMON_RUNTIME,
  GATEWAY_DAEMON_RUNTIME_OPTIONS,
} from "../commands/daemon-runtime.js";
import { resolveGatewayInstallToken } from "../commands/gateway-install-token.js";
import { formatHealthCheckFailure } from "../commands/health-format.js";
import { healthCommand } from "../commands/health.js";
import {
  probeGatewayReachable,
  waitForGatewayReachable,
  resolveGatewayHttpLinks,
} from "../commands/onboard-helpers.js";
import type { OnboardOptions } from "../commands/onboard-types.js";
import type { KovaConfig } from "../config/types.kova.js";
import { describeGatewayServiceRestart, resolveGatewayService } from "../daemon/service.js";
import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { formatErrorMessage } from "../infra/errors.js";
import type { RuntimeEnv } from "../runtime.js";
import { restoreTerminalState } from "../terminal/restore.js";
import { launchTuiCli } from "../tui/tui-launch.js";
import { resolveUserPath } from "../utils.js";
import { listConfiguredWebSearchProviders } from "../web-search/runtime.js";
import type { WizardPrompter } from "./prompts.js";
import { setupWizardShellCompletion } from "./setup.completion.js";
import type { SetupExtraModule } from "./setup.extras.js";
import { resolveSetupSecretInputString } from "./setup.secret-input.js";
import type { GatewayWizardSettings, WizardFlow } from "./setup.types.js";

type FinalizeOnboardingOptions = {
  flow: WizardFlow;
  opts: OnboardOptions;
  baseConfig: KovaConfig;
  nextConfig: KovaConfig;
  workspaceDir: string;
  settings: GatewayWizardSettings;
  extraModules?: SetupExtraModule[];
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
};

type OnboardSearchModule = typeof import("../commands/onboard-search.js");

let onboardSearchModulePromise: Promise<OnboardSearchModule> | undefined;
const HATCH_TUI_TIMEOUT_MS = 5 * 60 * 1000;

function loadOnboardSearchModule(): Promise<OnboardSearchModule> {
  onboardSearchModulePromise ??= import("../commands/onboard-search.js");
  return onboardSearchModulePromise;
}

export async function finalizeSetupWizard(
  options: FinalizeOnboardingOptions,
): Promise<{ launchedTui: boolean }> {
  const { flow, opts, nextConfig, settings, prompter, runtime } = options;
  const isQuickstart = flow === "quickstart";
  const isExtras = flow === "extras";
  const extraModules = options.extraModules ?? [];
  const extrasWantGateway = extraModules.includes("gateway") || opts.installDaemon === true;
  let gatewayProbe: { ok: boolean; detail?: string } =
    isQuickstart || (isExtras && !extrasWantGateway)
      ? {
          ok: false,
          detail: isQuickstart ? "not checked during launch" : "not checked by extras setup",
        }
      : { ok: true };
  let resolvedGatewayPassword = "";

  const withWizardProgress = async <T>(
    label: string,
    options: { doneMessage?: string | (() => string | undefined) },
    work: (progress: { update: (message: string) => void }) => Promise<T>,
  ): Promise<T> => {
    const progress = prompter.progress(label);
    try {
      return await work(progress);
    } finally {
      progress.stop(
        typeof options.doneMessage === "function" ? options.doneMessage() : options.doneMessage,
      );
    }
  };

  const explicitInstallDaemon =
    typeof opts.installDaemon === "boolean" ? opts.installDaemon : undefined;
  const shouldPrepareServiceLayer =
    explicitInstallDaemon === true ||
    (!isQuickstart && !isExtras && explicitInstallDaemon !== false) ||
    (isExtras && extrasWantGateway && explicitInstallDaemon !== false);
  const systemdAvailable =
    process.platform === "linux" && shouldPrepareServiceLayer
      ? await isSystemdUserServiceAvailable()
      : true;
  if (process.platform === "linux" && shouldPrepareServiceLayer && !systemdAvailable) {
    await prompter.note(
      "Systemd user services are unavailable. Kova will skip lingering checks and background service install.",
      "Linux service layer",
    );
  }

  if (process.platform === "linux" && shouldPrepareServiceLayer && systemdAvailable) {
    const { ensureSystemdUserLingerInteractive } = await import("../commands/systemd-linger.js");
    await ensureSystemdUserLingerInteractive({
      runtime,
      prompter: {
        confirm: prompter.confirm,
        note: prompter.note,
      },
      reason:
        "Kova uses a systemd user service on Linux. Without lingering, the Gateway can stop when the user session logs out or idles.",
      requireConfirm: false,
    });
  }

  let installDaemon: boolean;
  if (explicitInstallDaemon !== undefined) {
    installDaemon = explicitInstallDaemon;
  } else if (process.platform === "linux" && !systemdAvailable) {
    installDaemon = false;
  } else if (flow === "quickstart" || (isExtras && !extrasWantGateway)) {
    installDaemon = false;
  } else {
    installDaemon = await prompter.confirm({
      message: "Install Kova as a background Gateway service?",
      initialValue: true,
    });
  }

  if (process.platform === "linux" && !systemdAvailable && installDaemon) {
    await prompter.note(
      "Systemd user services are unavailable; service install skipped. Use your container supervisor or `docker compose up -d`.",
      "Gateway service",
    );
    installDaemon = false;
  }

  if (installDaemon) {
    const daemonRuntime =
      flow === "quickstart"
        ? DEFAULT_GATEWAY_DAEMON_RUNTIME
        : await prompter.select({
            message: "Gateway service runtime",
            options: GATEWAY_DAEMON_RUNTIME_OPTIONS,
            initialValue: opts.daemonRuntime ?? DEFAULT_GATEWAY_DAEMON_RUNTIME,
          });
    if (flow === "quickstart") {
      await prompter.note(
        "Launch uses the Node runtime when you explicitly install the Gateway service.",
        "Gateway service runtime",
      );
    }
    const service = resolveGatewayService();
    const loaded = await service.isLoaded({ env: process.env });
    let restartWasScheduled = false;
    if (loaded) {
      const action = await prompter.select({
        message: "A Kova Gateway service already exists",
        options: [
          { value: "restart", label: "Restart it with this config" },
          { value: "reinstall", label: "Reinstall the service" },
          { value: "skip", label: "Leave service unchanged" },
        ],
      });
      if (action === "restart") {
        let restartDoneMessage = "Gateway service restarted.";
        await withWizardProgress(
          "Gateway service",
          { doneMessage: () => restartDoneMessage },
          async (progress) => {
            progress.update("Restarting Gateway service…");
            const restartResult = await service.restart({
              env: process.env,
              stdout: process.stdout,
            });
            const restartStatus = describeGatewayServiceRestart("Gateway", restartResult);
            restartDoneMessage = restartStatus.progressMessage;
            restartWasScheduled = restartStatus.scheduled;
          },
        );
      } else if (action === "reinstall") {
        await withWizardProgress(
          "Gateway service",
          { doneMessage: "Gateway service uninstalled." },
          async (progress) => {
            progress.update("Uninstalling Gateway service…");
            await service.uninstall({ env: process.env, stdout: process.stdout });
          },
        );
      }
    }

    if (
      !loaded ||
      (!restartWasScheduled && loaded && !(await service.isLoaded({ env: process.env })))
    ) {
      const progress = prompter.progress("Gateway service");
      let installError: string | null = null;
      try {
        progress.update("Preparing Gateway service…");
        const tokenResolution = await resolveGatewayInstallToken({
          config: nextConfig,
          env: process.env,
        });
        for (const warning of tokenResolution.warnings) {
          await prompter.note(warning, "Gateway service");
        }
        if (tokenResolution.unavailableReason) {
          installError = [
            "Gateway install blocked:",
            tokenResolution.unavailableReason,
            "Fix gateway auth config/token input and rerun setup.",
          ].join(" ");
        } else {
          const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan(
            {
              env: process.env,
              port: settings.port,
              runtime: daemonRuntime,
              warn: (message, title) => prompter.note(message, title),
              config: nextConfig,
            },
          );

          progress.update("Installing Gateway service…");
          await service.install({
            env: process.env,
            stdout: process.stdout,
            programArguments,
            workingDirectory,
            environment,
          });
        }
      } catch (err) {
        installError = formatErrorMessage(err);
      } finally {
        progress.stop(
          installError ? "Gateway service install failed." : "Gateway service installed.",
        );
      }
      if (installError) {
        await prompter.note(`Gateway service install failed: ${installError}`, "Gateway");
        await prompter.note(gatewayInstallErrorHint(), "Gateway");
      }
    }
  }

  if (settings.authMode === "password") {
    try {
      resolvedGatewayPassword =
        (await resolveSetupSecretInputString({
          config: nextConfig,
          value: nextConfig.gateway?.auth?.password,
          path: "gateway.auth.password",
          env: process.env,
        })) ?? "";
    } catch (error) {
      await prompter.note(
        [
          "Could not resolve gateway.auth.password SecretRef for setup auth.",
          formatErrorMessage(error),
        ].join("\n"),
        "Gateway auth",
      );
    }
  }

  const shouldCheckGatewayHealth =
    !opts.skipHealth &&
    ((!isQuickstart && !isExtras) || installDaemon || (isExtras && extrasWantGateway));
  if (shouldCheckGatewayHealth) {
    const probeLinks = resolveGatewayHttpLinks({
      bind: nextConfig.gateway?.bind ?? "loopback",
      port: settings.port,
      customBindHost: nextConfig.gateway?.customBindHost,
      tlsEnabled: nextConfig.gateway?.tls?.enabled === true,
    });
    // Daemon install/restart can briefly flap the WS; wait a bit so health check doesn't false-fail.
    gatewayProbe = await waitForGatewayReachable({
      url: probeLinks.wsUrl,
      token: settings.authMode === "token" ? settings.gatewayToken : undefined,
      password: settings.authMode === "password" ? resolvedGatewayPassword : undefined,
      deadlineMs: 15_000,
    });
    if (gatewayProbe.ok) {
      try {
        const healthConfig: KovaConfig =
          settings.authMode === "token" && settings.gatewayToken
            ? {
                ...nextConfig,
                gateway: {
                  ...nextConfig.gateway,
                  auth: {
                    ...nextConfig.gateway?.auth,
                    mode: "token",
                    token: settings.gatewayToken,
                  },
                },
              }
            : nextConfig;
        await healthCommand(
          {
            json: false,
            timeoutMs: 10_000,
            config: healthConfig,
            token: settings.authMode === "token" ? settings.gatewayToken : undefined,
            password: settings.authMode === "password" ? resolvedGatewayPassword : undefined,
          },
          runtime,
        );
      } catch (err) {
        runtime.error(formatHealthCheckFailure(err));
        await prompter.note(
          [
            "Docs:",
            "https://docs.neuralstudio.in/gateway/health",
            "https://docs.neuralstudio.in/gateway/troubleshooting",
          ].join("\n"),
          "Health check help",
        );
      }
    } else if (installDaemon) {
      runtime.error(
        formatHealthCheckFailure(
          new Error(
            gatewayProbe.detail ?? `gateway did not become reachable at ${probeLinks.wsUrl}`,
          ),
        ),
      );
      await prompter.note(
        [
          "Docs:",
          "https://docs.neuralstudio.in/gateway/health",
          "https://docs.neuralstudio.in/gateway/troubleshooting",
        ].join("\n"),
        "Health check help",
      );
    } else {
      await prompter.note(
        [
          "Kova Gateway is not reachable yet.",
          "You skipped background service install, so no daemon is expected to be running.",
          `Start now: ${formatCliCommand("kova gateway run")}`,
          `Or rerun with: ${formatCliCommand("kova onboard --install-daemon")}`,
          `Or skip this probe next time: ${formatCliCommand("kova onboard --skip-health")}`,
        ].join("\n"),
        "Gateway",
      );
    }
  } else if (isQuickstart && !installDaemon) {
    await prompter.note(
      [
        "Gateway health check skipped for launch.",
        "Terminal chat runs locally without a Gateway service.",
        `Start Gateway later: ${formatCliCommand("kova gateway run")}`,
        `Install service later: ${formatCliCommand("kova onboard --install-daemon")}`,
      ].join("\n"),
      "Gateway",
    );
  } else if (isExtras && !extrasWantGateway) {
    await prompter.note(
      [
        "Gateway health check skipped because always-on Gateway was not selected.",
        `Check later: ${formatCliCommand("kova status --all")}`,
      ].join("\n"),
      "Gateway",
    );
  }

  if (!isQuickstart && !isExtras) {
    await prompter.note(
      [
        "Optional apps can extend Kova after terminal chat is working:",
        "- macOS app for system hooks and notifications",
        "- iOS app for camera and canvas workflows",
        "- Android app for camera and canvas workflows",
      ].join("\n"),
      "Kova apps",
    );
  } else if (isExtras && (extrasWantGateway || extraModules.includes("channels"))) {
    await prompter.note(
      [
        "Terminal chat is still the base.",
        "Apps and remote surfaces can be added after the local agent is working.",
      ].join("\n"),
      "Kova apps",
    );
  }

  const links = resolveGatewayHttpLinks({
    bind: settings.bind,
    port: settings.port,
    customBindHost: settings.customBindHost,
    tlsEnabled: nextConfig.gateway?.tls?.enabled === true,
  });
  const shouldProbeGatewayForSummary =
    (!isQuickstart && !isExtras) || installDaemon || (isExtras && extrasWantGateway);
  if (shouldProbeGatewayForSummary && (opts.skipHealth || !gatewayProbe.ok)) {
    gatewayProbe = await probeGatewayReachable({
      url: links.wsUrl,
      token: settings.authMode === "token" ? settings.gatewayToken : undefined,
      password: settings.authMode === "password" ? resolvedGatewayPassword : "",
    });
  }
  const gatewayStatusLine = gatewayProbe.ok
    ? "Gateway status: reachable"
    : `Gateway status: not detected${gatewayProbe.detail ? ` (${gatewayProbe.detail})` : ""}`;
  const bootstrapPath = path.join(
    resolveUserPath(options.workspaceDir),
    DEFAULT_BOOTSTRAP_FILENAME,
  );
  const hasBootstrap = await fs
    .access(bootstrapPath)
    .then(() => true)
    .catch(() => false);

  await prompter.note(
    (isQuickstart
      ? [
          `Primary start: ${formatCliCommand("kova")}`,
          "Runs the embedded local agent. No browser, Gateway, or chat channel is required.",
          "Useful first commands: /status, /memory, /persona, /tools",
          installDaemon
            ? `Gateway: ${gatewayProbe.ok ? "reachable" : "not detected"} at ${links.wsUrl}`
            : `Gateway: saved for later at ${links.wsUrl}`,
          installDaemon ? `Gateway detail: ${gatewayStatusLine}` : undefined,
          installDaemon
            ? "Add later: chat apps, web recall, skills, and automation."
            : "Add later: chat apps, web recall, skills, automation, background service.",
          "Docs: https://docs.neuralstudio.in/web/tui",
        ]
      : isExtras
        ? [
            `Primary start: ${formatCliCommand("kova")}`,
            "Runs the embedded local agent. No browser, Gateway, or chat channel is required.",
            "Useful first commands inside chat: /status, /memory, /persona, /tools",
            extraModules.length
              ? `Extras added: ${extraModules.join(", ")}`
              : "Extras added: none; current setup left in place.",
            extrasWantGateway
              ? `Gateway: ${gatewayProbe.ok ? "reachable" : "not detected"} at ${links.wsUrl}`
              : "Gateway: unchanged.",
            extrasWantGateway ? `Gateway detail: ${gatewayStatusLine}` : undefined,
            `Add more: ${formatCliCommand("kova settings")}`,
            "Docs: https://docs.neuralstudio.in/web/tui",
          ]
        : [
            `Primary start: ${formatCliCommand("kova")}`,
            "Runs the embedded local agent. No browser, Gateway, or chat channel is required.",
            "Useful first commands inside chat: /status, /memory, /persona, /tools",
            `Gateway: ${gatewayProbe.ok ? "reachable" : "not detected"} at ${links.wsUrl}`,
            `Gateway detail: ${gatewayStatusLine}`,
            "Docs: https://docs.neuralstudio.in/web/tui",
          ]
    )
      .filter(Boolean)
      .join("\n"),
    "Terminal start",
  );

  let hatchChoice: "tui" | "later" | null = null;
  let launchedTui = false;

  if (!opts.skipUi) {
    if (hasBootstrap) {
      await prompter.note(
        [
          "This first message gives Kova its first personal context.",
          "Take your time when the terminal opens.",
          "Specific goals, boundaries, and preferences make the agent more useful.",
          'We will send: "Wake up, my friend!"',
        ].join("\n"),
        "First chat",
      );
    }

    if (((!isQuickstart && !isExtras) || extrasWantGateway || installDaemon) && gatewayProbe.ok) {
      await prompter.note(
        [
          "Gateway token: shared auth for remote clients, channels, and nodes.",
          "Local terminal chat does not need a browser token.",
          "Stored in: $KOVA_CONFIG_PATH (default: ~/.kova/kova.json) under gateway.auth.token, or in KOVA_GATEWAY_TOKEN.",
          `View token: ${formatCliCommand("kova config get gateway.auth.token")}`,
          `Generate token: ${formatCliCommand("kova doctor --generate-gateway-token")}`,
        ].join("\n"),
        "Gateway token",
      );
    }

    const hatchOptions: { value: "tui" | "later"; label: string }[] = [
      { value: "tui", label: "Open Terminal chat (recommended)" },
      { value: "later", label: "Finish without launching" },
    ];

    hatchChoice = await prompter.select({
      message: "Choose where to start",
      options: hatchOptions,
      initialValue: "tui",
    });

    if (hatchChoice === "tui") {
      restoreTerminalState("pre-setup tui", { resumeStdinIfPaused: true });
      try {
        await launchTuiCli({
          local: true,
          deliver: false,
          message: hasBootstrap ? "Wake up, my friend!" : undefined,
          timeoutMs: HATCH_TUI_TIMEOUT_MS,
        });
      } finally {
        restoreTerminalState("post-setup tui", { resumeStdinIfPaused: true });
      }
      launchedTui = true;
    } else {
      await prompter.note(
        [
          `Start terminal chat: ${formatCliCommand("kova")}`,
          `Inspect readiness: ${formatCliCommand("kova status --all")}`,
          `Tune persona: ${formatCliCommand("kova persona edit")}`,
          `Check memory: ${formatCliCommand("kova memory status")}`,
        ]
          .filter(Boolean)
          .join("\n"),
        "Launch later",
      );
    }
  } else if (opts.skipUi) {
    await prompter.note(
      [
        "Start prompt skipped.",
        `Start terminal chat: ${formatCliCommand("kova")}`,
        `Inspect readiness: ${formatCliCommand("kova status --all")}`,
      ].join("\n"),
      "Start",
    );
  }

  if (!isQuickstart && !isExtras) {
    await prompter.note(
      [
        "Back up your Kova workspace.",
        "Docs: https://docs.neuralstudio.in/concepts/agent-workspace",
      ].join("\n"),
      "Backup",
    );

    await prompter.note(
      "Keep Kova secure: review access, review tools, and avoid public exposure. https://docs.neuralstudio.in/security",
      "Security",
    );
  } else if (isExtras) {
    await prompter.note(
      [
        "Only selected extras changed in this run.",
        `Add or revise extras later: ${formatCliCommand("kova settings")}`,
      ].join("\n"),
      "Extras",
    );
  }

  await setupWizardShellCompletion({ flow, prompter });

  const codexNativeSummary = describeCodexNativeWebSearch(nextConfig);
  const webSearchProvider = nextConfig.tools?.web?.search?.provider;
  const webSearchEnabled = nextConfig.tools?.web?.search?.enabled;
  const configuredSearchProviders = listConfiguredWebSearchProviders({ config: nextConfig });
  const shouldReportWebSearch = !isExtras || extraModules.includes("web");
  if (isQuickstart) {
    await prompter.note(
      [
        "Kova launch is ready.",
        `Chat: ${formatCliCommand("kova")}`,
        `Persona: ${formatCliCommand("kova persona edit")}`,
        `Memory: ${formatCliCommand("kova memory status")}`,
        `Extras: ${formatCliCommand("kova onboard --flow extras")}`,
      ].join("\n"),
      "Next steps",
    );
  } else if (isExtras && !shouldReportWebSearch) {
    await prompter.note(
      [
        "Kova extras are ready.",
        `Chat: ${formatCliCommand("kova")}`,
        `Settings: ${formatCliCommand("kova settings")}`,
        `Web search later: ${formatCliCommand("kova configure --section web")}`,
      ].join("\n"),
      "Next steps",
    );
  } else if (webSearchProvider) {
    const { resolveExistingKey, hasExistingKey, hasKeyInEnv } = await loadOnboardSearchModule();
    const entry = configuredSearchProviders.find((e) => e.id === webSearchProvider);
    const label = entry?.label ?? webSearchProvider;
    const storedKey = entry ? resolveExistingKey(nextConfig, webSearchProvider) : undefined;
    const keyConfigured = entry ? hasExistingKey(nextConfig, webSearchProvider) : false;
    const envAvailable = entry ? hasKeyInEnv(entry) : false;
    const hasKey = keyConfigured || envAvailable;
    const keySource = storedKey
      ? "API key: stored in config."
      : keyConfigured
        ? "API key: configured via secret reference."
        : envAvailable
          ? `API key: provided via ${entry?.envVars.join(" / ")} env var.`
          : undefined;
    if (!entry) {
      await prompter.note(
        [
          `Web search provider ${label} is selected but unavailable under the current plugin policy.`,
          "web_search will not work until the provider is re-enabled or a different provider is selected.",
          `  ${formatCliCommand("kova configure --section web")}`,
          "",
          "Docs: https://docs.neuralstudio.in/tools/web",
        ].join("\n"),
        "Web search",
      );
    } else if (webSearchEnabled !== false && hasKey) {
      await prompter.note(
        [
          "Web search is enabled, so Kova can look things up online when needed.",
          "",
          `Provider: ${label}`,
          ...(keySource ? [keySource] : []),
          "Docs: https://docs.neuralstudio.in/tools/web",
        ].join("\n"),
        "Web search",
      );
    } else if (!hasKey) {
      await prompter.note(
        [
          `Provider ${label} is selected but no API key was found.`,
          "web_search will stay unavailable until a key is added.",
          `  ${formatCliCommand("kova configure --section web")}`,
          "",
          `Get your key at: ${entry?.signupUrl ?? "https://docs.neuralstudio.in/tools/web"}`,
          "Docs: https://docs.neuralstudio.in/tools/web",
        ].join("\n"),
        "Web search",
      );
    } else {
      await prompter.note(
        [
          `Web search (${label}) is configured but disabled.`,
          `Re-enable: ${formatCliCommand("kova configure --section web")}`,
          "",
          "Docs: https://docs.neuralstudio.in/tools/web",
        ].join("\n"),
        "Web search",
      );
    }
  } else {
    // Legacy configs may have a working key (e.g. apiKey or BRAVE_API_KEY) without
    // an explicit provider. Runtime auto-detects these, so avoid saying "skipped".
    const { hasExistingKey, hasKeyInEnv } = await loadOnboardSearchModule();
    const legacyDetected = configuredSearchProviders.find(
      (e) => hasExistingKey(nextConfig, e.id) || hasKeyInEnv(e),
    );
    if (legacyDetected) {
      await prompter.note(
        [
          `Web search is available via ${legacyDetected.label} (auto-detected).`,
          "Docs: https://docs.neuralstudio.in/tools/web",
        ].join("\n"),
        "Web search",
      );
    } else if (codexNativeSummary) {
      await prompter.note(
        [
          "Managed web search provider was skipped.",
          codexNativeSummary,
          "Docs: https://docs.neuralstudio.in/tools/web",
        ].join("\n"),
        "Web search",
      );
    } else {
      await prompter.note(
        [
          "Web search was skipped. You can enable it later:",
          `  ${formatCliCommand("kova configure --section web")}`,
          "",
          "Docs: https://docs.neuralstudio.in/tools/web",
        ].join("\n"),
        "Web search",
      );
    }
  }

  if (!isQuickstart && (!isExtras || shouldReportWebSearch) && codexNativeSummary) {
    await prompter.note(
      [
        codexNativeSummary,
        "Used only for Codex-capable models.",
        "Docs: https://docs.neuralstudio.in/tools/web",
      ].join("\n"),
      "Codex native search",
    );
  }

  if (!isQuickstart && !isExtras) {
    await prompter.note(
      [
        `Chat: ${formatCliCommand("kova")}`,
        `Status: ${formatCliCommand("kova status --all")}`,
        `Persona: ${formatCliCommand("kova persona edit")}`,
        `Memory: ${formatCliCommand("kova memory status")}`,
        `Channels later: ${formatCliCommand("kova channels add --channel telegram")}`,
      ].join("\n"),
      "Next steps",
    );
  } else if (isExtras && shouldReportWebSearch) {
    await prompter.note(
      [
        "Kova extras are ready.",
        `Chat: ${formatCliCommand("kova")}`,
        `Settings: ${formatCliCommand("kova settings")}`,
        `Gateway later: ${formatCliCommand("kova configure --section gateway")}`,
      ].join("\n"),
      "Next steps",
    );
  }

  await prompter.outro(
    launchedTui
      ? "Kova terminal chat is ready."
      : "Kova is ready. Start with `kova` when you are ready.",
  );

  return { launchedTui };
}
