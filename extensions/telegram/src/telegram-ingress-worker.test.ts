import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workerMock = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class MockWorker {
    readonly listeners = new Map<string, Listener[]>();
    readonly postMessage = vi.fn();
    readonly terminate = vi.fn(async () => {
      this.emit("exit", 1);
      return 1;
    });

    constructor(
      readonly url: URL,
      readonly options: { workerData?: unknown },
    ) {
      instances.push(this);
    }

    on(event: string, listener: Listener): this {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    once(event: string, listener: Listener): this {
      const onceListener: Listener = (...args) => {
        this.off(event, onceListener);
        listener(...args);
      };
      return this.on(event, onceListener);
    }

    off(event: string, listener: Listener): this {
      const listeners = this.listeners.get(event);
      if (!listeners) {
        return this;
      }
      this.listeners.set(
        event,
        listeners.filter((candidate) => candidate !== listener),
      );
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      for (const listener of [...(this.listeners.get(event) ?? [])]) {
        listener(...args);
      }
    }
  }

  const instances: MockWorker[] = [];
  return { MockWorker, instances };
});

vi.mock("node:worker_threads", () => ({
  Worker: workerMock.MockWorker,
}));

const { createTelegramIngressWorker } = await import("./telegram-ingress-worker.js");

function createHandle() {
  return createTelegramIngressWorker({
    token: "tok",
    accountId: "default",
    initialUpdateId: null,
    spoolDir: "/tmp/kova-telegram-test",
  });
}

describe("createTelegramIngressWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    workerMock.instances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats stop-triggered worker termination as a clean shutdown", async () => {
    const handle = createHandle();
    const worker = workerMock.instances[0];
    expect(worker).toBeDefined();

    const task = handle.task();
    const stop = handle.stop();
    expect(worker?.postMessage).toHaveBeenCalledWith({ type: "stop" });

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(stop).resolves.toBeUndefined();
    await expect(task).resolves.toBeUndefined();
    expect(worker?.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects unexpected non-zero worker exits", async () => {
    const handle = createHandle();
    const worker = workerMock.instances[0];
    const task = expect(handle.task()).rejects.toThrow(
      "Telegram ingress worker exited with code 1",
    );

    worker?.emit("exit", 1);

    await task;
  });
});
