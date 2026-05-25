import { resolveAgentModelPrimaryValue } from "../config/model-input.js";
import type { KovaConfig } from "../config/types.kova.js";
import { normalizeSecretInputString } from "../config/types.secrets.js";
import { shortenHomeInString } from "../utils.js";
import type { WizardPrompter } from "./prompts.js";
import type { GatewayWizardSettings, QuickstartGatewayDefaults } from "./setup.types.js";

export type SetupBuilderModule = "gateway" | "channels" | "web" | "skills" | "plugins" | "hooks";

type SetupBuilderChoice = SetupBuilderModule | "__chat__";

const SETUP_BUILDER_MODULES: Array<{
  value: SetupBuilderModule;
  label: string;
  hint: string;
}> = [
  {
    value: "gateway",
    label: "Gateway and service",
    hint: "Ports, token/password, network access, daemon, health",
  },
  {
    value: "channels",
    label: "Messaging channels",
    hint: "Telegram, Slack, Discord, WhatsApp, Matrix, and similar surfaces",
  },
  {
    value: "web",
    label: "Web search",
    hint: "Search provider and API key setup",
  },
  {
    value: "skills",
    label: "Skills",
    hint: "Install optional skill dependencies when you want them",
  },
  {
    value: "plugins",
    label: "Plugins",
    hint: "Provider/tool/plugin-owned setup blocks",
  },
  {
    value: "hooks",
    label: "Automation hooks",
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

function formatBuilderModel(config: KovaConfig): string {
  const model = resolveAgentModelPrimaryValue(config.agents?.defaults?.model);
  return model ? `model: ${model}` : "model: not selected";
}

function formatBuilderWorkspace(config: KovaConfig, workspaceDir: string): string {
  const configured = config.agents?.defaults?.workspace?.trim() || workspaceDir;
  return shortenHomeInString(`workspace: ${configured}`);
}

function formatBuilderGateway(defaults: QuickstartGatewayDefaults): string {
  const parts = [
    `gateway: ${defaults.bind}`,
    String(defaults.port),
    defaults.authMode,
    defaults.tailscaleMode === "off" ? undefined : `tailscale ${defaults.tailscaleMode}`,
  ].filter(Boolean);
  return parts.join(" ");
}

function normalizeBuilderChoice(value: unknown): SetupBuilderChoice | undefined {
  if (value === "__chat__") {
    return value;
  }
  return SETUP_BUILDER_MODULES.some((module) => module.value === value)
    ? (value as SetupBuilderModule)
    : undefined;
}

export async function promptSetupBuilderModules(params: {
  config: KovaConfig;
  workspaceDir: string;
  gatewayDefaults: QuickstartGatewayDefaults;
  prompter: Pick<WizardPrompter, "note" | "multiselect">;
}): Promise<SetupBuilderModule[]> {
  await params.prompter.note(
    [
      "Kova Builder is goal-based.",
      "Your model and workspace are the base. Everything else is optional and can be added later.",
      "Choose only the modules you want to set up now.",
      "",
      formatBuilderModel(params.config),
      formatBuilderWorkspace(params.config, params.workspaceDir),
      formatBuilderGateway(params.gatewayDefaults),
    ].join("\n"),
    "Kova Builder",
  );

  const rawChoices = await params.prompter.multiselect<SetupBuilderChoice>({
    message: "What should Kova build next?",
    options: [
      {
        value: "__chat__",
        label: "Open chat now",
        hint: "No extra setup modules",
      },
      ...SETUP_BUILDER_MODULES,
    ],
    initialValues: ["__chat__"],
    searchable: true,
  });

  const choices = rawChoices.map(normalizeBuilderChoice).filter(Boolean) as SetupBuilderChoice[];
  if (choices.length === 0 || choices.includes("__chat__")) {
    return [];
  }

  return [...new Set(choices)] as SetupBuilderModule[];
}
