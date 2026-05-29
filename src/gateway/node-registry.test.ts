import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { NodeRegistry } from "./node-registry.js";
import type { GatewayWsClient } from "./server/ws-types.js";

function makeClient(
  connId: string,
  nodeId: string,
  sent: string[] = [],
  opts: { socket?: GatewayWsClient["socket"] } = {},
): GatewayWsClient {
  return {
    connId,
    usesSharedGatewayAuth: false,
    socket:
      opts.socket ??
      ({
        send(frame: unknown) {
          if (typeof frame === "string") {
            sent.push(frame);
          }
        },
      } as unknown as GatewayWsClient["socket"]),
    connect: {
      client: { id: "kova-macos", version: "1.0.0", platform: "darwin", mode: "node" },
      device: {
        id: nodeId,
        publicKey: "public-key",
        signature: "signature",
        signedAt: 1,
        nonce: "nonce",
      },
    } as GatewayWsClient["connect"],
  } as GatewayWsClient;
}

describe("gateway/node-registry", () => {
  it("checks node websocket connectivity with ping/pong", async () => {
    const registry = new NodeRegistry();
    const socket = new EventEmitter() as EventEmitter & {
      readyState: number;
      send: (frame: unknown) => void;
      ping: (data?: Buffer, mask?: boolean, cb?: (err?: Error) => void) => void;
    };
    socket.readyState = 1;
    socket.send = () => {};
    socket.ping = (_dataValue, _mask, cb) => {
      cb?.();
      queueMicrotask(() => socket.emit("pong"));
    };
    registry.register(
      makeClient("conn-1", "node-1", [], {
        socket: socket as unknown as GatewayWsClient["socket"],
      }),
      {},
    );

    await expect(registry.checkConnectivity("node-1", 50)).resolves.toEqual({ ok: true });
  });

  it("reports stale node websocket connectivity before invoke timeout", async () => {
    const registry = new NodeRegistry();
    const socket = new EventEmitter() as EventEmitter & {
      readyState: number;
      send: (frame: unknown) => void;
      ping: (data?: Buffer, mask?: boolean, cb?: (err?: Error) => void) => void;
    };
    socket.readyState = 1;
    socket.send = () => {};
    socket.ping = (_dataValue, _mask, cb) => {
      cb?.();
    };
    registry.register(
      makeClient("conn-1", "node-1", [], {
        socket: socket as unknown as GatewayWsClient["socket"],
      }),
      {},
    );

    const result = await registry.checkConnectivity("node-1", 1);

    expect(result).toEqual({
      ok: false,
      error: { code: "TIMEOUT", message: "node connectivity probe timed out" },
    });
  });

  it("keeps a reconnected node when the old connection unregisters", async () => {
    const registry = new NodeRegistry();
    const oldFrames: string[] = [];
    const newClient = makeClient("conn-new", "node-1");

    registry.register(makeClient("conn-old", "node-1", oldFrames), {});
    const oldInvoke = registry.invoke({
      nodeId: "node-1",
      command: "system.run",
      timeoutMs: 1_000,
    });
    const oldDisconnected = oldInvoke.catch((err: unknown) => err);
    const oldRequest = JSON.parse(oldFrames[0] ?? "{}") as { payload?: { id?: string } };
    const newSession = registry.register(newClient, {});

    expect(
      registry.handleInvokeResult({
        id: oldRequest.payload?.id ?? "",
        nodeId: "node-1",
        connId: "conn-new",
        ok: true,
      }),
    ).toBe(false);
    expect(registry.unregister("conn-old")).toBeNull();
    expect(registry.get("node-1")).toBe(newSession);
    await expect(oldDisconnected).resolves.toBeInstanceOf(Error);
  });
});
