import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CombinedAutocompleteProvider,
  Container,
  Key,
  Loader,
  matchesKey,
  ProcessTerminal,
  Text,
  TUI,
} from "@mariozechner/pi-tui";
import { resolveAgentIdByWorkspacePath, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { getRuntimeConfig, type KovaConfig } from "../config/config.js";
import type { CommandEntry } from "../gateway/protocol/index.js";
import { setConsoleSubsystemFilter } from "../logging/console.js";
import { loggingState } from "../logging/state.js";
import {
  buildAgentMainSessionKey,
  normalizeAgentId,
  normalizeMainKey,
  parseAgentSessionKey,
} from "../routing/session-key.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { getSlashCommands } from "./commands.js";
import { ChatLog } from "./components/chat-log.js";
import { CustomEditor } from "./components/custom-editor.js";
import { KovaHero, formatContextGauge } from "./components/kova-hero.js";
import { editorTheme, theme } from "./theme/theme.js";
import type { TuiBackend } from "./tui-backend.js";
import { createCommandHandlers } from "./tui-command-handlers.js";
import { createEventHandlers } from "./tui-event-handlers.js";
import { formatFooterSessionLabel, formatTokens, formatTuiFooterLine } from "./tui-formatters.js";
import { createLocalShellRunner } from "./tui-local-shell.js";
import { createOverlayHandlers } from "./tui-overlays.js";
import { createSessionActions } from "./tui-session-actions.js";
import {
  createEditorSubmitHandler,
  createSubmitBurstCoalescer,
  shouldEnableWindowsGitBashPasteFallback,
} from "./tui-submit.js";
import type {
  AgentSummary,
  QueuedMessage,
  SessionInfo,
  SessionScope,
  TuiBusyInputMode,
  TuiOptions,
  TuiResult,
  TuiStateAccess,
} from "./tui-types.js";
import { buildWaitingStatusMessage, defaultWaitingPhrases } from "./tui-waiting.js";
import { formatTuiTurnTrace, isTuiTurnTraceEnabled } from "./turn-trace.js";

export { resolveFinalAssistantText } from "./tui-formatters.js";
export type { TuiOptions } from "./tui-types.js";
export {
  createEditorSubmitHandler,
  createSubmitBurstCoalescer,
  shouldEnableWindowsGitBashPasteFallback,
} from "./tui-submit.js";

const KOVA_CLI_WRAPPER_PATH = fileURLToPath(new URL("../../kova.mjs", import.meta.url));
const KOVA_RUN_NODE_SCRIPT_PATH = fileURLToPath(
  new URL("../../scripts/run-node.mjs", import.meta.url),
);
const KOVA_DIST_ENTRY_JS_PATH = fileURLToPath(new URL("../../dist/entry.js", import.meta.url));
const KOVA_DIST_ENTRY_MJS_PATH = fileURLToPath(new URL("../../dist/entry.mjs", import.meta.url));

const OPENAI_CODEX_PROVIDER = "openai-codex";

type RunTuiOptions = TuiOptions & {
  backend?: TuiBackend;
  config?: KovaConfig;
  title?: string;
};

async function createTuiBackend(opts: RunTuiOptions): Promise<TuiBackend> {
  if (opts.backend) {
    return opts.backend;
  }
  if (opts.local) {
    if (process.env.KOVA_TUI_PROCESS_BACKEND === "1") {
      const { LocalProcessTuiBackend } = await import("./local-process-backend.js");
      return new LocalProcessTuiBackend();
    }
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    return new EmbeddedTuiBackend();
  }
  const { GatewayChatClient } = await import("./gateway-chat.js");
  return await GatewayChatClient.connect({
    url: opts.url,
    token: opts.token,
    password: opts.password,
  });
}

/** Resolve the absolute path to the `codex` CLI binary, or `null` if not installed. */
export function resolveCodexCliBin(): string | null {
  try {
    const lookupCmd = process.platform === "win32" ? "where" : "which";
    // `where` on Windows can return multiple lines; take the first match.
    const raw = execFileSync(lookupCmd, ["codex"], { encoding: "utf8" }).trim();
    return raw.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

export function resolveLocalAuthCliInvocation(params?: {
  execPath?: string;
  wrapperPath?: string;
  runNodePath?: string;
  hasDistEntry?: boolean;
  hasRunNodeScript?: boolean;
}): { command: string; args: string[] } {
  const hasDistEntry =
    params?.hasDistEntry ??
    (existsSync(KOVA_DIST_ENTRY_JS_PATH) || existsSync(KOVA_DIST_ENTRY_MJS_PATH));
  const hasRunNodeScript = params?.hasRunNodeScript ?? existsSync(KOVA_RUN_NODE_SCRIPT_PATH);
  const command = params?.execPath ?? process.execPath;
  const wrapperPath = params?.wrapperPath ?? KOVA_CLI_WRAPPER_PATH;
  const runNodePath = params?.runNodePath ?? KOVA_RUN_NODE_SCRIPT_PATH;

  // Prefer the packaged wrapper when build output exists, but keep source-tree
  // auth working in unbuilt checkouts that only have scripts/run-node.mjs.
  return hasDistEntry || !hasRunNodeScript
    ? { command, args: [wrapperPath, "models", "auth", "login"] }
    : { command, args: [runNodePath, "models", "auth", "login"] };
}

export function resolveLocalAuthSpawnOptions(params: {
  command: string;
  platform?: NodeJS.Platform;
}): { shell?: true } {
  const platform = params.platform ?? process.platform;
  return platform === "win32" && /\.(cmd|bat)$/iu.test(params.command.trim())
    ? { shell: true }
    : {};
}

export function resolveLocalAuthSpawnCwd(params: { args: string[]; defaultCwd?: string }): string {
  const defaultCwd = params.defaultCwd ?? process.cwd();
  const entryArg = params.args[0]?.trim();
  if (!entryArg) {
    return defaultCwd;
  }
  const entryBase = path.basename(entryArg).toLowerCase();
  if (entryBase === "kova.mjs") {
    return path.dirname(entryArg);
  }
  if (entryBase === "run-node.mjs") {
    return path.dirname(path.dirname(entryArg));
  }
  return defaultCwd;
}

export function resolveTuiSessionKey(params: {
  raw?: string;
  sessionScope: SessionScope;
  currentAgentId: string;
  sessionMainKey: string;
}) {
  const trimmed = (params.raw ?? "").trim();
  if (!trimmed) {
    if (params.sessionScope === "global") {
      return "global";
    }
    return buildAgentMainSessionKey({
      agentId: params.currentAgentId,
      mainKey: params.sessionMainKey,
    });
  }
  if (trimmed === "global" || trimmed === "unknown") {
    return trimmed;
  }
  if (trimmed.startsWith("agent:")) {
    return normalizeLowercaseStringOrEmpty(trimmed);
  }
  return `agent:${params.currentAgentId}:${normalizeLowercaseStringOrEmpty(trimmed)}`;
}

export function resolveInitialTuiAgentId(params: {
  cfg: KovaConfig;
  fallbackAgentId: string;
  initialSessionInput?: string;
  cwd?: string;
}) {
  const parsed = parseAgentSessionKey((params.initialSessionInput ?? "").trim());
  if (parsed?.agentId) {
    return normalizeAgentId(parsed.agentId);
  }

  const inferredFromWorkspace = resolveAgentIdByWorkspacePath(
    params.cfg,
    params.cwd ?? process.cwd(),
  );
  if (inferredFromWorkspace) {
    return inferredFromWorkspace;
  }

  return normalizeAgentId(params.fallbackAgentId);
}

export function resolveTuiModelLabel(params: {
  provider?: string | null;
  model?: string | null;
}): string {
  const model = params.model?.trim();
  if (!model) {
    return "unknown";
  }
  const provider = params.provider?.trim();
  if (!provider || model === provider || model.startsWith(`${provider}/`)) {
    return model;
  }
  return `${provider}/${model}`;
}

export function resolveGatewayDisconnectState(reason?: string): {
  connectionStatus: string;
  activityStatus: string;
  pairingHint?: string;
} {
  const reasonLabel = reason?.trim() ? reason.trim() : "closed";
  if (/pairing required/i.test(reasonLabel)) {
    return {
      connectionStatus: `gateway disconnected: ${reasonLabel}`,
      activityStatus: "pairing required: run kova devices list",
      pairingHint:
        "Pairing required. Run `kova devices list`, approve your request ID, then reconnect.",
    };
  }
  return {
    connectionStatus: `gateway disconnected: ${reasonLabel}`,
    activityStatus: "idle",
  };
}

export function createBackspaceDeduper(params?: { dedupeWindowMs?: number; now?: () => number }) {
  const dedupeWindowMs = Math.max(0, Math.floor(params?.dedupeWindowMs ?? 8));
  const now = params?.now ?? (() => Date.now());
  let lastBackspaceAt = -1;

  return (data: string): string => {
    if (!matchesKey(data, Key.backspace)) {
      return data;
    }
    const ts = now();
    if (lastBackspaceAt >= 0 && ts - lastBackspaceAt <= dedupeWindowMs) {
      return "";
    }
    lastBackspaceAt = ts;
    return data;
  };
}

export function isIgnorableTuiStopError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: unknown; syscall?: unknown; message?: unknown };
  const code = typeof err.code === "string" ? err.code : "";
  const syscall = typeof err.syscall === "string" ? err.syscall : "";
  const message = typeof err.message === "string" ? err.message : "";
  if (code === "EBADF" && syscall === "setRawMode") {
    return true;
  }
  return /setRawMode/i.test(message) && /EBADF/i.test(message);
}

export function stopTuiSafely(stop: () => void): void {
  try {
    stop();
  } catch (error) {
    if (!isIgnorableTuiStopError(error)) {
      throw error;
    }
  }
}

type DrainableTui = {
  stop: () => void;
  terminal?: {
    drainInput?: (maxMs?: number, idleMs?: number) => Promise<void>;
  };
};

export async function drainAndStopTuiSafely(tui: DrainableTui): Promise<void> {
  if (typeof tui.terminal?.drainInput === "function") {
    try {
      await tui.terminal.drainInput();
    } catch {
      // Best-effort only. A failed drain should not skip terminal shutdown.
    }
  }
  stopTuiSafely(() => tui.stop());
}

type CtrlCAction = "clear" | "warn" | "exit";

export function resolveCtrlCAction(params: {
  hasInput: boolean;
  now: number;
  lastCtrlCAt: number;
  exitWindowMs?: number;
}): { action: CtrlCAction; nextLastCtrlCAt: number } {
  const exitWindowMs = Math.max(1, Math.floor(params.exitWindowMs ?? 1000));
  if (params.hasInput) {
    return {
      action: "clear",
      nextLastCtrlCAt: params.now,
    };
  }
  if (params.now - params.lastCtrlCAt <= exitWindowMs) {
    return {
      action: "exit",
      nextLastCtrlCAt: params.lastCtrlCAt,
    };
  }
  return {
    action: "warn",
    nextLastCtrlCAt: params.now,
  };
}

export async function runTui(opts: RunTuiOptions): Promise<TuiResult> {
  const isLocalMode = opts.local === true || opts.backend !== undefined;
  const config = opts.config ?? getRuntimeConfig();
  const initialSessionInput = (opts.session ?? "").trim();
  let sessionScope: SessionScope = (config.session?.scope ?? "per-sender") as SessionScope;
  let sessionMainKey = normalizeMainKey(config.session?.mainKey);
  let agentDefaultId = resolveDefaultAgentId(config);
  let currentAgentId = resolveInitialTuiAgentId({
    cfg: config,
    fallbackAgentId: agentDefaultId,
    initialSessionInput,
    cwd: process.cwd(),
  });
  let agents: AgentSummary[] = [];
  const agentNames = new Map<string, string>();
  let currentSessionKey = "";
  let initialSessionApplied = false;
  let currentSessionId: string | null = null;
  let activeChatRunId: string | null = null;
  let pendingOptimisticUserMessage = false;
  let pendingChatRunId: string | null = null;
  let busyInputMode: TuiBusyInputMode = "queue";
  let queuedMessages: QueuedMessage[] = [];
  let historyLoaded = false;
  let isConnected = false;
  let wasDisconnected = false;
  let toolsExpanded = false;
  let showThinking = false;
  let pairingHintShown = false;
  const localRunIds = new Set<string>();
  const localBtwRunIds = new Set<string>();

  const deliverDefault = opts.deliver ?? false;
  const autoMessage = opts.message?.trim();
  let autoMessageSent = false;
  let sessionInfo: SessionInfo = {};
  let dynamicSlashCommands: CommandEntry[] = [];
  let dynamicSlashCommandsKey: string | null = null;
  let dynamicSlashCommandsInFlightKey: string | null = null;
  let dynamicSlashCommandsRequestId = 0;
  let dynamicSlashCommandsTimer: NodeJS.Timeout | null = null;
  let lastCtrlCAt = 0;
  let exitRequested = false;
  let exitResult: TuiResult = { exitReason: "exit" };
  let activityStatus = "idle";
  let activityDetail: string | null = null;
  let connectionStatus = isLocalMode ? "starting local runtime" : "connecting";
  let statusTimeout: NodeJS.Timeout | null = null;
  let statusStartedAt: number | null = null;

  const state: TuiStateAccess = {
    get agentDefaultId() {
      return agentDefaultId;
    },
    set agentDefaultId(value) {
      agentDefaultId = value;
    },
    get sessionMainKey() {
      return sessionMainKey;
    },
    set sessionMainKey(value) {
      sessionMainKey = value;
    },
    get sessionScope() {
      return sessionScope;
    },
    set sessionScope(value) {
      sessionScope = value;
    },
    get agents() {
      return agents;
    },
    set agents(value) {
      agents = value;
    },
    get currentAgentId() {
      return currentAgentId;
    },
    set currentAgentId(value) {
      currentAgentId = value;
    },
    get currentSessionKey() {
      return currentSessionKey;
    },
    set currentSessionKey(value) {
      currentSessionKey = value;
    },
    get currentSessionId() {
      return currentSessionId;
    },
    set currentSessionId(value) {
      currentSessionId = value;
    },
    get activeChatRunId() {
      return activeChatRunId;
    },
    set activeChatRunId(value) {
      activeChatRunId = value;
    },
    get pendingOptimisticUserMessage() {
      return pendingOptimisticUserMessage;
    },
    set pendingOptimisticUserMessage(value) {
      pendingOptimisticUserMessage = value;
    },
    get pendingChatRunId() {
      return pendingChatRunId;
    },
    set pendingChatRunId(value) {
      pendingChatRunId = value?.trim() ? value.trim() : null;
    },
    get busyInputMode() {
      return busyInputMode;
    },
    set busyInputMode(value) {
      busyInputMode = value ?? "queue";
    },
    get queuedMessages() {
      return queuedMessages;
    },
    set queuedMessages(value) {
      queuedMessages = Array.isArray(value) ? value : [];
    },
    get historyLoaded() {
      return historyLoaded;
    },
    set historyLoaded(value) {
      historyLoaded = value;
    },
    get sessionInfo() {
      return sessionInfo;
    },
    set sessionInfo(value) {
      sessionInfo = value;
    },
    get initialSessionApplied() {
      return initialSessionApplied;
    },
    set initialSessionApplied(value) {
      initialSessionApplied = value;
    },
    get isConnected() {
      return isConnected;
    },
    set isConnected(value) {
      isConnected = value;
    },
    get autoMessageSent() {
      return autoMessageSent;
    },
    set autoMessageSent(value) {
      autoMessageSent = value;
    },
    get toolsExpanded() {
      return toolsExpanded;
    },
    set toolsExpanded(value) {
      toolsExpanded = value;
    },
    get showThinking() {
      return showThinking;
    },
    set showThinking(value) {
      showThinking = value;
    },
    get connectionStatus() {
      return connectionStatus;
    },
    set connectionStatus(value) {
      connectionStatus = value;
    },
    get activityStatus() {
      return activityStatus;
    },
    set activityStatus(value) {
      activityStatus = value;
    },
    get activityDetail() {
      return activityDetail;
    },
    set activityDetail(value) {
      activityDetail = value?.trim() ? value.trim() : null;
    },
    get statusTimeout() {
      return statusTimeout;
    },
    set statusTimeout(value) {
      statusTimeout = value;
    },
    get lastCtrlCAt() {
      return lastCtrlCAt;
    },
    set lastCtrlCAt(value) {
      lastCtrlCAt = value;
    },
  };

  const noteLocalRunId = (runId: string) => {
    if (!runId) {
      return;
    }
    localRunIds.add(runId);
    if (localRunIds.size > 200) {
      const [first] = localRunIds;
      if (first) {
        localRunIds.delete(first);
      }
    }
  };

  const forgetLocalRunId = (runId: string) => {
    localRunIds.delete(runId);
  };

  const isLocalRunId = (runId: string) => localRunIds.has(runId);

  const clearLocalRunIds = () => {
    localRunIds.clear();
  };

  const noteLocalBtwRunId = (runId: string) => {
    if (!runId) {
      return;
    }
    localBtwRunIds.add(runId);
    if (localBtwRunIds.size > 200) {
      const [first] = localBtwRunIds;
      if (first) {
        localBtwRunIds.delete(first);
      }
    }
  };

  const forgetLocalBtwRunId = (runId: string) => {
    localBtwRunIds.delete(runId);
  };

  const isLocalBtwRunId = (runId: string) => localBtwRunIds.has(runId);

  const clearLocalBtwRunIds = () => {
    localBtwRunIds.clear();
  };

  const client = await createTuiBackend(opts);
  const previousConsoleSubsystemFilter = isLocalMode
    ? loggingState.consoleSubsystemFilter
      ? [...loggingState.consoleSubsystemFilter]
      : null
    : null;
  if (isLocalMode) {
    setConsoleSubsystemFilter(["__kova_tui_quiet__"]);
  }

  const tui = new TUI(new ProcessTerminal());
  const dedupeBackspace = createBackspaceDeduper();
  tui.addInputListener((data) => {
    const next = dedupeBackspace(data);
    if (next.length === 0) {
      return { consume: true };
    }
    return { data: next };
  });
  const hero = new KovaHero();
  const statusContainer = new Container();
  const footer = new Text("", 1, 0);
  const chatLog = new ChatLog();
  const editor = new CustomEditor(tui, editorTheme);
  const root = new Container();
  root.addChild(hero);
  root.addChild(chatLog);
  root.addChild(statusContainer);
  root.addChild(footer);
  root.addChild(editor);

  const resolveDynamicSlashCommandsKey = () => currentAgentId;

  const applyAutocompleteProvider = () => {
    const dynamicKey = resolveDynamicSlashCommandsKey();
    editor.setAutocompleteProvider(
      new CombinedAutocompleteProvider(
        getSlashCommands({
          cfg: config,
          local: isLocalMode,
          provider: sessionInfo.modelProvider,
          model: sessionInfo.model,
          dynamicCommands: dynamicSlashCommandsKey === dynamicKey ? dynamicSlashCommands : [],
        }),
        process.cwd(),
      ),
    );
  };

  const refreshDynamicSlashCommands = () => {
    const key = resolveDynamicSlashCommandsKey();
    if (
      !isConnected ||
      !client.listCommands ||
      dynamicSlashCommandsKey === key ||
      dynamicSlashCommandsInFlightKey === key
    ) {
      return;
    }
    dynamicSlashCommandsInFlightKey = key;
    const requestId = ++dynamicSlashCommandsRequestId;
    const agentId = currentAgentId;
    void client
      .listCommands({
        agentId,
        scope: "text",
        includeArgs: false,
      })
      .then((commands) => {
        if (
          requestId !== dynamicSlashCommandsRequestId ||
          key !== resolveDynamicSlashCommandsKey()
        ) {
          return;
        }
        dynamicSlashCommands = commands;
        dynamicSlashCommandsKey = key;
        applyAutocompleteProvider();
      })
      .catch(() => undefined)
      .finally(() => {
        if (dynamicSlashCommandsInFlightKey === key) {
          dynamicSlashCommandsInFlightKey = null;
        }
      });
  };

  const clearDynamicSlashCommandsTimer = () => {
    if (!dynamicSlashCommandsTimer) {
      return;
    }
    clearTimeout(dynamicSlashCommandsTimer);
    dynamicSlashCommandsTimer = null;
  };

  const scheduleDynamicSlashCommandsRefresh = (delayMs = 1200) => {
    if (dynamicSlashCommandsTimer) {
      return;
    }
    dynamicSlashCommandsTimer = setTimeout(() => {
      dynamicSlashCommandsTimer = null;
      refreshDynamicSlashCommands();
    }, delayMs);
    dynamicSlashCommandsTimer.unref?.();
  };

  const updateAutocompleteProvider = () => {
    applyAutocompleteProvider();
    if (isConnected) {
      scheduleDynamicSlashCommandsRefresh();
    }
  };

  tui.addChild(root);
  tui.setFocus(editor);

  const formatSessionKey = (key: string) => {
    if (key === "global" || key === "unknown") {
      return key;
    }
    const parsed = parseAgentSessionKey(key);
    return parsed?.rest ?? key;
  };

  const formatAgentLabel = (id: string) => {
    const name = agentNames.get(id);
    return name ? `${id} (${name})` : id;
  };

  const resolveSessionKey = (raw?: string) => {
    return resolveTuiSessionKey({
      raw,
      sessionScope,
      currentAgentId,
      sessionMainKey,
    });
  };

  currentSessionKey = resolveSessionKey(initialSessionInput);

  let catalogRefreshKey = "";
  let catalogRefreshPromise: Promise<void> | null = null;
  let catalogRefreshTimer: NodeJS.Timeout | null = null;
  let startupHydrated = false;

  const refreshHeroCatalog = async (agentId: string) => {
    hero.setState({ catalogStatus: "refreshing live tools and skills..." });
    tui.requestRender();
    const [toolsResult, skillsResult] = await Promise.allSettled([
      client.listTools?.({ agentId, includePlugins: false }) ??
        Promise.resolve({ agentId, profiles: [], groups: [] }),
      client.listSkills?.({ agentId }) ??
        Promise.resolve({ workspaceDir: "", managedSkillsDir: "", skills: [] }),
    ]);
    if (agentId !== currentAgentId) {
      return;
    }

    if (toolsResult.status === "fulfilled") {
      hero.setState({ toolGroups: toolsResult.value.groups });
    }
    if (skillsResult.status === "fulfilled") {
      hero.setState({ skills: skillsResult.value.skills });
    }

    const failed = [toolsResult, skillsResult].filter((result) => result.status === "rejected");
    if (failed.length > 0) {
      hero.setState({
        catalogStatus: `catalog partially unavailable (${String(failed.length)} request${failed.length === 1 ? "" : "s"} failed)`,
      });
    } else {
      hero.setState({ catalogStatus: "" });
    }
    tui.requestRender();
  };

  const clearCatalogRefreshTimer = () => {
    if (!catalogRefreshTimer) {
      return;
    }
    clearTimeout(catalogRefreshTimer);
    catalogRefreshTimer = null;
  };

  const scheduleHeroCatalogRefresh = (delayMs = 1200) => {
    if (catalogRefreshTimer) {
      return;
    }
    catalogRefreshTimer = setTimeout(() => {
      catalogRefreshTimer = null;
      maybeRefreshHeroCatalog();
    }, delayMs);
    catalogRefreshTimer.unref?.();
  };

  function maybeRefreshHeroCatalog() {
    if (!isConnected) {
      return;
    }
    if (!startupHydrated) {
      scheduleHeroCatalogRefresh(2000);
      return;
    }
    const key = currentAgentId;
    if (!key || catalogRefreshKey === key || catalogRefreshPromise) {
      return;
    }
    if (
      busyStates.has(activityStatus) ||
      activeChatRunId ||
      pendingChatRunId ||
      pendingOptimisticUserMessage
    ) {
      scheduleHeroCatalogRefresh();
      return;
    }
    clearCatalogRefreshTimer();
    catalogRefreshKey = key;
    catalogRefreshPromise = refreshHeroCatalog(key)
      .catch(() => {
        hero.setState({ catalogStatus: "catalog unavailable" });
      })
      .finally(() => {
        catalogRefreshPromise = null;
        if (currentAgentId !== key) {
          catalogRefreshKey = "";
          maybeRefreshHeroCatalog();
        }
      });
  }

  const updateHeader = () => {
    const sessionLabel = formatSessionKey(currentSessionKey);
    const agentLabel = formatAgentLabel(currentAgentId);
    const title = opts.title ?? "Kova Agent";
    const modelLabel = resolveTuiModelLabel({
      provider: sessionInfo.modelProvider,
      model: sessionInfo.model,
    });
    hero.setState({
      title,
      connection: client.connection.url,
      connectionStatus,
      activityStatus,
      agentLabel,
      sessionLabel,
      modelLabel,
      tokenLabel: formatTokens(sessionInfo.totalTokens ?? null, sessionInfo.contextTokens ?? null),
    });
    maybeRefreshHeroCatalog();
  };

  const busyStates = new Set(["sending", "waiting", "streaming", "running"]);
  let statusText: Text | null = null;
  let statusLoader: Loader | null = null;

  const formatElapsed = (startMs: number) => {
    const totalSeconds = elapsedSecondsSince(startMs);
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  const elapsedSecondsSince = (startMs: number) => {
    return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  };

  const resolveActivityDetail = (elapsedSeconds: number) => {
    if (activityDetail) {
      return activityDetail;
    }
    if (activityStatus === "waiting") {
      if (elapsedSeconds >= 60) {
        return "long model request; provider or network may be slow";
      }
      if (elapsedSeconds >= 20) {
        return "provider request still running";
      }
      if (elapsedSeconds >= 8) {
        return "waiting for model response";
      }
    }
    return null;
  };

  const ensureStatusText = () => {
    if (statusText) {
      return;
    }
    statusContainer.clear();
    statusLoader?.stop();
    statusLoader = null;
    statusText = new Text("", 1, 0);
    statusContainer.addChild(statusText);
  };

  const ensureStatusLoader = () => {
    if (statusLoader) {
      return;
    }
    statusContainer.clear();
    statusText = null;
    statusLoader = new Loader(
      tui,
      (spinner) => theme.accentSoft(spinner),
      (text) => theme.userText(text),
      "",
    );
    statusContainer.addChild(statusLoader);
  };

  let waitingTick = 0;
  let statusTimer: NodeJS.Timeout | null = null;
  let waitingTimer: NodeJS.Timeout | null = null;
  let waitingPhrase: string | null = null;

  const updateBusyStatusMessage = () => {
    if (!statusLoader || !statusStartedAt) {
      return;
    }
    const elapsedSeconds = elapsedSecondsSince(statusStartedAt);
    const elapsed = formatElapsed(statusStartedAt);
    const detail = resolveActivityDetail(elapsedSeconds);

    if (activityStatus === "waiting") {
      waitingTick++;
      statusLoader.setMessage(
        buildWaitingStatusMessage({
          theme: {
            dim: theme.userText,
            bold: theme.bold,
            accentSoft: theme.accentSoft,
          },
          tick: waitingTick,
          elapsed,
          connectionStatus,
          phase: detail,
          phrases: waitingPhrase ? [waitingPhrase] : undefined,
        }),
      );
      return;
    }

    const detailText = detail ? ` | ${detail}` : "";
    statusLoader.setMessage(`${activityStatus} • ${elapsed}${detailText} | ${connectionStatus}`);
  };

  const startStatusTimer = () => {
    if (statusTimer) {
      return;
    }
    statusTimer = setInterval(() => {
      if (!busyStates.has(activityStatus)) {
        return;
      }
      updateBusyStatusMessage();
    }, 1000);
    statusTimer.unref?.();
  };

  const stopStatusTimer = () => {
    if (!statusTimer) {
      return;
    }
    clearInterval(statusTimer);
    statusTimer = null;
  };

  const startWaitingTimer = () => {
    if (waitingTimer) {
      return;
    }

    // Pick a phrase once per waiting session.
    if (!waitingPhrase) {
      const idx = Math.floor(Math.random() * defaultWaitingPhrases.length);
      waitingPhrase = defaultWaitingPhrases[idx] ?? defaultWaitingPhrases[0] ?? "waiting";
    }

    waitingTick = 0;

    waitingTimer = setInterval(() => {
      if (activityStatus !== "waiting") {
        return;
      }
      updateBusyStatusMessage();
    }, 120);
    waitingTimer.unref?.();
  };

  const stopWaitingTimer = () => {
    if (!waitingTimer) {
      return;
    }
    clearInterval(waitingTimer);
    waitingTimer = null;
    waitingPhrase = null;
  };

  const renderStatus = () => {
    const isBusy = busyStates.has(activityStatus);
    if (isBusy) {
      if (!statusStartedAt) {
        statusStartedAt = Date.now();
      }
      ensureStatusLoader();
      if (activityStatus === "waiting") {
        stopStatusTimer();
        startWaitingTimer();
      } else {
        stopWaitingTimer();
        startStatusTimer();
      }
      updateBusyStatusMessage();
    } else {
      statusStartedAt = null;
      activityDetail = null;
      stopStatusTimer();
      stopWaitingTimer();
      statusLoader?.stop();
      statusLoader = null;
      ensureStatusText();
      const text =
        activityStatus && activityStatus !== "idle"
          ? `${connectionStatus} | ${activityStatus}`
          : connectionStatus;
      statusText?.setText(theme.userText(text));
    }
    updateHeader();
  };

  const setConnectionStatus = (text: string, ttlMs?: number) => {
    connectionStatus = text;
    renderStatus();
    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }
    if (ttlMs && ttlMs > 0) {
      statusTimeout = setTimeout(() => {
        connectionStatus = isConnected
          ? isLocalMode
            ? "local ready"
            : "connected"
          : isLocalMode
            ? "local stopped"
            : "disconnected";
        renderStatus();
      }, ttlMs);
    }
  };

  const setActivityStatus = (text: string) => {
    activityStatus = text;
    if (!busyStates.has(text) || text === "sending" || text === "streaming") {
      activityDetail = null;
    }
    renderStatus();
  };

  const withTuiSuspended = async <T>(work: () => Promise<T>): Promise<T> => {
    await drainAndStopTuiSafely(tui);
    if (isLocalMode) {
      setConsoleSubsystemFilter(previousConsoleSubsystemFilter);
    }
    try {
      return await work();
    } finally {
      if (isLocalMode) {
        setConsoleSubsystemFilter(["__kova_tui_quiet__"]);
      }
      tui.start();
      tui.setFocus(editor);
      updateHeader();
      updateFooter();
      tui.requestRender(true);
    }
  };

  const runAuthFlow = isLocalMode
    ? async (params: { provider?: string }) =>
        await withTuiSuspended(
          async () =>
            await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
              (resolve, reject) => {
                const provider = params.provider?.trim() || undefined;

                // Codex owns its auth store; delegate when the CLI is available.
                const codexBin =
                  provider === OPENAI_CODEX_PROVIDER ||
                  (!provider && sessionInfo.modelProvider === OPENAI_CODEX_PROVIDER)
                    ? resolveCodexCliBin()
                    : null;

                let command: string;
                let args: string[];
                if (codexBin) {
                  command = codexBin;
                  args = ["login"];
                } else {
                  ({ command, args } = resolveLocalAuthCliInvocation());
                  if (provider) {
                    args.push("--provider", provider);
                  }
                }

                const child = spawn(command, args, {
                  cwd: resolveLocalAuthSpawnCwd({ args, defaultCwd: process.cwd() }),
                  env: process.env,
                  stdio: "inherit",
                  ...resolveLocalAuthSpawnOptions({ command }),
                });
                child.once("error", reject);
                child.once("exit", (exitCode, signal) => {
                  resolve({ exitCode, signal });
                });
              },
            ),
        )
    : undefined;

  const updateFooter = () => {
    const sessionKeyLabel = formatSessionKey(currentSessionKey);
    const agentLabel = formatAgentLabel(currentAgentId);
    const sessionLabel = formatFooterSessionLabel({
      agentLabel,
      sessionLabel: sessionKeyLabel,
      displayName: sessionInfo.displayName,
    });
    const tokens = formatContextGauge(
      formatTokens(sessionInfo.totalTokens ?? null, sessionInfo.contextTokens ?? null),
    );
    const footerLine = formatTuiFooterLine({
      sessionLabel,
      tokens,
      thinkingLevel: sessionInfo.thinkingLevel,
      fastMode: sessionInfo.fastMode,
      verboseLevel: sessionInfo.verboseLevel,
      reasoningLevel: sessionInfo.reasoningLevel,
      queuedCount: queuedMessages.length,
    });
    footer.setText(theme.userText(footerLine));
  };

  const { openOverlay, closeOverlay } = createOverlayHandlers(tui, editor);
  const btw = {
    showResult: (params: { question: string; text: string; isError?: boolean }) => {
      chatLog.showBtw(params);
    },
    clear: () => {
      chatLog.dismissBtw();
    },
  };

  const initialSessionAgentId = (() => {
    if (!initialSessionInput) {
      return null;
    }
    const parsed = parseAgentSessionKey(initialSessionInput);
    return parsed ? normalizeAgentId(parsed.agentId) : null;
  })();

  const sessionActions = createSessionActions({
    client,
    chatLog,
    btw,
    tui,
    opts,
    state,
    agentNames,
    initialSessionInput,
    initialSessionAgentId,
    resolveSessionKey,
    updateHeader,
    updateFooter,
    updateAutocompleteProvider,
    setActivityStatus,
    clearLocalRunIds,
  });
  const {
    refreshAgents,
    refreshSessionInfo,
    applySessionInfoFromPatch,
    loadHistory,
    setSession,
    abortActive,
  } = sessionActions;

  const { handleChatEvent, handleAgentEvent, handleBtwEvent } = createEventHandlers({
    chatLog,
    btw,
    tui,
    state,
    localMode: isLocalMode,
    setActivityStatus,
    refreshSessionInfo,
    loadHistory,
    noteLocalRunId,
    isLocalRunId,
    forgetLocalRunId,
    clearLocalRunIds,
    isLocalBtwRunId,
    forgetLocalBtwRunId,
    clearLocalBtwRunIds,
  });

  let finishTui: (() => void) | null = null;
  const requestExit = (result?: Partial<TuiResult>) => {
    if (exitRequested) {
      return;
    }
    exitRequested = true;
    clearCatalogRefreshTimer();
    clearDynamicSlashCommandsTimer();
    stopStatusTimer();
    stopWaitingTimer();
    statusLoader?.stop();
    statusLoader = null;
    exitResult = {
      exitReason: result?.exitReason ?? "exit",
    };
    void Promise.resolve(client.stop())
      .catch(() => {
        // Shutdown is best-effort here; terminal restore still has to run.
      })
      .then(() => drainAndStopTuiSafely(tui))
      .then(() => {
        finishTui?.();
      });
  };
  const exitAwareClient = client as TuiBackend & {
    setRequestExitHandler?: (handler: () => void) => void;
  };
  exitAwareClient.setRequestExitHandler?.(() => requestExit());

  const {
    handleCommand,
    sendMessage,
    queueMessage,
    dequeueQueuedMessage,
    openModelSelector,
    openAgentSelector,
    openSessionSelector,
  } = createCommandHandlers({
    client,
    chatLog,
    tui,
    opts,
    state,
    deliverDefault,
    openOverlay,
    closeOverlay,
    refreshSessionInfo,
    applySessionInfoFromPatch,
    loadHistory,
    setSession,
    refreshAgents,
    abortActive,
    setActivityStatus,
    formatSessionKey,
    noteLocalRunId,
    noteLocalBtwRunId,
    forgetLocalRunId,
    forgetLocalBtwRunId,
    runAuthFlow,
    requestExit,
  });

  let drainingQueuedMessage = false;
  const drainQueuedMessages = async () => {
    if (
      drainingQueuedMessage ||
      activeChatRunId ||
      pendingChatRunId ||
      pendingOptimisticUserMessage ||
      queuedMessages.length === 0
    ) {
      return;
    }
    const next = queuedMessages.shift();
    if (!next) {
      return;
    }
    drainingQueuedMessage = true;
    updateFooter();
    try {
      await sendMessage(next.text);
    } finally {
      drainingQueuedMessage = false;
      updateFooter();
      if (
        !activeChatRunId &&
        !pendingChatRunId &&
        !pendingOptimisticUserMessage &&
        queuedMessages.length > 0
      ) {
        void drainQueuedMessages();
      }
    }
  };

  const { runLocalShellLine } = createLocalShellRunner({
    chatLog,
    tui,
    openOverlay,
    closeOverlay,
  });
  updateAutocompleteProvider();
  const submitHandler = createEditorSubmitHandler({
    editor,
    handleCommand,
    sendMessage,
    handleBangLine: runLocalShellLine,
  });
  editor.onSubmit = createSubmitBurstCoalescer({
    submit: submitHandler,
    enabled: shouldEnableWindowsGitBashPasteFallback(),
  });

  editor.onEscape = () => {
    if (chatLog.hasVisibleBtw()) {
      chatLog.dismissBtw();
      tui.requestRender();
      return;
    }
    void abortActive();
  };
  const handleCtrlC = () => {
    const now = Date.now();
    const decision = resolveCtrlCAction({
      hasInput: editor.getText().trim().length > 0,
      now,
      lastCtrlCAt,
    });
    lastCtrlCAt = decision.nextLastCtrlCAt;
    if (decision.action === "clear") {
      editor.setText("");
      setActivityStatus("cleared input; press ctrl+c again to exit");
      tui.requestRender();
      return;
    }
    if (decision.action === "exit") {
      requestExit();
      return;
    }
    setActivityStatus("press ctrl+c again to exit");
    tui.requestRender();
  };
  editor.onCtrlC = () => {
    handleCtrlC();
  };
  editor.onCtrlD = () => {
    requestExit();
  };
  editor.onCtrlO = () => {
    toolsExpanded = !toolsExpanded;
    chatLog.setToolsExpanded(toolsExpanded);
    setActivityStatus(toolsExpanded ? "tools expanded" : "tools collapsed");
    tui.requestRender();
  };
  editor.onCtrlL = () => {
    void openModelSelector();
  };
  editor.onCtrlG = () => {
    void openAgentSelector();
  };
  editor.onCtrlP = () => {
    void openSessionSelector();
  };
  editor.onCtrlT = () => {
    showThinking = !showThinking;
    void loadHistory();
  };
  editor.onAltEnter = () => {
    const value = editor.getText().trim();
    if (!value) {
      setActivityStatus("no follow-up to queue");
      tui.requestRender();
      return;
    }
    editor.setText("");
    editor.addToHistory(value);
    queueMessage(value, "manual");
    updateFooter();
    if (!activeChatRunId && !pendingChatRunId && !pendingOptimisticUserMessage) {
      void drainQueuedMessages();
    }
  };
  editor.onAltUp = () => {
    const restored = dequeueQueuedMessage();
    if (restored) {
      editor.setText(restored);
    }
    updateFooter();
  };

  tui.addInputListener((data) => {
    if (!chatLog.hasVisibleBtw()) {
      return undefined;
    }
    if (editor.getText().length > 0) {
      return undefined;
    }
    if (matchesKey(data, "enter")) {
      chatLog.dismissBtw();
      tui.requestRender();
      return { consume: true };
    }
    return undefined;
  });

  const maybeDrainQueuedMessagesAfterChatEvent = (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const stateValue = (payload as { state?: unknown }).state;
    if (stateValue === "final" || stateValue === "aborted" || stateValue === "error") {
      void drainQueuedMessages();
    }
  };

  client.onEvent = (evt) => {
    if (evt.event === "chat") {
      handleChatEvent(evt.payload);
      maybeDrainQueuedMessagesAfterChatEvent(evt.payload);
    }
    if (evt.event === "chat.side_result") {
      handleBtwEvent(evt.payload);
    }
    if (evt.event === "agent") {
      handleAgentEvent(evt.payload);
    }
    if (evt.event === "trace" && isTuiTurnTraceEnabled()) {
      chatLog.addSystem(formatTuiTurnTrace(evt.payload));
      tui.requestRender();
    }
  };

  client.onConnected = () => {
    isConnected = true;
    startupHydrated = false;
    pairingHintShown = false;
    const reconnected = wasDisconnected;
    wasDisconnected = false;
    setConnectionStatus(isLocalMode ? "local ready" : "connected");
    const finishStartupHydration = () => {
      startupHydrated = true;
      clearCatalogRefreshTimer();
      scheduleHeroCatalogRefresh(3000);
      setConnectionStatus(
        isLocalMode ? "local ready" : reconnected ? "gateway reconnected" : "gateway connected",
        4000,
      );
      updateFooter();
      tui.requestRender();
    };
    const refreshStartupAgents = async () => {
      await refreshAgents();
      updateHeader();
      updateAutocompleteProvider();
      updateFooter();
      tui.requestRender();
    };
    const sendStartupAutoMessage = () => {
      if (autoMessageSent || !autoMessage) {
        return false;
      }
      autoMessageSent = true;
      void sendMessage(autoMessage);
      return true;
    };
    const loadStartupHistory = async () => {
      try {
        await loadHistory();
      } finally {
        finishStartupHydration();
      }
    };
    void (async () => {
      if (isLocalMode && autoMessage) {
        initialSessionApplied = true;
        updateHeader();
        updateFooter();
        tui.requestRender();
        sendStartupAutoMessage();
        finishStartupHydration();
        void refreshStartupAgents();
        return;
      }
      await refreshStartupAgents();
      if (sendStartupAutoMessage()) {
        finishStartupHydration();
        return;
      }
      void loadStartupHistory();
    })();
  };

  client.onDisconnected = (reason) => {
    isConnected = false;
    wasDisconnected = true;
    historyLoaded = false;
    clearCatalogRefreshTimer();
    clearDynamicSlashCommandsTimer();
    dynamicSlashCommands = [];
    dynamicSlashCommandsKey = null;
    dynamicSlashCommandsInFlightKey = null;
    dynamicSlashCommandsRequestId += 1;
    updateAutocompleteProvider();
    const disconnectState = isLocalMode
      ? {
          connectionStatus: `local runtime stopped${reason ? `: ${reason}` : ""}`,
          activityStatus: "idle",
          pairingHint: undefined,
        }
      : resolveGatewayDisconnectState(reason);
    setConnectionStatus(disconnectState.connectionStatus, 5000);
    setActivityStatus(disconnectState.activityStatus);
    if (disconnectState.pairingHint && !pairingHintShown) {
      pairingHintShown = true;
      chatLog.addSystem(disconnectState.pairingHint);
    }
    updateFooter();
    tui.requestRender();
  };

  client.onGap = (info) => {
    setConnectionStatus(`event gap: expected ${info.expected}, got ${info.received}`, 5000);
    tui.requestRender();
  };

  updateHeader();
  setConnectionStatus(isLocalMode ? "starting local runtime" : "connecting");
  updateFooter();
  const sigintHandler = () => {
    handleCtrlC();
  };
  const sigtermHandler = () => {
    requestExit();
  };
  process.on("SIGINT", sigintHandler);
  process.on("SIGTERM", sigtermHandler);
  tui.start();
  client.start();
  await new Promise<void>((resolve) => {
    const finish = () => {
      if (isLocalMode) {
        setConsoleSubsystemFilter(previousConsoleSubsystemFilter);
      }
      process.removeListener("SIGINT", sigintHandler);
      process.removeListener("SIGTERM", sigtermHandler);
      process.removeListener("exit", finish);
      finishTui = null;
      resolve();
    };
    finishTui = finish;
    process.once("exit", finish);
  });
  return exitResult;
}
