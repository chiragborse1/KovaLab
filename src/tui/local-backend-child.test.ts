import { describe, expect, it } from "vitest";
import { invokeBackend } from "./local-backend-child.js";
import type { ChatSendOptions, TuiBackend } from "./tui-backend.js";

class BindingSensitiveBackend {
  readonly connection = { url: "test" };
  readonly abortedSessions: string[] = [];

  start() {}

  stop() {}

  async sendChat(opts: ChatSendOptions) {
    this.abortSessionRuns(opts.sessionKey);
    return { runId: opts.runId ?? "generated" };
  }

  async steerChat(opts: { sessionKey: string; message: string }) {
    this.abortSessionRuns(`${opts.sessionKey}:${opts.message}`);
    return { ok: true };
  }

  private abortSessionRuns(sessionKey: string) {
    this.abortedSessions.push(sessionKey);
  }
}

describe("local backend child dispatch", () => {
  it("preserves the backend instance when invoking methods", async () => {
    const backend = new BindingSensitiveBackend() as BindingSensitiveBackend & TuiBackend;

    await expect(
      invokeBackend(backend, "sendChat", {
        sessionKey: "agent:main:main",
        message: "hello",
        runId: "run-1",
      }),
    ).resolves.toEqual({ runId: "run-1" });

    expect(backend.abortedSessions).toEqual(["agent:main:main"]);
  });

  it("forwards the optional steer method through the same bound dispatch", async () => {
    const backend = new BindingSensitiveBackend() as BindingSensitiveBackend & TuiBackend;

    await expect(
      invokeBackend(backend, "steerChat", {
        sessionKey: "agent:main:main",
        message: "keep going",
      }),
    ).resolves.toEqual({ ok: true });

    expect(backend.abortedSessions).toEqual(["agent:main:main:keep going"]);
  });
});
