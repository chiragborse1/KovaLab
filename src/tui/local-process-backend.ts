import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatErrorMessage } from "../infra/errors.js";
import type {
  ChatSendOptions,
  TuiAgentsList,
  TuiBackend,
  TuiEvent,
  TuiModelChoice,
  TuiSessionList,
} from "./tui-backend.js";
import { filterTuiExecArgv } from "./tui-launch.js";

type LocalProcessRequestMethod =
  | "sendChat"
  | "steerChat"
  | "abortChat"
  | "loadHistory"
  | "listSessions"
  | "listAgents"
  | "patchSession"
  | "resetSession"
  | "getGatewayStatus"
  | "listModels"
  | "listTools"
  | "listSkills";

type LocalProcessRequest = {
  type: "request";
  id: number;
  method: LocalProcessRequestMethod;
  params?: unknown;
};

type LocalProcessStop = {
  type: "stop";
};

type LocalProcessMessage =
  | { type: "ready" }
  | { type: "connected" }
  | { type: "disconnected"; reason?: string }
  | { type: "gap"; info?: { expected: number; received: number } }
  | { type: "event"; event?: TuiEvent }
  | { type: "response"; id?: number; ok?: boolean; result?: unknown; error?: string }
  | { type: "fatal"; error?: string };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const KOVA_CLI_WRAPPER_PATH = fileURLToPath(new URL("../../kova.mjs", import.meta.url));
const LOCAL_BACKEND_CHILD_ENTRY_PATHS = [
  fileURLToPath(new URL("./tui/local-backend-child.js", import.meta.url)),
  fileURLToPath(new URL("./local-backend-child.js", import.meta.url)),
];

function resolveLocalBackendCliArgs(): string[] {
  const directEntry = LOCAL_BACKEND_CHILD_ENTRY_PATHS.find((entryPath) => existsSync(entryPath));
  if (directEntry) {
    return [...filterTuiExecArgv(process.execArgv), directEntry];
  }
  const entry = process.argv[1]?.trim();
  const entryArgs =
    entry && path.isAbsolute(entry)
      ? [entry]
      : entry && existsSync(path.resolve(entry))
        ? [path.resolve(entry)]
        : [KOVA_CLI_WRAPPER_PATH];
  return [...filterTuiExecArgv(process.execArgv), ...entryArgs, "tui-local-backend"];
}

function parseProtocolLine(line: string): LocalProcessMessage | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as LocalProcessMessage;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return {
      type: "fatal",
      error: `invalid backend protocol line: ${trimmed.slice(0, 160)}`,
    };
  }
}

export class LocalProcessTuiBackend implements TuiBackend {
  readonly connection = { url: "local worker" };

  onEvent?: (evt: TuiEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;

  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = "";
  private stderrTail = "";
  private nextRequestId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private disconnected = false;

  start() {
    if (this.child) {
      return;
    }
    this.disconnected = false;
    const child = spawn(process.execPath, resolveLocalBackendCliArgs(), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        KOVA_TUI_BACKEND_CHILD: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.handleStdout(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-4000);
    });
    child.once("error", (error) => {
      this.failAllPending(new Error(`local backend failed to start: ${formatErrorMessage(error)}`));
      this.emitDisconnected(`failed to start: ${formatErrorMessage(error)}`);
    });
    child.once("exit", (code, signal) => {
      const suffix = this.stderrTail.trim() ? `: ${this.stderrTail.trim().slice(-500)}` : "";
      const reason = signal
        ? `local backend exited from ${signal}${suffix}`
        : `local backend exited with code ${String(code ?? 0)}${suffix}`;
      this.failAllPending(new Error(reason));
      this.child = null;
      this.emitDisconnected(reason);
    });
  }

  stop() {
    const child = this.child;
    if (!child) {
      return;
    }
    this.write({ type: "stop" });
    child.stdin.end();
    const killTimer = setTimeout(() => {
      child.kill("SIGTERM");
    }, 1500);
    killTimer.unref?.();
  }

  async sendChat(opts: ChatSendOptions): Promise<{ runId: string }> {
    return (await this.request("sendChat", opts)) as { runId: string };
  }

  async steerChat(opts: { sessionKey: string; message: string }) {
    return (await this.request("steerChat", opts)) as { ok: boolean; reason?: string };
  }

  async abortChat(opts: { sessionKey: string; runId: string }) {
    return (await this.request("abortChat", opts)) as { ok: boolean; aborted: boolean };
  }

  async loadHistory(opts: { sessionKey: string; limit?: number }) {
    return await this.request("loadHistory", opts);
  }

  async listSessions(opts?: Parameters<TuiBackend["listSessions"]>[0]): Promise<TuiSessionList> {
    return (await this.request("listSessions", opts ?? {})) as TuiSessionList;
  }

  async listAgents(): Promise<TuiAgentsList> {
    return (await this.request("listAgents", {})) as TuiAgentsList;
  }

  async patchSession(opts: Parameters<TuiBackend["patchSession"]>[0]) {
    return (await this.request("patchSession", opts)) as Awaited<
      ReturnType<TuiBackend["patchSession"]>
    >;
  }

  async resetSession(key: string, reason?: "new" | "reset") {
    return await this.request("resetSession", { key, reason });
  }

  async getGatewayStatus() {
    return await this.request("getGatewayStatus", {});
  }

  async listModels(): Promise<TuiModelChoice[]> {
    return (await this.request("listModels", {})) as TuiModelChoice[];
  }

  async listTools(opts: Parameters<NonNullable<TuiBackend["listTools"]>>[0]) {
    return (await this.request("listTools", opts)) as Awaited<
      ReturnType<NonNullable<TuiBackend["listTools"]>>
    >;
  }

  async listSkills(opts: Parameters<NonNullable<TuiBackend["listSkills"]>>[0]) {
    return (await this.request("listSkills", opts)) as Awaited<
      ReturnType<NonNullable<TuiBackend["listSkills"]>>
    >;
  }

  private request(method: LocalProcessRequestMethod, params?: unknown): Promise<unknown> {
    if (!this.child) {
      this.start();
    }
    const child = this.child;
    if (!child || child.stdin.destroyed) {
      return Promise.reject(new Error("local backend is not running"));
    }
    const id = ++this.nextRequestId;
    const request: LocalProcessRequest = {
      type: "request",
      id,
      method,
      params,
    };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.write(request);
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private write(message: LocalProcessRequest | LocalProcessStop) {
    const child = this.child;
    if (!child || child.stdin.destroyed) {
      throw new Error("local backend is not running");
    }
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleStdout(chunk: string) {
    this.stdoutBuffer += chunk;
    for (;;) {
      const newline = this.stdoutBuffer.indexOf("\n");
      if (newline < 0) {
        break;
      }
      const line = this.stdoutBuffer.slice(0, newline);
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      const message = parseProtocolLine(line);
      if (message) {
        this.handleMessage(message);
      }
    }
  }

  private handleMessage(message: LocalProcessMessage) {
    if (message.type === "ready") {
      return;
    }
    if (message.type === "connected") {
      this.onConnected?.();
      return;
    }
    if (message.type === "disconnected") {
      this.emitDisconnected(message.reason ?? "local backend disconnected");
      return;
    }
    if (message.type === "gap" && message.info) {
      this.onGap?.(message.info);
      return;
    }
    if (message.type === "event" && message.event) {
      this.onEvent?.(message.event);
      return;
    }
    if (message.type === "fatal") {
      const error = new Error(message.error ?? "local backend failed");
      this.failAllPending(error);
      this.emitDisconnected(error.message);
      return;
    }
    if (message.type !== "response" || typeof message.id !== "number") {
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    this.pending.delete(message.id);
    if (message.ok) {
      pending.resolve(message.result);
      return;
    }
    pending.reject(new Error(message.error ?? "local backend request failed"));
  }

  private failAllPending(error: Error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private emitDisconnected(reason: string) {
    if (this.disconnected) {
      return;
    }
    this.disconnected = true;
    this.onDisconnected?.(reason);
  }
}
