import { randomUUID } from "node:crypto";
import type { GatewayWsClient } from "./server/ws-types.js";

export type NodeSession = {
  nodeId: string;
  connId: string;
  client: GatewayWsClient;
  clientId?: string;
  clientMode?: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  remoteIp?: string;
  caps: string[];
  commands: string[];
  permissions?: Record<string, boolean>;
  pathEnv?: string;
  connectedAtMs: number;
};

type PendingInvoke = {
  nodeId: string;
  connId: string;
  command: string;
  resolve: (value: NodeInvokeResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type NodeInvokeResult = {
  ok: boolean;
  payload?: unknown;
  payloadJSON?: string | null;
  error?: { code?: string; message?: string } | null;
};

type NodeConnectivityResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string } };

type PingableSocket = {
  readyState?: number;
  ping?: (data?: Buffer, mask?: boolean, cb?: (err?: Error) => void) => void;
  once?: (event: "pong" | "close" | "error", listener: (...args: unknown[]) => void) => unknown;
  off?: (event: "pong" | "close" | "error", listener: (...args: unknown[]) => void) => unknown;
  removeListener?: (
    event: "pong" | "close" | "error",
    listener: (...args: unknown[]) => void,
  ) => unknown;
};

const WEBSOCKET_OPEN_READY_STATE = 1;

export class NodeRegistry {
  private nodesById = new Map<string, NodeSession>();
  private nodesByConn = new Map<string, string>();
  private pendingInvokes = new Map<string, PendingInvoke>();

  register(client: GatewayWsClient, opts: { remoteIp?: string | undefined }) {
    const connect = client.connect;
    const nodeId = connect.device?.id ?? connect.client.id;
    const caps = Array.isArray(connect.caps) ? connect.caps : [];
    const commands = Array.isArray((connect as { commands?: string[] }).commands)
      ? ((connect as { commands?: string[] }).commands ?? [])
      : [];
    const permissions =
      typeof (connect as { permissions?: Record<string, boolean> }).permissions === "object"
        ? ((connect as { permissions?: Record<string, boolean> }).permissions ?? undefined)
        : undefined;
    const pathEnv =
      typeof (connect as { pathEnv?: string }).pathEnv === "string"
        ? (connect as { pathEnv?: string }).pathEnv
        : undefined;
    const session: NodeSession = {
      nodeId,
      connId: client.connId,
      client,
      clientId: connect.client.id,
      clientMode: connect.client.mode,
      displayName: connect.client.displayName,
      platform: connect.client.platform,
      version: connect.client.version,
      coreVersion: (connect as { coreVersion?: string }).coreVersion,
      uiVersion: (connect as { uiVersion?: string }).uiVersion,
      deviceFamily: connect.client.deviceFamily,
      modelIdentifier: connect.client.modelIdentifier,
      remoteIp: opts.remoteIp,
      caps,
      commands,
      permissions,
      pathEnv,
      connectedAtMs: Date.now(),
    };
    this.nodesById.set(nodeId, session);
    this.nodesByConn.set(client.connId, nodeId);
    return session;
  }

  unregister(connId: string): string | null {
    const nodeId = this.nodesByConn.get(connId);
    if (!nodeId) {
      return null;
    }
    this.nodesByConn.delete(connId);
    const unregistersCurrentNode = this.nodesById.get(nodeId)?.connId === connId;
    if (unregistersCurrentNode) {
      this.nodesById.delete(nodeId);
    }
    for (const [id, pending] of this.pendingInvokes.entries()) {
      if (pending.connId !== connId) {
        continue;
      }
      clearTimeout(pending.timer);
      pending.reject(new Error(`node disconnected (${pending.command})`));
      this.pendingInvokes.delete(id);
    }
    return unregistersCurrentNode ? nodeId : null;
  }

  listConnected(): NodeSession[] {
    return [...this.nodesById.values()];
  }

  get(nodeId: string): NodeSession | undefined {
    return this.nodesById.get(nodeId);
  }

  async checkConnectivity(nodeId: string, timeoutMs = 2_000): Promise<NodeConnectivityResult> {
    const node = this.nodesById.get(nodeId);
    if (!node) {
      return {
        ok: false,
        error: { code: "NOT_CONNECTED", message: "node not connected" },
      };
    }
    const socket = node.client.socket as PingableSocket;
    if (socket.readyState !== undefined && socket.readyState !== WEBSOCKET_OPEN_READY_STATE) {
      return {
        ok: false,
        error: { code: "NOT_CONNECTED", message: "node socket not open" },
      };
    }
    if (typeof socket.ping !== "function" || typeof socket.once !== "function") {
      return { ok: true };
    }

    const timeout = Math.max(1, Math.trunc(timeoutMs));
    return await new Promise<NodeConnectivityResult>((resolve) => {
      let settled = false;
      const cleanup = () => {
        socket.off?.("pong", onPong);
        socket.off?.("close", onClose);
        socket.off?.("error", onError);
        socket.removeListener?.("pong", onPong);
        socket.removeListener?.("close", onClose);
        socket.removeListener?.("error", onError);
      };
      const finish = (result: NodeConnectivityResult) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(result);
      };
      const onPong = () => finish({ ok: true });
      const onClose = () =>
        finish({
          ok: false,
          error: { code: "NOT_CONNECTED", message: "node socket closed during connectivity probe" },
        });
      const onError = (err: unknown) =>
        finish({
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message:
              err instanceof Error ? err.message : "node socket error during connectivity probe",
          },
        });
      const timer = setTimeout(
        () =>
          finish({
            ok: false,
            error: { code: "TIMEOUT", message: "node connectivity probe timed out" },
          }),
        timeout,
      );

      socket.once?.("pong", onPong);
      socket.once?.("close", onClose);
      socket.once?.("error", onError);
      try {
        socket.ping?.(undefined, false, (err?: Error) => {
          if (err) {
            finish({
              ok: false,
              error: { code: "UNAVAILABLE", message: err.message },
            });
          }
        });
      } catch (err) {
        finish({
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: err instanceof Error ? err.message : "node ping failed",
          },
        });
      }
    });
  }

  async invoke(params: {
    nodeId: string;
    command: string;
    params?: unknown;
    timeoutMs?: number;
    idempotencyKey?: string;
  }): Promise<NodeInvokeResult> {
    const node = this.nodesById.get(params.nodeId);
    if (!node) {
      return {
        ok: false,
        error: { code: "NOT_CONNECTED", message: "node not connected" },
      };
    }
    const requestId = randomUUID();
    const payload = {
      id: requestId,
      nodeId: params.nodeId,
      command: params.command,
      paramsJSON:
        "params" in params && params.params !== undefined ? JSON.stringify(params.params) : null,
      timeoutMs: params.timeoutMs,
      idempotencyKey: params.idempotencyKey,
    };
    const ok = this.sendEventToSession(node, "node.invoke.request", payload);
    if (!ok) {
      return {
        ok: false,
        error: { code: "UNAVAILABLE", message: "failed to send invoke to node" },
      };
    }
    const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : 30_000;
    return await new Promise<NodeInvokeResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingInvokes.delete(requestId);
        resolve({
          ok: false,
          error: { code: "TIMEOUT", message: "node invoke timed out" },
        });
      }, timeoutMs);
      this.pendingInvokes.set(requestId, {
        nodeId: params.nodeId,
        connId: node.connId,
        command: params.command,
        resolve,
        reject,
        timer,
      });
    });
  }

  handleInvokeResult(params: {
    id: string;
    nodeId: string;
    connId: string | undefined;
    ok: boolean;
    payload?: unknown;
    payloadJSON?: string | null;
    error?: { code?: string; message?: string } | null;
  }): boolean {
    const pending = this.pendingInvokes.get(params.id);
    if (!pending) {
      return false;
    }
    if (pending.nodeId !== params.nodeId || pending.connId !== params.connId) {
      return false;
    }
    clearTimeout(pending.timer);
    this.pendingInvokes.delete(params.id);
    pending.resolve({
      ok: params.ok,
      payload: params.payload,
      payloadJSON: params.payloadJSON ?? null,
      error: params.error ?? null,
    });
    return true;
  }

  sendEvent(nodeId: string, event: string, payload?: unknown): boolean {
    const node = this.nodesById.get(nodeId);
    if (!node) {
      return false;
    }
    return this.sendEventToSession(node, event, payload);
  }

  private sendEventInternal(node: NodeSession, event: string, payload: unknown): boolean {
    try {
      node.client.socket.send(
        JSON.stringify({
          type: "event",
          event,
          payload,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private sendEventToSession(node: NodeSession, event: string, payload: unknown): boolean {
    return this.sendEventInternal(node, event, payload);
  }
}
