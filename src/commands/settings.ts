import path from "node:path";
import { emitKeypressEvents } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";
import {
  DEFAULT_AGENT_WORKSPACE_DIR,
  resolveLegacyDefaultAgentWorkspaceDir,
} from "../agents/workspace-default.js";
import { formatCliCommand } from "../cli/command-format.js";
import { readConfigFileSnapshot } from "../config/config.js";
import { mutateConfigFile } from "../config/mutate.js";
import type { AgentModelConfig } from "../config/types.agents-shared.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { theme } from "../terminal/theme.js";
import { resolveUserPath, shortenHomePath, truncateUtf16Safe } from "../utils.js";
import { configureCommandWithSections } from "./configure.commands.js";
import type { WizardSection } from "./configure.shared.js";
import { setupWizardCommand } from "./onboard.js";

type SettingsAction =
  | { type: "configure"; section: WizardSection }
  | { type: "onboard" }
  | { type: "health" }
  | { type: "finish" };

type SettingsToggle = "memory" | "browser" | "voice" | "theme";

export type SettingsDashboardRow = {
  id: string;
  label: string;
  value: string;
  hint: string;
  action?: SettingsAction;
  toggle?: SettingsToggle;
};

type SettingsTheme = "Neural" | "Classic" | "Mono";

const THEME_ACCENTS: Record<SettingsTheme, string> = {
  Neural: "#ff710e",
  Classic: "#ff4500",
  Mono: "#9ca3af",
};

type KeypressInput = ReadStream & {
  on(
    event: "keypress",
    listener: (chunk: string, key: { name?: string; ctrl?: boolean }) => void,
  ): KeypressInput;
  off(
    event: "keypress",
    listener: (chunk: string, key: { name?: string; ctrl?: boolean }) => void,
  ): KeypressInput;
};

function modelPrimary(model: AgentModelConfig | undefined): string | undefined {
  if (typeof model === "string") {
    return normalizeOptionalString(model);
  }
  if (model && typeof model === "object" && "primary" in model) {
    return normalizeOptionalString(model.primary);
  }
  return undefined;
}

function splitModelRef(ref: string | undefined): { provider: string; model: string } {
  const normalized = normalizeOptionalString(ref);
  if (!normalized) {
    return { provider: "Not set", model: "Not set" };
  }
  const slash = normalized.indexOf("/");
  if (slash <= 0 || slash === normalized.length - 1) {
    return { provider: "Auto", model: normalized };
  }
  return {
    provider: normalized.slice(0, slash),
    model: normalized.slice(slash + 1),
  };
}

function enabledLabel(enabled: boolean): string {
  return enabled ? "Enabled" : "Disabled";
}

function isLegacyDefaultWorkspace(value: string): boolean {
  return (
    path.resolve(resolveUserPath(value)) ===
    path.resolve(resolveUserPath(resolveLegacyDefaultAgentWorkspaceDir()))
  );
}

function displayWorkspace(cfg: OpenClawConfig): string {
  const configured = normalizeOptionalString(cfg.agents?.defaults?.workspace);
  if (!configured || isLegacyDefaultWorkspace(configured)) {
    return shortenHomePath(DEFAULT_AGENT_WORKSPACE_DIR);
  }
  return shortenHomePath(configured);
}

function normalizeSettingsConfig(cfg: OpenClawConfig): OpenClawConfig {
  const workspace = normalizeOptionalString(cfg.agents?.defaults?.workspace);
  if (!workspace || !isLegacyDefaultWorkspace(workspace)) {
    return cfg;
  }
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        workspace: DEFAULT_AGENT_WORKSPACE_DIR,
      },
    },
  };
}

function countConfiguredChannels(cfg: OpenClawConfig): number {
  const channels = cfg.channels;
  if (!channels || typeof channels !== "object") {
    return 0;
  }
  return Object.values(channels).filter((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    if ((entry as Record<string, unknown>).enabled === false) {
      return false;
    }
    return true;
  }).length;
}

function countEnabledPlugins(cfg: OpenClawConfig): number {
  const entries = cfg.plugins?.entries;
  if (!entries) {
    return 0;
  }
  return Object.values(entries).filter((entry) => entry?.enabled !== false).length;
}

function countSkills(cfg: OpenClawConfig): number {
  const allow = cfg.skills?.allow;
  return Array.isArray(allow) ? allow.length : 0;
}

function resolveThemeName(cfg: OpenClawConfig): SettingsTheme {
  const accent = normalizeOptionalString(cfg.ui?.seamColor)?.toLowerCase();
  const match = Object.entries(THEME_ACCENTS).find(([, value]) => value.toLowerCase() === accent);
  return (match?.[0] as SettingsTheme | undefined) ?? "Neural";
}

export function buildSettingsDashboardRows(cfg: OpenClawConfig): SettingsDashboardRow[] {
  const model = splitModelRef(modelPrimary(cfg.agents?.defaults?.model));
  const channels = countConfiguredChannels(cfg);
  const webSearch = cfg.tools?.web?.search;
  const gatewayMode = cfg.gateway?.mode ?? "local";
  const gatewayPort = cfg.gateway?.port ?? 18789;
  const gatewayAuth = cfg.gateway?.auth?.mode ?? (cfg.gateway?.auth ? "token" : "default");
  const memoryEnabled = cfg.agents?.defaults?.memorySearch?.enabled !== false;
  const browserEnabled = cfg.browser?.enabled !== false;
  const tts = cfg.messages?.tts;
  const voiceEnabled = tts?.auto ? tts.auto !== "off" : tts?.enabled === true;
  const themeName = resolveThemeName(cfg);

  return [
    {
      id: "provider",
      label: "Provider",
      value: model.provider,
      hint: "Choose credentials and provider auth",
      action: { type: "configure", section: "model" },
    },
    {
      id: "model",
      label: "Model",
      value: model.model,
      hint: "Pick primary model and fallbacks",
      action: { type: "configure", section: "model" },
    },
    {
      id: "workspace",
      label: "Workspace",
      value: displayWorkspace(cfg),
      hint: "Set agent workspace and session files",
      action: { type: "configure", section: "workspace" },
    },
    {
      id: "gateway",
      label: "Gateway",
      value: `${gatewayMode} :${String(gatewayPort)} ${gatewayAuth}`,
      hint: "Port, bind, auth, Tailscale",
      action: { type: "configure", section: "gateway" },
    },
    {
      id: "channels",
      label: "Channels",
      value: channels > 0 ? `${String(channels)} configured` : "Not linked",
      hint: "Link Telegram, WhatsApp, Discord, Slack, and more",
      action: { type: "configure", section: "channels" },
    },
    {
      id: "memory",
      label: "Memory",
      value: enabledLabel(memoryEnabled),
      hint: "Space toggles memory search",
      action: { type: "configure", section: "plugins" },
      toggle: "memory",
    },
    {
      id: "browser",
      label: "Browser Tools",
      value: enabledLabel(browserEnabled),
      hint: "Space toggles browser tool availability",
      action: { type: "configure", section: "gateway" },
      toggle: "browser",
    },
    {
      id: "voice",
      label: "Voice",
      value: enabledLabel(voiceEnabled),
      hint: "Space toggles outbound TTS auto mode",
      action: { type: "configure", section: "plugins" },
      toggle: "voice",
    },
    {
      id: "web",
      label: "Web Search",
      value: webSearch?.enabled === false ? "Disabled" : (webSearch?.provider ?? "Auto"),
      hint: "Configure search and fetch tools",
      action: { type: "configure", section: "web" },
    },
    {
      id: "skills",
      label: "Skills",
      value: countSkills(cfg) > 0 ? `${String(countSkills(cfg))} allowed` : "Default",
      hint: "Install and enable workspace skills",
      action: { type: "configure", section: "skills" },
    },
    {
      id: "plugins",
      label: "Plugins",
      value: `${String(countEnabledPlugins(cfg))} enabled`,
      hint: "Configure plugin settings",
      action: { type: "configure", section: "plugins" },
    },
    {
      id: "daemon",
      label: "Background Service",
      value: "Manage",
      hint: "Install or update service startup",
      action: { type: "configure", section: "daemon" },
    },
    {
      id: "health",
      label: "Health Check",
      value: "Run",
      hint: "Check Gateway and channel health",
      action: { type: "health" },
    },
    {
      id: "theme",
      label: "Theme",
      value: themeName,
      hint: "Space cycles dashboard accent",
      toggle: "theme",
    },
    {
      id: "setup",
      label: "Full Setup",
      value: "Open",
      hint: "First-time setup, import, reset, bootstrap",
      action: { type: "onboard" },
    },
    {
      id: "finish",
      label: "Finish",
      value: "Close",
      hint: "Close settings",
      action: { type: "finish" },
    },
  ];
}

function nextThemeName(current: string): SettingsTheme {
  const names: SettingsTheme[] = ["Neural", "Classic", "Mono"];
  const index = names.indexOf(current as SettingsTheme);
  return names[(index + 1) % names.length] ?? "Neural";
}

export function applySettingsToggle(cfg: OpenClawConfig, toggle: SettingsToggle): OpenClawConfig {
  cfg = normalizeSettingsConfig(cfg);
  if (toggle === "memory") {
    const enabled = cfg.agents?.defaults?.memorySearch?.enabled !== false;
    return {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          memorySearch: {
            ...cfg.agents?.defaults?.memorySearch,
            enabled: !enabled,
          },
        },
      },
    };
  }

  if (toggle === "browser") {
    const enabled = cfg.browser?.enabled !== false;
    return {
      ...cfg,
      browser: {
        ...cfg.browser,
        enabled: !enabled,
      },
    };
  }

  if (toggle === "voice") {
    const tts = cfg.messages?.tts;
    const enabled = tts?.auto ? tts.auto !== "off" : tts?.enabled === true;
    return {
      ...cfg,
      messages: {
        ...cfg.messages,
        tts: {
          ...tts,
          auto: enabled ? "off" : "always",
        },
      },
    };
  }

  const name = nextThemeName(resolveThemeName(cfg));
  return {
    ...cfg,
    ui: {
      ...cfg.ui,
      seamColor: THEME_ACCENTS[name],
    },
  };
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

function padRight(input: string, width: number): string {
  const plainLength = stripAnsi(input).length;
  return input + " ".repeat(Math.max(0, width - plainLength));
}

function truncatePlain(input: string, width: number): string {
  if (stripAnsi(input).length <= width) {
    return input;
  }
  if (width <= 3) {
    return truncateUtf16Safe(input, width);
  }
  return `${truncateUtf16Safe(input, width - 3)}...`;
}

export function renderSettingsDashboard(params: {
  rows: SettingsDashboardRow[];
  selectedIndex: number;
  dirty: boolean;
  message?: string;
}): string {
  const width = 78;
  const inner = width - 2;
  const labelWidth = 22;
  const valueWidth = 30;
  const lines: string[] = [];
  lines.push(`╭${"─".repeat(18)} Kova Settings ${"─".repeat(inner - 33)}╮`);
  lines.push(`│${" ".repeat(inner)}│`);
  for (let index = 0; index < params.rows.length; index++) {
    const row = params.rows[index]!;
    const selected = index === params.selectedIndex;
    const cursor = selected ? theme.accent("›") : " ";
    const label = selected ? theme.heading(row.label) : row.label;
    const rawValue = truncatePlain(row.value, valueWidth);
    const value = selected ? theme.accentBright(rawValue) : rawValue;
    const toggle = row.toggle ? theme.muted("[space]") : "";
    lines.push(
      `│ ${cursor} ${padRight(label, labelWidth)} ${padRight(value, valueWidth)} ${padRight(toggle, inner - labelWidth - valueWidth - 5)}│`,
    );
  }
  lines.push(`│${" ".repeat(inner)}│`);
  lines.push(`│${"─".repeat(inner)}│`);
  lines.push(`│  ${padRight("[Enter] Edit   [Space] Toggle   [S] Save   [Q] Quit", inner - 2)}│`);
  const status = params.message ?? (params.dirty ? "Unsaved changes" : "Ready");
  lines.push(`│  ${padRight(status, inner - 2)}│`);
  lines.push(`╰${"─".repeat(inner)}╯`);
  return lines.join("\n");
}

async function readCurrentConfig(runtime: RuntimeEnv): Promise<OpenClawConfig | null> {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    runtime.error("Config invalid. Run `kova doctor --fix`, then run `kova settings` again.");
    for (const issue of snapshot.issues) {
      runtime.error(`- ${issue.path}: ${issue.message}`);
    }
    runtime.exit(1);
    return null;
  }
  return normalizeSettingsConfig(snapshot.sourceConfig ?? snapshot.config ?? {});
}

async function saveConfig(nextConfig: OpenClawConfig): Promise<void> {
  nextConfig = normalizeSettingsConfig(nextConfig);
  await mutateConfigFile({
    mutate: (draft) => {
      const target = draft as Record<string, unknown>;
      for (const key of Object.keys(target)) {
        delete target[key];
      }
      Object.assign(target, nextConfig);
    },
  });
}

function printNonInteractive(rows: SettingsDashboardRow[], runtime: RuntimeEnv): void {
  runtime.log(renderSettingsDashboard({ rows, selectedIndex: 0, dirty: false }));
  runtime.log("");
  runtime.log("Interactive controls need a TTY. Use `kova configure --section <name>` in scripts.");
}

async function runAction(action: SettingsAction, runtime: RuntimeEnv): Promise<void> {
  if (action.type === "configure") {
    await configureCommandWithSections([action.section], runtime);
    return;
  }
  if (action.type === "health") {
    await configureCommandWithSections(["health"], runtime);
    return;
  }
  if (action.type === "finish") {
    return;
  }
  await setupWizardCommand({}, runtime);
}

function describeAction(action: SettingsAction): string {
  if (action.type === "configure") {
    return `kova configure --section ${action.section}`;
  }
  if (action.type === "health") {
    return "kova configure --section health";
  }
  if (action.type === "finish") {
    return "kova settings";
  }
  return "kova onboard";
}

export async function settingsCommand(runtime: RuntimeEnv = defaultRuntime): Promise<void> {
  let workingConfig = await readCurrentConfig(runtime);
  if (!workingConfig) {
    return;
  }

  const stdin = process.stdin as KeypressInput;
  const stdout = process.stdout as WriteStream;
  if (!stdin.isTTY || !stdout.isTTY) {
    printNonInteractive(buildSettingsDashboardRows(workingConfig), runtime);
    return;
  }

  let selectedIndex = 0;
  let dirty = false;
  let message = "Use arrows to move, Enter to edit, Space to toggle.";

  const render = () => {
    const rows = buildSettingsDashboardRows(workingConfig!);
    stdout.write("\x1b[?25l\x1b[2J\x1b[H");
    stdout.write(renderSettingsDashboard({ rows, selectedIndex, dirty, message }));
  };

  let onKeypress:
    | ((chunk: string, key: { name?: string; ctrl?: boolean }) => Promise<void>)
    | undefined;

  const cleanup = () => {
    if (onKeypress) {
      stdin.off("keypress", onKeypress);
      onKeypress = undefined;
    }
    stdin.setRawMode(false);
    stdin.pause();
    stdout.write("\x1b[?25h\n");
  };

  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  render();

  await new Promise<void>((resolve, reject) => {
    onKeypress = async (_chunk: string, key: { name?: string; ctrl?: boolean }) => {
      try {
        const rows = buildSettingsDashboardRows(workingConfig!);
        const selected = rows[selectedIndex] ?? rows[0];
        if (!selected) {
          cleanup();
          resolve();
          return;
        }

        if (key.ctrl && key.name === "c") {
          cleanup();
          resolve();
          return;
        }
        if (key.name === "up") {
          selectedIndex = (selectedIndex - 1 + rows.length) % rows.length;
          message = selected.hint;
          render();
          return;
        }
        if (key.name === "down") {
          selectedIndex = (selectedIndex + 1) % rows.length;
          message = selected.hint;
          render();
          return;
        }
        if (key.name === "space") {
          if (!selected.toggle) {
            message =
              selected.action?.type === "finish"
                ? "Press Enter to close settings."
                : "This row opens an editor. Press Enter.";
            render();
            return;
          }
          workingConfig = applySettingsToggle(workingConfig!, selected.toggle);
          dirty = true;
          message = `${selected.label} changed. Press S to save.`;
          render();
          return;
        }
        if (key.name === "s") {
          if (dirty) {
            await saveConfig(workingConfig!);
            workingConfig = await readCurrentConfig(runtime);
            dirty = false;
            message = "Settings saved.";
            render();
            return;
          }
          message = "No changes to save.";
          render();
          return;
        }
        if (key.name === "q" || key.name === "escape") {
          cleanup();
          if (dirty) {
            runtime.log("Discarded unsaved settings changes.");
          }
          resolve();
          return;
        }
        if (key.name === "return") {
          if (!selected.action) {
            message = selected.toggle
              ? "Press Space to toggle this setting."
              : "No editor attached.";
            render();
            return;
          }
          cleanup();
          if (selected.action.type === "finish") {
            resolve();
            return;
          }
          if (dirty) {
            await saveConfig(workingConfig!);
          }
          runtime.log(`Opening ${formatCliCommand(describeAction(selected.action))}...`);
          await runAction(selected.action, runtime);
          await settingsCommand(runtime);
          resolve();
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    stdin.on("keypress", onKeypress);
  });
}
