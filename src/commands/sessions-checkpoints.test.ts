import { describe, expect, it, vi } from "vitest";
import {
  sessionsCheckpointsCommand,
  type SessionsCheckpointsGatewayCall,
} from "./sessions-checkpoints.js";
import { makeRuntime } from "./sessions.test-helpers.js";

const checkpoint = {
  checkpointId: "checkpoint-1",
  sessionKey: "agent:main:main",
  sessionId: "sess-post",
  createdAt: Date.parse("2026-01-02T03:04:05Z"),
  reason: "manual",
  tokensBefore: 1200,
  tokensAfter: 300,
  summary: "before compact",
  preCompaction: {
    sessionId: "sess-pre",
    sessionFile: "/tmp/sess-pre.checkpoint.jsonl",
    leafId: "leaf-pre",
  },
  postCompaction: {
    sessionId: "sess-post",
    sessionFile: "/tmp/sess-post.jsonl",
    leafId: "leaf-post",
  },
} as const;

function createGatewayCall(
  handler: SessionsCheckpointsGatewayCall,
): ReturnType<typeof vi.fn<SessionsCheckpointsGatewayCall>> {
  return vi.fn<SessionsCheckpointsGatewayCall>(handler);
}

describe("sessionsCheckpointsCommand", () => {
  it("lists checkpoints through the gateway without mutating sessions", async () => {
    const callGateway = createGatewayCall(async (method, params) => {
      expect(method).toBe("sessions.compaction.list");
      expect(params).toEqual({ key: "main" });
      return {
        ok: true,
        key: "agent:main:main",
        checkpoints: [checkpoint],
      };
    });
    const { runtime, logs } = makeRuntime();

    await sessionsCheckpointsCommand({ key: "main" }, runtime, { callGateway });

    expect(callGateway).toHaveBeenCalledTimes(1);
    expect(logs.join("\n")).toContain("Session: agent:main:main");
    expect(logs.join("\n")).toContain("checkpoint-1");
    expect(logs.join("\n")).toContain("1200->300");
  });

  it("previews restore without calling the restore RPC when --confirm is absent", async () => {
    const callGateway = createGatewayCall(async (method, params) => {
      expect(method).toBe("sessions.compaction.get");
      expect(params).toEqual({ key: "main", checkpointId: "checkpoint-1" });
      return {
        ok: true,
        key: "agent:main:main",
        checkpoint,
      };
    });
    const { runtime, logs } = makeRuntime();

    await sessionsCheckpointsCommand(
      { key: "main", checkpointId: "checkpoint-1", restore: true },
      runtime,
      { callGateway },
    );

    expect(callGateway).toHaveBeenCalledTimes(1);
    expect(logs.join("\n")).toContain("Restore preview; no changes made.");
    expect(logs.join("\n")).toContain("Re-run with --restore --confirm to apply");
  });

  it("requires explicit confirmation before applying restore", async () => {
    const callGateway = createGatewayCall(async (method, params) => {
      expect(method).toBe("sessions.compaction.restore");
      expect(params).toEqual({ key: "main", checkpointId: "checkpoint-1" });
      return {
        ok: true,
        key: "agent:main:main",
        sessionId: "sess-restored",
        checkpoint,
      };
    });
    const { runtime, logs } = makeRuntime();

    await sessionsCheckpointsCommand(
      { key: "main", checkpointId: "checkpoint-1", restore: true, confirm: true },
      runtime,
      { callGateway },
    );

    expect(callGateway).toHaveBeenCalledTimes(1);
    expect(logs.join("\n")).toContain("Restored session from checkpoint.");
    expect(logs.join("\n")).toContain("New session id: sess-restored");
  });

  it("rejects branch and restore together", async () => {
    const callGateway = createGatewayCall(async () => {
      throw new Error("should not call gateway");
    });
    const { runtime, errors } = makeRuntime();

    await expect(
      sessionsCheckpointsCommand(
        {
          key: "main",
          checkpointId: "checkpoint-1",
          branch: true,
          restore: true,
        },
        runtime,
        { callGateway },
      ),
    ).rejects.toThrow("exit 1");

    expect(callGateway).not.toHaveBeenCalled();
    expect(errors[0]).toContain("Choose either --branch or --restore");
  });
});
