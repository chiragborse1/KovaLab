import fs from "node:fs/promises";
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
import { resolveSetupSecretInputString } from "../wizard/setup.secret-input.js";
import { configureCommandWithSections } from "./configure.commands.js";
import type { WizardSection } from "./configure.shared.js";
import { resolveControlUiLinks, probeGatewayReachable } from "./onboard-helpers.js";
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
  status?: SettingsRowStatus;
  action?: SettingsAction;
  toggle?: SettingsToggle;
};

export type SettingsRowStatus = {
  text: string;
  tone: "ok" | "warn" | "muted" | "error";
};

export type SettingsStatusMap = Partial<Record<string, SettingsRowStatus>>;

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

function resolveDisplayWorkspace(cfg: OpenClawConfig): string {
  const configured = normalizeOptionalString(cfg.agents?.defaults?.workspace);
  if (!configured || isLegacyDefaultWorkspace(configured)) {
    return DEFAULT_AGENT_WORKSPACE_DIR;
  }
  return configured;
}

function displayWorkspace(cfg: OpenClawConfig): string {
  return shortenHomePath(resolveDisplayWorkspace(cfg));
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

function status(text: string, tone: SettingsRowStatus["tone"]): SettingsRowStatus {
  return { text, tone };
}

function withStatus(
  id: string,
  fallback: SettingsRowStatus | undefined,
  statusMap: SettingsStatusMap | undefined,
): SettingsRowStatus | undefined {
  return statusMap?.[id] ?? fallback;
}

export function buildSettingsDashboardRows(
  cfg: OpenClawConfig,
  statusMap?: SettingsStatusMap,
): SettingsDashboardRow[] {
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
      status: withStatus(
        "provider",
        model.provider === "Not set" ? status("⚠ Not set", "warn") : status("✓ Connected", "ok"),
        statusMap,
      ),
      action: { type: "configure", section: "model" },
    },
    {
      id: "model",
      label: "Model",
      value: model.model,
      hint: "Pick primary model and fallbacks",
      status: withStatus(
        "model",
        model.model === "Not set" ? status("⚠ Not set", "warn") : status("✓ Ready", "ok"),
        statusMap,
      ),
      action: { type: "configure", section: "model" },
    },
    {
      id: "workspace",
      label: "Workspace",
      value: displayWorkspace(cfg),
      hint: "Set agent workspace and session files",
      status: withStatus("workspace", status("✓ Kova", "ok"), statusMap),
      action: { type: "configure", section: "workspace" },
    },
    {
      id: "gateway",
      label: "Gateway",
      value: `${gatewayMode} :${String(gatewayPort)} ${gatewayAuth}`,
      hint: "Port, bind, auth, Tailscale",
      status: withStatus("gateway", status("… Checking", "muted"), statusMap),
      action: { type: "configure", section: "gateway" },
    },
    {
      id: "channels",
      label: "Channels",
      value: channels > 0 ? `${String(channels)} configured` : "Not linked",
      hint: "Link Telegram, WhatsApp, Discord, Slack, and more",
      status: withStatus(
        "channels",
        channels > 0 ? status("✓ Linked", "ok") : status("⚠ None", "warn"),
        statusMap,
      ),
      action: { type: "configure", section: "channels" },
    },
    {
      id: "memory",
      label: "Memory",
      value: enabledLabel(memoryEnabled),
      hint: "Space toggles memory search",
      status: withStatus(
        "memory",
        memoryEnabled ? status("… Checking", "muted") : status("Disabled", "muted"),
        statusMap,
      ),
      action: { type: "configure", section: "plugins" },
      toggle: "memory",
    },
    {
      id: "browser",
      label: "Browser Tools",
      value: enabledLabel(browserEnabled),
      hint: "Space toggles browser tool availability",
      status: withStatus(
        "browser",
        browserEnabled ? status("✓ Installed", "ok") : status("Disabled", "muted"),
        statusMap,
      ),
      action: { type: "configure", section: "gateway" },
      toggle: "browser",
    },
    {
      id: "voice",
      label: "Voice",
      value: enabledLabel(voiceEnabled),
      hint: "Space toggles outbound TTS auto mode",
      status: withStatus(
        "voice",
        voiceEnabled ? status("✓ Ready", "ok") : status("Disabled", "muted"),
        statusMap,
      ),
      action: { type: "configure", section: "plugins" },
      toggle: "voice",
    },
    {
      id: "web",
      label: "Web Search",
      value: webSearch?.enabled === false ? "Disabled" : (webSearch?.provider ?? "Auto"),
      hint: "Configure search and fetch tools",
      status: withStatus(
        "web",
        webSearch?.enabled === false ? status("Disabled", "muted") : status("✓ Ready", "ok"),
        statusMap,
      ),
      action: { type: "configure", section: "web" },
    },
    {
      id: "skills",
      label: "Skills",
      value: countSkills(cfg) > 0 ? `${String(countSkills(cfg))} allowed` : "Default",
      hint: "Install and enable workspace skills",
      status: withStatus("skills", status("✓ Available", "ok"), statusMap),
      action: { type: "configure", section: "skills" },
    },
    {
      id: "plugins",
      label: "Plugins",
      value: `${String(countEnabledPlugins(cfg))} enabled`,
      hint: "Configure plugin settings",
      status: withStatus(
        "plugins",
        countEnabledPlugins(cfg) > 0
          ? status(`✓ ${String(countEnabledPlugins(cfg))} Active`, "ok")
          : status("⚠ None", "warn"),
        statusMap,
      ),
      action: { type: "configure", section: "plugins" },
    },
    {
      id: "daemon",
      label: "Background Service",
      value: "Manage",
      hint: "Install or update service startup",
      status: withStatus("daemon", status("Check", "muted"), statusMap),
      action: { type: "configure", section: "daemon" },
    },
    {
      id: "health",
      label: "Health Check",
      value: "Run",
      hint: "Check Gateway and channel health",
      status: withStatus("health", status("Manual", "muted"), statusMap),
      action: { type: "health" },
    },
    {
      id: "theme",
      label: "Theme",
      value: themeName,
      hint: "Space cycles dashboard accent",
      status: withStatus("theme", status("✓ Active", "ok"), statusMap),
      toggle: "theme",
    },
    {
      id: "setup",
      label: "Full Setup",
      value: "Open",
      hint: "First-time setup, import, reset, bootstrap",
      status: withStatus("setup", status("Wizard", "muted"), statusMap),
      action: { type: "onboard" },
    },
    {
      id: "finish",
      label: "Finish",
      value: "Close",
      hint: "Close settings",
      status: withStatus("finish", status("Done", "muted"), statusMap),
      action: { type: "finish" },
    },
  ];
}

async function resolveSecretInput(cfg: OpenClawConfig, value: unknown, configPath: string) {
  try {
    return await resolveSetupSecretInputString({
      config: cfg,
      value,
      path: configPath,
      env: process.env,
    });
  } catch {
    return undefined;
  }
}

async function hasDirectoryEntries(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function resolveSettingsStatusMap(cfg: OpenClawConfig): Promise<SettingsStatusMap> {
  const workspaceDir = resolveUserPath(resolveDisplayWorkspace(cfg));
  const workspaceExists = await pathExists(workspaceDir);
  const memoryEnabled = cfg.agents?.defaults?.memorySearch?.enabled !== false;
  const memoryHasEntries = memoryEnabled
    ? await hasDirectoryEntries(path.join(workspaceDir, "memory"))
    : false;

  const gatewayPort = cfg.gateway?.port ?? 18789;
  const localLinks = resolveControlUiLinks({
    bind: cfg.gateway?.bind ?? "loopback",
    port: gatewayPort,
    customBindHost: cfg.gateway?.customBindHost,
    basePath: cfg.gateway?.controlUi?.basePath,
    tlsEnabled: cfg.gateway?.tls?.enabled === true,
  });
  const remoteUrl = normalizeOptionalString(cfg.gateway?.remote?.url);
  const gatewayUrl = cfg.gateway?.mode === "remote" && remoteUrl ? remoteUrl : localLinks.wsUrl;
  const [gatewayToken, gatewayPassword] = await Promise.all([
    resolveSecretInput(cfg, cfg.gateway?.auth?.token, "gateway.auth.token"),
    resolveSecretInput(cfg, cfg.gateway?.auth?.password, "gateway.auth.password"),
  ]);
  const gateway = await probeGatewayReachable({
    url: gatewayUrl,
    token: process.env.OPENCLAW_GATEWAY_TOKEN ?? gatewayToken,
    password: process.env.OPENCLAW_GATEWAY_PASSWORD ?? gatewayPassword,
    timeoutMs: 350,
  });

  return {
    workspace: workspaceExists ? status("✓ Exists", "ok") : status("⚠ Missing", "warn"),
    gateway: gateway.ok ? status("✓ Running", "ok") : status("⚠ Stopped", "warn"),
    memory: memoryEnabled
      ? memoryHasEntries
        ? status("✓ Has data", "ok")
        : status("⚠ Empty", "warn")
      : status("Disabled", "muted"),
  };
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

function styleStatus(rowStatus: SettingsRowStatus | undefined): string {
  if (!rowStatus) {
    return "";
  }
  if (rowStatus.tone === "ok") {
    return theme.success(rowStatus.text);
  }
  if (rowStatus.tone === "warn") {
    return theme.warn(rowStatus.text);
  }
  if (rowStatus.tone === "error") {
    return theme.error(rowStatus.text);
  }
  return theme.muted(rowStatus.text);
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
  message?: string;
  searchQuery?: string;
}): string {
  const width = 96;
  const inner = width - 2;
  const labelWidth = 22;
  const valueWidth = 28;
  const statusWidth = 18;
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
    const rowStatus = styleStatus(row.status);
    const toggle = row.toggle ? theme.muted("[space]") : "";
    lines.push(
      `│ ${cursor} ${padRight(label, labelWidth)} ${padRight(value, valueWidth)} ${padRight(rowStatus, statusWidth)} ${padRight(toggle, inner - labelWidth - valueWidth - statusWidth - 6)}│`,
    );
  }
  lines.push(`│${" ".repeat(inner)}│`);
  lines.push(`│${"─".repeat(inner)}│`);
  lines.push(`│  ${padRight("[Enter] Edit   [Space] Toggle   [/] Search   [Q] Quit", inner - 2)}│`);
  const footer =
    params.searchQuery !== undefined
      ? `Search: /${params.searchQuery}`
      : (params.message ?? "Ready");
  lines.push(`│  ${padRight(footer, inner - 2)}│`);
  lines.push(`╰${"─".repeat(inner)}╯`);
  return lines.join("\n");
}

function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/^\/+/, "").toLowerCase();
}

export function findSettingsRowIndex(rows: SettingsDashboardRow[], query: string): number {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) {
    return 0;
  }
  const found = rows.findIndex((row) =>
    [row.id, row.label, row.value, row.hint, row.status?.text]
      .filter((entry): entry is string => Boolean(entry))
      .some((entry) => entry.toLowerCase().includes(normalized)),
  );
  return found === -1 ? 0 : found;
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
  runtime.log(renderSettingsDashboard({ rows, selectedIndex: 0 }));
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
  let statusMap = await resolveSettingsStatusMap(workingConfig);
  if (!stdin.isTTY || !stdout.isTTY) {
    printNonInteractive(buildSettingsDashboardRows(workingConfig, statusMap), runtime);
    return;
  }

  let selectedIndex = 0;
  let message = "Use arrows to move, Enter to edit, Space to toggle, / to search.";
  let searchQuery: string | undefined;

  const render = () => {
    const rows = buildSettingsDashboardRows(workingConfig!, statusMap);
    stdout.write("\x1b[?25l\x1b[2J\x1b[H");
    stdout.write(renderSettingsDashboard({ rows, selectedIndex, message, searchQuery }));
  };

  const reload = async () => {
    workingConfig = await readCurrentConfig(runtime);
    if (workingConfig) {
      statusMap = await resolveSettingsStatusMap(workingConfig);
    }
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
        const rows = buildSettingsDashboardRows(workingConfig!, statusMap);
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
        if (searchQuery !== undefined) {
          if (key.name === "escape") {
            searchQuery = undefined;
            message = "Search cleared.";
            render();
            return;
          }
          if (key.name === "return") {
            searchQuery = undefined;
            message = rows[selectedIndex]?.hint ?? "Ready";
            render();
            return;
          }
          if (key.name === "backspace" || key.name === "delete") {
            searchQuery = searchQuery.slice(0, -1);
          } else if (_chunk && !key.ctrl && _chunk >= " " && _chunk !== "\x7f") {
            searchQuery += _chunk;
          }
          const nextIndex = findSettingsRowIndex(rows, searchQuery);
          selectedIndex = nextIndex;
          message =
            rows[nextIndex] && normalizeSearchQuery(searchQuery)
              ? `Jumped to ${rows[nextIndex].label}. Press Enter to edit.`
              : "Type to search settings.";
          render();
          return;
        }

        if (_chunk === "/") {
          searchQuery = "";
          message = "Type to search settings.";
          render();
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
          await saveConfig(workingConfig);
          await reload();
          message = `${selected.label} saved automatically.`;
          render();
          return;
        }
        if (key.name === "s") {
          message = "Settings auto-save after every toggle.";
          render();
          return;
        }
        if (key.name === "q" || key.name === "escape") {
          cleanup();
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
