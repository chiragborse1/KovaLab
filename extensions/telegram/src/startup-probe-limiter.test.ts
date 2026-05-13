import { afterEach, describe, expect, it } from "vitest";
import {
  resetTelegramStartupProbeLimiterForTests,
  withTelegramStartupProbeSlot,
} from "./startup-probe-limiter.js";

async function waitForCondition(check: () => boolean, message: string, attempts = 100) {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error(message);
}

describe("telegram startup probe limiter", () => {
  afterEach(() => {
    resetTelegramStartupProbeLimiterForTests();
  });

  it("limits concurrent startup probes", async () => {
    const releaseProbe: Array<() => void> = [];
    let activeProbes = 0;
    let maxActiveProbes = 0;

    const startProbe = () =>
      withTelegramStartupProbeSlot(undefined, async () => {
        activeProbes += 1;
        maxActiveProbes = Math.max(maxActiveProbes, activeProbes);
        await new Promise<void>((resolve) => {
          releaseProbe.push(resolve);
        });
        activeProbes -= 1;
      });

    const first = startProbe();
    const second = startProbe();
    const third = startProbe();

    await waitForCondition(() => releaseProbe.length === 2, "expected two active probes");
    expect(maxActiveProbes).toBe(2);

    releaseProbe.shift()?.();
    await waitForCondition(() => releaseProbe.length === 2, "expected queued probe to start");
    expect(maxActiveProbes).toBe(2);

    for (const release of releaseProbe.splice(0)) {
      release();
    }
    await Promise.all([first, second, third]);
  });

  it("abandons queued startup probes on abort", async () => {
    const releaseProbe: Array<() => void> = [];
    const startProbe = (abortSignal?: AbortSignal) =>
      withTelegramStartupProbeSlot(abortSignal, async () => {
        await new Promise<void>((resolve) => {
          releaseProbe.push(resolve);
        });
      });

    const first = startProbe();
    const second = startProbe();
    const abortQueued = new AbortController();
    const queued = startProbe(abortQueued.signal);

    await waitForCondition(() => releaseProbe.length === 2, "expected startup probe slots to fill");
    abortQueued.abort();
    await expect(queued).rejects.toThrow("telegram startup probe wait aborted");

    for (const release of releaseProbe.splice(0)) {
      release();
    }
    await Promise.all([first, second]);
  });
});
