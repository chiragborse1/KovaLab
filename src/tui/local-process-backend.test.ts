import type { ChildProcessWithoutNullStreams, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { LocalProcessTuiBackend } from "./local-process-backend.js";

type FakeChild = ChildProcessWithoutNullStreams & {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  emitExit: (code?: number | null, signal?: NodeJS.Signals | null) => void;
};

const originalArgv = [...process.argv];
const originalExecArgv = [...process.execArgv];

function createFakeChild(): FakeChild {
  const emitter = new EventEmitter() as FakeChild;
  emitter.stdin = new PassThrough();
  emitter.stdout = new PassThrough();
  emitter.stderr = new PassThrough();
  emitter.kill = vi.fn(() => true) as unknown as ChildProcessWithoutNullStreams["kill"];
  emitter.emitExit = (code = 0, signal = null) => {
    emitter.emit("exit", code, signal);
  };
  return emitter;
}

function writeBackendMessage(child: FakeChild, message: unknown) {
  child.stdout.write(`${JSON.stringify(message)}\n`);
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("LocalProcessTuiBackend", () => {
  beforeEach(() => {
    process.argv = [...originalArgv];
    process.argv[1] = "/repo/kova.mjs";
    process.execArgv.length = 0;
    spawnMock.mockReset();
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    process.execArgv.length = 0;
    process.execArgv.push(...originalExecArgv);
    vi.restoreAllMocks();
  });

  it("spawns the hidden local backend command without inspector flags", () => {
    process.execArgv.push("--inspect", "127.0.0.1:9231", "--no-warnings");
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const backend = new LocalProcessTuiBackend();
    backend.start();

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      ["--no-warnings", "/repo/kova.mjs", "tui-local-backend"],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        env: expect.objectContaining({
          KOVA_TUI_BACKEND_CHILD: "1",
        }),
      } satisfies Partial<SpawnOptions>),
    );
  });

  it("bridges child events and request responses", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const backend = new LocalProcessTuiBackend();
    const onConnected = vi.fn();
    const events: unknown[] = [];
    backend.onConnected = onConnected;
    backend.onEvent = (evt) => events.push(evt);
    backend.start();

    writeBackendMessage(child, { type: "connected" });
    writeBackendMessage(child, {
      type: "event",
      event: { event: "chat", payload: { state: "delta" }, seq: 1 },
    });
    await flushMicrotasks();

    expect(onConnected).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{ event: "chat", payload: { state: "delta" }, seq: 1 }]);

    const requestPromise = backend.sendChat({
      sessionKey: "agent:main:main",
      message: "hello",
      runId: "run-1",
    });
    await flushMicrotasks();

    const rawRequest = child.stdin.read()?.toString("utf8").trim();
    expect(JSON.parse(rawRequest ?? "{}")).toEqual({
      type: "request",
      id: 1,
      method: "sendChat",
      params: {
        sessionKey: "agent:main:main",
        message: "hello",
        runId: "run-1",
      },
    });

    writeBackendMessage(child, { type: "response", id: 1, ok: true, result: { runId: "run-1" } });
    await expect(requestPromise).resolves.toEqual({ runId: "run-1" });
  });

  it("bridges steer requests to the worker", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const backend = new LocalProcessTuiBackend();
    backend.start();

    const requestPromise = backend.steerChat({
      sessionKey: "agent:main:main",
      message: "tighten the current run",
    });
    await flushMicrotasks();

    const rawRequest = child.stdin.read()?.toString("utf8").trim();
    expect(JSON.parse(rawRequest ?? "{}")).toEqual({
      type: "request",
      id: 1,
      method: "steerChat",
      params: {
        sessionKey: "agent:main:main",
        message: "tighten the current run",
      },
    });

    writeBackendMessage(child, { type: "response", id: 1, ok: true, result: { ok: true } });
    await expect(requestPromise).resolves.toEqual({ ok: true });
  });

  it("rejects pending requests when the worker exits", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const backend = new LocalProcessTuiBackend();
    const onDisconnected = vi.fn();
    backend.onDisconnected = onDisconnected;
    backend.start();
    const requestPromise = backend.getGatewayStatus();

    child.stderr.write("boom");
    child.emitExit(1, null);

    await expect(requestPromise).rejects.toThrow("local backend exited with code 1");
    expect(onDisconnected).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});
