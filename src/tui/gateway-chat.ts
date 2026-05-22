import { randomUUID } from "node:crypto";
import type { SkillStatusReport } from "../agents/skills-status.js";
import { getRuntimeConfig } from "../config/config.js";
import { assertExplicitGatewayAuthModeWhenBothConfigured } from "../gateway/auth-mode-policy.js";
import { resolveGatewayInteractiveSurfaceAuth } from "../gateway/auth-surface-resolution.js";
import {
  buildGatewayConnectionDetails,
  ensureExplicitGatewayAuth,
  resolveExplicitGatewayAuth,
} from "../gateway/call.js";
import { GatewayClient, GatewayClientRequestError } from "../gateway/client.js";
import { isLoopbackHost } from "../gateway/net.js";
import {
  GATEWAY_CLIENT_CAPS,
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
} from "../gateway/protocol/client-info.js";
import {
  type CommandEntry,
  type CommandsListParams,
  type CommandsListResult,
  type HelloOk,
  PROTOCOL_VERSION,
  type SessionsListParams,
  type SessionsPatchResult,
  type SessionsPatchParams,
  type TasksAuditResult,
  type TasksListResult,
  type TasksMaintenanceResult,
  type ToolsCatalogResult,
} from "../gateway/protocol/index.js";
import { formatErrorMessage } from "../infra/errors.js";
import { VERSION } from "../version.js";
import { TUI_SETUP_AUTH_SOURCE_CONFIG, TUI_SETUP_AUTH_SOURCE_ENV } from "./setup-launch-env.js";
import type {
  ChatSendOptions,
  TuiAgentsList,
  TuiBackend,
  TuiEvent,
  TuiModelChoice,
  TuiSessionCheckpointBranch,
  TuiSessionCheckpointList,
  TuiSessionCheckpointRestore,
  TuiSessionCheckpointResult,
  TuiSessionList,
} from "./tui-backend.js";

export type GatewayConnectionOptions = {
  url?: string;
  token?: string;
  password?: string;
};

export type GatewayEvent = TuiEvent;

const STARTUP_CHAT_HISTORY_RETRY_TIMEOUT_MS = 60_000;
const STARTUP_CHAT_HISTORY_DEFAULT_RETRY_MS = 500;
const STARTUP_CHAT_HISTORY_MAX_RETRY_MS = 5_000;

type ResolvedGatewayConnection = {
  url: string;
  token?: string;
  password?: string;
  allowInsecureLocalOperatorUi?: boolean;
};

function throwGatewayAuthResolutionError(reason: string): never {
  throw new Error(
    [
      reason,
      "Fix: set KOVA_GATEWAY_TOKEN/KOVA_GATEWAY_PASSWORD, pass --token/--password,",
      "or resolve the configured secret provider for this credential.",
    ].join("\n"),
  );
}

function isRetryableStartupUnavailable(
  err: unknown,
  method: string,
): err is GatewayClientRequestError {
  if (!(err instanceof GatewayClientRequestError)) {
    return false;
  }
  if (err.gatewayCode !== "UNAVAILABLE" || !err.retryable) {
    return false;
  }
  const details = err.details;
  if (!details || typeof details !== "object") {
    return true;
  }
  const detailMethod = (details as { method?: unknown }).method;
  return typeof detailMethod !== "string" || detailMethod === method;
}

function resolveStartupRetryDelayMs(err: GatewayClientRequestError): number {
  const retryAfterMs =
    typeof err.retryAfterMs === "number" ? err.retryAfterMs : STARTUP_CHAT_HISTORY_DEFAULT_RETRY_MS;
  return Math.min(Math.max(retryAfterMs, 100), STARTUP_CHAT_HISTORY_MAX_RETRY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type GatewaySessionList = TuiSessionList;
export type GatewayAgentsList = TuiAgentsList;
export type GatewayModelChoice = TuiModelChoice;

export class GatewayChatClient implements TuiBackend {
  private client: GatewayClient;
  private readyPromise: Promise<void>;
  private resolveReady?: () => void;
  readonly connection: { url: string; token?: string; password?: string };
  hello?: HelloOk;

  onEvent?: (evt: GatewayEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;

  constructor(connection: ResolvedGatewayConnection) {
    this.connection = connection;

    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    this.client = new GatewayClient({
      url: connection.url,
      token: connection.token,
      password: connection.password,
      clientName: GATEWAY_CLIENT_NAMES.TUI,
      clientDisplayName: GATEWAY_CLIENT_NAMES.TUI,
      clientVersion: VERSION,
      platform: process.platform,
      mode: GATEWAY_CLIENT_MODES.UI,
      deviceIdentity: connection.allowInsecureLocalOperatorUi ? null : undefined,
      caps: [GATEWAY_CLIENT_CAPS.TOOL_EVENTS],
      instanceId: randomUUID(),
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      onHelloOk: (hello) => {
        this.hello = hello;
        this.resolveReady?.();
        this.onConnected?.();
      },
      onEvent: (evt) => {
        this.onEvent?.({
          event: evt.event,
          payload: evt.payload,
          seq: evt.seq,
        });
      },
      onClose: (_code, reason) => {
        // Reset so waitForReady() blocks again until the next successful reconnect.
        this.readyPromise = new Promise((resolve) => {
          this.resolveReady = resolve;
        });
        this.onDisconnected?.(reason);
      },
      onGap: (info) => {
        this.onGap?.(info);
      },
    });
  }

  static async connect(opts: GatewayConnectionOptions): Promise<GatewayChatClient> {
    const connection = await resolveGatewayConnection(opts);
    return new GatewayChatClient(connection);
  }

  start() {
    this.client.start();
  }

  stop() {
    this.client.stop();
  }

  async waitForReady() {
    await this.readyPromise;
  }

  async sendChat(opts: ChatSendOptions): Promise<{ runId: string }> {
    const runId = opts.runId ?? randomUUID();
    await this.client.request("chat.send", {
      sessionKey: opts.sessionKey,
      message: opts.message,
      thinking: opts.thinking,
      deliver: opts.deliver,
      timeoutMs: opts.timeoutMs,
      idempotencyKey: runId,
    });
    return { runId };
  }

  async abortChat(opts: { sessionKey: string; runId: string }) {
    return await this.client.request<{ ok: boolean; aborted: boolean }>("chat.abort", {
      sessionKey: opts.sessionKey,
      runId: opts.runId,
    });
  }

  async loadHistory(opts: { sessionKey: string; limit?: number }) {
    const startedAt = Date.now();
    for (;;) {
      try {
        return await this.client.request("chat.history", {
          sessionKey: opts.sessionKey,
          limit: opts.limit,
        });
      } catch (err) {
        const withinStartupRetryWindow =
          Date.now() - startedAt < STARTUP_CHAT_HISTORY_RETRY_TIMEOUT_MS;
        if (withinStartupRetryWindow && isRetryableStartupUnavailable(err, "chat.history")) {
          await sleep(resolveStartupRetryDelayMs(err));
          continue;
        }
        throw err;
      }
    }
  }

  async listSessions(opts?: SessionsListParams) {
    return await this.client.request<GatewaySessionList>("sessions.list", {
      limit: opts?.limit,
      activeMinutes: opts?.activeMinutes,
      includeGlobal: opts?.includeGlobal,
      includeUnknown: opts?.includeUnknown,
      includeDerivedTitles: opts?.includeDerivedTitles,
      includeLastMessage: opts?.includeLastMessage,
      agentId: opts?.agentId,
      search: opts?.search,
    });
  }

  async listAgents() {
    return await this.client.request<GatewayAgentsList>("agents.list", {});
  }

  async patchSession(opts: SessionsPatchParams): Promise<SessionsPatchResult> {
    return await this.client.request<SessionsPatchResult>("sessions.patch", opts);
  }

  async resetSession(key: string, reason?: "new" | "reset") {
    return await this.client.request("sessions.reset", {
      key,
      ...(reason ? { reason } : {}),
    });
  }

  async getGatewayStatus() {
    return await this.client.request("status");
  }

  async listModels(): Promise<GatewayModelChoice[]> {
    const res = await this.client.request("models.list");
    return Array.isArray(res?.models) ? res.models : [];
  }

  async listCommands(opts?: CommandsListParams): Promise<CommandEntry[]> {
    const res = await this.client.request<CommandsListResult>("commands.list", opts ?? {});
    return Array.isArray(res?.commands) ? res.commands : [];
  }

  async listTools(opts: {
    agentId: string;
    includePlugins?: boolean;
  }): Promise<ToolsCatalogResult> {
    return await this.client.request<ToolsCatalogResult>("tools.catalog", {
      agentId: opts.agentId,
      includePlugins: opts.includePlugins,
    });
  }

  async listSkills(opts: { agentId: string }): Promise<SkillStatusReport> {
    return await this.client.request<SkillStatusReport>("skills.status", {
      agentId: opts.agentId,
    });
  }

  async listTasks(
    opts: { status?: string; runtime?: string; limit?: number } = {},
  ): Promise<TasksListResult> {
    return await this.client.request<TasksListResult>("tasks.list", opts);
  }

  async auditTasks(): Promise<TasksAuditResult> {
    return await this.client.request<TasksAuditResult>("tasks.audit", {});
  }

  async maintainTasks(opts: { apply?: boolean } = {}): Promise<TasksMaintenanceResult> {
    return await this.client.request<TasksMaintenanceResult>("tasks.maintenance", opts);
  }

  async listSessionCheckpoints(opts: { key: string }): Promise<TuiSessionCheckpointList> {
    return await this.client.request<TuiSessionCheckpointList>("sessions.compaction.list", {
      key: opts.key,
    });
  }

  async getSessionCheckpoint(opts: {
    key: string;
    checkpointId: string;
  }): Promise<TuiSessionCheckpointResult> {
    return await this.client.request<TuiSessionCheckpointResult>("sessions.compaction.get", {
      key: opts.key,
      checkpointId: opts.checkpointId,
    });
  }

  async branchSessionCheckpoint(opts: {
    key: string;
    checkpointId: string;
  }): Promise<TuiSessionCheckpointBranch> {
    return await this.client.request<TuiSessionCheckpointBranch>("sessions.compaction.branch", {
      key: opts.key,
      checkpointId: opts.checkpointId,
    });
  }

  async restoreSessionCheckpoint(opts: {
    key: string;
    checkpointId: string;
  }): Promise<TuiSessionCheckpointRestore> {
    return await this.client.request<TuiSessionCheckpointRestore>("sessions.compaction.restore", {
      key: opts.key,
      checkpointId: opts.checkpointId,
    });
  }
}

export async function resolveGatewayConnection(
  opts: GatewayConnectionOptions,
): Promise<ResolvedGatewayConnection> {
  const config = getRuntimeConfig();
  const env = process.env;
  const gatewayAuthMode = config.gateway?.auth?.mode;
  const isRemoteMode = config.gateway?.mode === "remote";
  const preferConfiguredAuth = env[TUI_SETUP_AUTH_SOURCE_ENV] === TUI_SETUP_AUTH_SOURCE_CONFIG;

  const urlOverride =
    typeof opts.url === "string" && opts.url.trim().length > 0 ? opts.url.trim() : undefined;
  const explicitAuth = resolveExplicitGatewayAuth({ token: opts.token, password: opts.password });
  ensureExplicitGatewayAuth({
    urlOverride,
    urlOverrideSource: "cli",
    explicitAuth,
    errorHint: "Fix: pass --token or --password when using --url.",
  });
  const url = buildGatewayConnectionDetails({
    config,
    ...(urlOverride ? { url: urlOverride } : {}),
  }).url;
  const allowInsecureLocalOperatorUi = (() => {
    if (config.gateway?.controlUi?.allowInsecureAuth !== true) {
      return false;
    }
    try {
      return isLoopbackHost(new URL(url).hostname);
    } catch {
      return false;
    }
  })();

  if (urlOverride) {
    return {
      url,
      token: explicitAuth.token,
      password: explicitAuth.password,
      allowInsecureLocalOperatorUi,
    };
  }

  if (isRemoteMode) {
    const resolved = await resolveGatewayInteractiveSurfaceAuth({
      config,
      env,
      explicitAuth,
      surface: "remote",
    });
    if (resolved.failureReason) {
      throwGatewayAuthResolutionError(resolved.failureReason);
    }
    return {
      url,
      token: resolved.token,
      password: resolved.password,
      allowInsecureLocalOperatorUi: false,
    };
  }

  if (gatewayAuthMode === "none" || gatewayAuthMode === "trusted-proxy") {
    const resolved = await resolveGatewayInteractiveSurfaceAuth({
      config,
      env,
      explicitAuth,
      surface: "local",
    });
    return {
      url,
      token: resolved.token,
      password: resolved.password,
      allowInsecureLocalOperatorUi,
    };
  }

  try {
    assertExplicitGatewayAuthModeWhenBothConfigured(config);
  } catch (err) {
    throwGatewayAuthResolutionError(formatErrorMessage(err));
  }

  const resolved = await resolveGatewayInteractiveSurfaceAuth({
    config,
    env,
    explicitAuth,
    suppressEnvAuthFallback: preferConfiguredAuth,
    surface: "local",
  });
  if (resolved.failureReason) {
    throwGatewayAuthResolutionError(resolved.failureReason);
  }
  return {
    url,
    token: resolved.token,
    password: resolved.password,
    allowInsecureLocalOperatorUi,
  };
}
