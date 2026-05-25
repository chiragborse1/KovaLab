import { resolveAgentModelPrimaryValue } from "../config/model-input.js";
import type { KovaConfig } from "../config/types.kova.js";
import { normalizeSecretInputString } from "../config/types.secrets.js";
import { shortenHomeInString } from "../utils.js";
import type { WizardPrompter } from "./prompts.js";
import type { GatewayWizardSettings, QuickstartGatewayDefaults } from "./setup.types.js";

export type SetupExtraModule = "gateway" | "channels" | "web" | "skills" | "plugins" | "hooks";

type SetupExtraChoice = SetupExtraModule | "__none__";

const SETUP_EXTRA_MODULES: Array<{
  value: SetupExtraModule;
  label: string;
  hint: string;
}> = [
  {
    value: "gateway",
    label: "Always-on Gateway",
    hint: "Port, login, network access, service, health",
  },
  {
    value: "channels",
    label: "Chat apps",
    hint: "Telegram, Slack, Discord, WhatsApp, Matrix, and similar surfaces",
  },
  {
    value: "web",
    label: "Web recall",
    hint: "Search provider and key setup",
  },
  {
    value: "skills",
    label: "Skill packs",
    hint: "Install optional local dependencies",
  },
  {
    value: "plugins",
    label: "Plugin settings",
    hint: "Provider and tool setup owned by plugins",
  },
  {
    value: "hooks",
    label: "Automation rules",
    hint: "Event hooks such as session memory capture",
  },
];

export function resolveGatewaySettingsFromDefaults(
  defaults: QuickstartGatewayDefaults,
): GatewayWizardSettings {
  return {
    port: defaults.port,
    bind: defaults.bind,
    customBindHost: defaults.customBindHost,
    authMode: defaults.authMode,
    gatewayToken:
      defaults.authMode === "token" ? normalizeSecretInputString(defaults.token) : undefined,
    tailscaleMode: defaults.tailscaleMode,
    tailscaleResetOnExit: defaults.tailscaleResetOnExit,
  };
}

function formatLaunchModel(config: KovaConfig): string {
  const model = resolveAgentModelPrimaryValue(config.agents?.defaults?.model);
  return model ? `Model: ${model}` : "Model: not selected yet";
}

function formatLaunchWorkspace(config: KovaConfig, workspaceDir: string): string {
  const configured = config.agents?.defaults?.workspace?.trim() || workspaceDir;
  return shortenHomeInString(`Workspace: ${configured}`);
}

function formatLaunchGateway(defaults: QuickstartGatewayDefaults): string {
  const access = [
    defaults.bind,
    String(defaults.port),
    defaults.authMode,
    defaults.tailscaleMode === "off" ? undefined : `tailscale ${defaults.tailscaleMode}`,
  ].filter(Boolean);
  return `Gateway: ${access.join(" ")}`;
}

function normalizeExtraChoice(value: unknown): SetupExtraChoice | undefined {
  if (value === "__none__") {
    return value;
  }
  return SETUP_EXTRA_MODULES.some((module) => module.value === value)
    ? (value as SetupExtraModule)
    : undefined;
}

export async function promptSetupExtraModules(params: {
  config: KovaConfig;
  workspaceDir: string;
  gatewayDefaults: QuickstartGatewayDefaults;
  excludeModules?: SetupExtraModule[];
  prompter: Pick<WizardPrompter, "note" | "multiselect">;
}): Promise<SetupExtraModule[]> {
  const excluded = new Set(params.excludeModules ?? []);
  const modules = SETUP_EXTRA_MODULES.filter((module) => !excluded.has(module.value));
  await params.prompter.note(
    [
      "Kova can start as a plain terminal agent.",
      "Extras are opt-in. Leave them off until you actually need them.",
      "",
      formatLaunchModel(params.config),
      formatLaunchWorkspace(params.config, params.workspaceDir),
      formatLaunchGateway(params.gatewayDefaults),
    ].join("\n"),
    "Before chat",
  );

  const rawChoices = await params.prompter.multiselect<SetupExtraChoice>({
    message: "Add anything before opening chat?",
    options: [
      {
        value: "__none__",
        label: "No extras, open chat",
        hint: "Fastest path",
      },
      ...modules,
    ],
    initialValues: ["__none__"],
    searchable: true,
  });

  const choices = rawChoices.map(normalizeExtraChoice).filter(Boolean) as SetupExtraChoice[];
  const selectedModules = choices.filter(
    (choice): choice is SetupExtraModule => choice !== "__none__",
  );
  if (selectedModules.length === 0) {
    return [];
  }

  return [...new Set(selectedModules)];
}
