import { afterEach, describe, expect, it, vi } from "vitest";
import { importFreshModule } from "../../../test/helpers/import-fresh.js";
import { diagnosticLogger } from "../../logging/diagnostic.js";
import {
  __testing,
  abortEmbeddedPiRun,
  clearActiveEmbeddedRun,
  consumeEmbeddedRunModelSwitch,
  getActiveEmbeddedRunSnapshot,
  isEmbeddedPiRunActive,
  queueEmbeddedPiMessageWithOutcome,
  queueEmbeddedPiMessageWithOutcomeAsync,
  requestEmbeddedRunModelSwitch,
  setActiveEmbeddedRun,
  updateActiveEmbeddedRunSnapshot,
  waitForActiveEmbeddedRuns,
} from "./runs.js";

type RunHandle = Parameters<typeof setActiveEmbeddedRun>[1];

function createRunHandle(
  overrides: {
    isCompacting?: boolean;
    abort?: () => void;
    queueMessage?: RunHandle["queueMessage"];
    isStreaming?: RunHandle["isStreaming"];
    supportsTranscriptCommitWait?: boolean;
    sourceReplyDeliveryMode?: RunHandle["sourceReplyDeliveryMode"];
  } = {},
): RunHandle {
  const abort = overrides.abort ?? (() => {});
  return {
    queueMessage: overrides.queueMessage ?? (async () => {}),
    isStreaming: overrides.isStreaming ?? (() => true),
    isCompacting: () => overrides.isCompacting ?? false,
    supportsTranscriptCommitWait: overrides.supportsTranscriptCommitWait,
    sourceReplyDeliveryMode: overrides.sourceReplyDeliveryMode,
    abort,
  };
}

describe("pi-embedded runner run registry", () => {
  afterEach(() => {
    __testing.resetActiveEmbeddedRuns();
    vi.restoreAllMocks();
  });

  it("aborts only compacting runs in compacting mode", () => {
    const abortCompacting = vi.fn();
    const abortNormal = vi.fn();

    setActiveEmbeddedRun(
      "session-compacting",
      createRunHandle({ isCompacting: true, abort: abortCompacting }),
    );

    setActiveEmbeddedRun("session-normal", createRunHandle({ abort: abortNormal }));

    const aborted = abortEmbeddedPiRun(undefined, { mode: "compacting" });
    expect(aborted).toBe(true);
    expect(abortCompacting).toHaveBeenCalledTimes(1);
    expect(abortNormal).not.toHaveBeenCalled();
  });

  it("aborts every active run in all mode", () => {
    const abortA = vi.fn();
    const abortB = vi.fn();

    setActiveEmbeddedRun("session-a", createRunHandle({ isCompacting: true, abort: abortA }));

    setActiveEmbeddedRun("session-b", createRunHandle({ abort: abortB }));

    const aborted = abortEmbeddedPiRun(undefined, { mode: "all" });
    expect(aborted).toBe(true);
    expect(abortA).toHaveBeenCalledTimes(1);
    expect(abortB).toHaveBeenCalledTimes(1);
  });

  it("waits for active runs to drain", async () => {
    vi.useFakeTimers();
    try {
      const handle = createRunHandle();
      setActiveEmbeddedRun("session-a", handle);
      setTimeout(() => {
        clearActiveEmbeddedRun("session-a", handle);
      }, 500);

      const waitPromise = waitForActiveEmbeddedRuns(1_000, { pollMs: 100 });
      await vi.advanceTimersByTimeAsync(500);
      const result = await waitPromise;

      expect(result.drained).toBe(true);
    } finally {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
    }
  });

  it("returns drained=false when timeout elapses", async () => {
    vi.useFakeTimers();
    try {
      setActiveEmbeddedRun("session-a", createRunHandle());

      const waitPromise = waitForActiveEmbeddedRuns(1_000, { pollMs: 100 });
      await vi.advanceTimersByTimeAsync(1_000);
      const result = await waitPromise;
      expect(result.drained).toBe(false);
    } finally {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
    }
  });

  it("shares active run state across distinct module instances", async () => {
    const runsA = await importFreshModule<typeof import("./runs.js")>(
      import.meta.url,
      "./runs.js?scope=shared-a",
    );
    const runsB = await importFreshModule<typeof import("./runs.js")>(
      import.meta.url,
      "./runs.js?scope=shared-b",
    );
    const handle = createRunHandle();

    runsA.__testing.resetActiveEmbeddedRuns();
    runsB.__testing.resetActiveEmbeddedRuns();

    try {
      runsA.setActiveEmbeddedRun("session-shared", handle);
      expect(runsB.isEmbeddedPiRunActive("session-shared")).toBe(true);

      runsB.clearActiveEmbeddedRun("session-shared", handle);
      expect(runsA.isEmbeddedPiRunActive("session-shared")).toBe(false);
    } finally {
      runsA.__testing.resetActiveEmbeddedRuns();
      runsB.__testing.resetActiveEmbeddedRuns();
    }
  });

  it("treats repeated clears for a completed run handle as idempotent", () => {
    const debugSpy = vi.spyOn(diagnosticLogger, "debug").mockImplementation(() => undefined);
    const handle = createRunHandle();

    setActiveEmbeddedRun("session-repeat-clear", handle, "agent:main:main");
    clearActiveEmbeddedRun("session-repeat-clear", handle, "agent:main:main");
    clearActiveEmbeddedRun("session-repeat-clear", handle, "agent:main:main");

    expect(isEmbeddedPiRunActive("session-repeat-clear")).toBe(false);
    expect(
      debugSpy.mock.calls.some(([message]) => message.includes("reason=handle_mismatch")),
    ).toBe(false);
  });

  it("still logs handle mismatches when another run owns the session", () => {
    const debugSpy = vi.spyOn(diagnosticLogger, "debug").mockImplementation(() => undefined);
    const staleHandle = createRunHandle();
    const activeHandle = createRunHandle();

    setActiveEmbeddedRun("session-handle-replaced", activeHandle);
    clearActiveEmbeddedRun("session-handle-replaced", staleHandle);

    expect(isEmbeddedPiRunActive("session-handle-replaced")).toBe(true);
    expect(
      debugSpy.mock.calls.some(([message]) => message.includes("reason=handle_mismatch")),
    ).toBe(true);
  });

  it("tracks and clears per-session transcript snapshots for active runs", () => {
    const handle = createRunHandle();

    setActiveEmbeddedRun("session-snapshot", handle);
    updateActiveEmbeddedRunSnapshot("session-snapshot", {
      transcriptLeafId: "assistant-1",
      messages: [{ role: "user", content: [{ type: "text", text: "hello" }], timestamp: 1 }],
      inFlightPrompt: "keep going",
    });
    expect(getActiveEmbeddedRunSnapshot("session-snapshot")).toEqual({
      transcriptLeafId: "assistant-1",
      messages: [{ role: "user", content: [{ type: "text", text: "hello" }], timestamp: 1 }],
      inFlightPrompt: "keep going",
    });

    clearActiveEmbeddedRun("session-snapshot", handle);
    expect(getActiveEmbeddedRunSnapshot("session-snapshot")).toBeUndefined();
  });

  it("stores and consumes pending live model switch requests", () => {
    expect(
      requestEmbeddedRunModelSwitch("session-switch", {
        provider: "openai",
        model: "gpt-5.4",
      }),
    ).toBe(true);

    expect(consumeEmbeddedRunModelSwitch("session-switch")).toEqual({
      provider: "openai",
      model: "gpt-5.4",
      authProfileId: undefined,
      authProfileIdSource: undefined,
    });
    expect(consumeEmbeddedRunModelSwitch("session-switch")).toBeUndefined();
  });

  it("drops pending live model switch requests when the run clears", () => {
    const handle = createRunHandle();
    setActiveEmbeddedRun("session-clear-switch", handle);
    requestEmbeddedRunModelSwitch("session-clear-switch", {
      provider: "openai",
      model: "gpt-5.4",
    });

    clearActiveEmbeddedRun("session-clear-switch", handle);

    expect(consumeEmbeddedRunModelSwitch("session-clear-switch")).toBeUndefined();
  });

  it("returns structured queue failures for inactive and unsupported waits", () => {
    expect(queueEmbeddedPiMessageWithOutcome("missing-session", "hello")).toEqual({
      queued: false,
      sessionId: "missing-session",
      reason: "no_active_run",
      gatewayHealth: "live",
    });
    expect(
      queueEmbeddedPiMessageWithOutcome("missing-session", "hello", {
        waitForTranscriptCommit: true,
      }),
    ).toEqual({
      queued: false,
      sessionId: "missing-session",
      reason: "transcript_commit_wait_unsupported",
      gatewayHealth: "live",
    });
  });

  it("returns structured queue failures for inactive embedded handles", () => {
    setActiveEmbeddedRun(
      "session-not-streaming",
      createRunHandle({
        isStreaming: () => false,
      }),
    );
    setActiveEmbeddedRun(
      "session-compacting",
      createRunHandle({
        isCompacting: true,
      }),
    );

    expect(queueEmbeddedPiMessageWithOutcome("session-not-streaming", "hello")).toEqual({
      queued: false,
      sessionId: "session-not-streaming",
      reason: "not_streaming",
      gatewayHealth: "live",
    });
    expect(queueEmbeddedPiMessageWithOutcome("session-compacting", "hello")).toEqual({
      queued: false,
      sessionId: "session-compacting",
      reason: "compacting",
      gatewayHealth: "live",
    });
  });

  it("passes queue options to supported embedded handles", async () => {
    const queueMessage = vi.fn(async () => {});
    const handle = createRunHandle({
      queueMessage,
      supportsTranscriptCommitWait: true,
      sourceReplyDeliveryMode: "message_tool_only",
    });
    setActiveEmbeddedRun("session-queue-options", handle);

    const outcome = await queueEmbeddedPiMessageWithOutcomeAsync("session-queue-options", "hello", {
      steeringMode: "all",
      waitForTranscriptCommit: true,
      sourceReplyDeliveryMode: "message_tool_only",
    });

    expect(outcome).toEqual(
      expect.objectContaining({
        queued: true,
        sessionId: "session-queue-options",
        target: "embedded_run",
        gatewayHealth: "live",
      }),
    );
    expect(queueMessage).toHaveBeenCalledWith("hello", {
      steeringMode: "all",
      waitForTranscriptCommit: true,
      sourceReplyDeliveryMode: "message_tool_only",
    });
  });

  it("rejects incompatible source reply delivery modes", () => {
    setActiveEmbeddedRun("session-source-mode", createRunHandle());

    expect(
      queueEmbeddedPiMessageWithOutcome("session-source-mode", "hello", {
        sourceReplyDeliveryMode: "message_tool_only",
      }),
    ).toEqual({
      queued: false,
      sessionId: "session-source-mode",
      reason: "source_reply_delivery_mode_mismatch",
      gatewayHealth: "live",
    });
  });
});
