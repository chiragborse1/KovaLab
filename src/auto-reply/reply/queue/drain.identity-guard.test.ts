import { afterEach, describe, expect, it } from "vitest";
import {
  clearSessionQueues,
  enqueueFollowupRun,
  getFollowupQueueDepth,
  scheduleFollowupDrain,
} from "../queue.js";
import {
  createDeferred,
  createQueueTestRun as createRun,
  installQueueRuntimeErrorSilencer,
} from "../queue.test-helpers.js";
import { FOLLOWUP_QUEUES } from "./state.js";
import type { FollowupRun, QueueSettings } from "./types.js";

installQueueRuntimeErrorSilencer();

describe("followup drain identity guard", () => {
  const keysToCleanup: string[] = [];

  afterEach(() => {
    if (keysToCleanup.length > 0) {
      clearSessionQueues(keysToCleanup.splice(0));
    }
  });

  it("preserves a replacement queue when an older drain finishes late", async () => {
    const key = `test-drain-identity-${Date.now()}-${Math.random()}`;
    keysToCleanup.push(key);
    const settings: QueueSettings = { mode: "followup", debounceMs: 0, cap: 50 };
    const calls: FollowupRun[] = [];

    const gate = createDeferred<void>();
    const firstEntered = createDeferred<void>();
    const runFollowup = async (run: FollowupRun) => {
      if (calls.length === 0) {
        firstEntered.resolve();
        await gate.promise;
      }
      calls.push(run);
    };

    enqueueFollowupRun(key, createRun({ prompt: "msg1" }), settings, "message-id", runFollowup);
    scheduleFollowupDrain(key, runFollowup);
    await firstEntered.promise;

    const q1 = FOLLOWUP_QUEUES.get(key);
    expect(q1).toBeDefined();
    expect(q1?.draining).toBe(true);

    clearSessionQueues([key]);
    expect(FOLLOWUP_QUEUES.has(key)).toBe(false);

    enqueueFollowupRun(
      key,
      createRun({ prompt: "msg2" }),
      settings,
      "message-id",
      runFollowup,
      false,
    );

    const q2 = FOLLOWUP_QUEUES.get(key);
    expect(q2).toBeDefined();
    expect(q2).not.toBe(q1);
    expect(q2?.items.length).toBe(1);
    expect(q2?.draining).toBe(false);
    expect(getFollowupQueueDepth(key)).toBe(1);

    gate.resolve();

    for (let i = 0; i < 20; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    expect(FOLLOWUP_QUEUES.get(key)).toBe(q2);
    expect(getFollowupQueueDepth(key)).toBe(1);
    expect(q2?.items[0]?.prompt).toBe("msg2");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.prompt).toBe("msg1");
  });
});
