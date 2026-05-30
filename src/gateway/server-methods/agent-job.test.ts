import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitAgentEvent } from "../../infra/agent-events.js";
import { waitForAgentJob } from "./agent-job.js";

describe("agent job wait terminal projection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns pending lifecycle errors as timeout snapshots when wait deadline wins", async () => {
    const runId = `run-pending-error-${Date.now()}`;
    const wait = waitForAgentJob({ runId, timeoutMs: 1_000 });
    await Promise.resolve();

    emitAgentEvent({
      runId,
      stream: "lifecycle",
      data: {
        phase: "error",
        startedAt: 100,
        endedAt: 200,
        error: "provider request timed out",
        timeoutPhase: "provider",
        providerStarted: true,
      },
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(wait).resolves.toMatchObject({
      status: "timeout",
      startedAt: 100,
      error: "provider request timed out",
      pendingError: true,
      providerStarted: true,
    });
  });

  it("keeps hard timeout evidence over late lifecycle failures", async () => {
    const runId = `run-hard-timeout-${Date.now()}`;
    const wait = waitForAgentJob({ runId, timeoutMs: 20_000 });
    await Promise.resolve();

    emitAgentEvent({
      runId,
      stream: "lifecycle",
      data: {
        phase: "end",
        startedAt: 100,
        endedAt: 200,
        aborted: true,
        error: "provider request timed out",
        timeoutPhase: "provider",
        providerStarted: true,
      },
    });
    emitAgentEvent({
      runId,
      stream: "lifecycle",
      data: {
        phase: "error",
        startedAt: 100,
        endedAt: 250,
        error: "late cleanup rejection",
      },
    });

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(wait).resolves.toMatchObject({
      status: "timeout",
      startedAt: 100,
      endedAt: 200,
      error: "provider request timed out",
      timeoutPhase: "provider",
      providerStarted: true,
    });
  });
});
