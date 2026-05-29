import { MAX_TIMER_TIMEOUT_MS } from "getkova/plugin-sdk/infra-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeDiscordInboundWorkerTimeoutMs,
  normalizeDiscordListenerTimeoutMs,
  runDiscordTaskWithTimeout,
} from "./timeouts.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Discord monitor timeouts", () => {
  it("caps listener and inbound worker timeouts", () => {
    expect(normalizeDiscordListenerTimeoutMs(Number.MAX_SAFE_INTEGER)).toBe(MAX_TIMER_TIMEOUT_MS);
    expect(normalizeDiscordInboundWorkerTimeoutMs(Number.MAX_SAFE_INTEGER)).toBe(
      MAX_TIMER_TIMEOUT_MS,
    );
  });

  it("caps task watchdog timers before scheduling", async () => {
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockReturnValue(1 as unknown as ReturnType<typeof setTimeout>);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined);

    await runDiscordTaskWithTimeout({
      timeoutMs: Number.MAX_SAFE_INTEGER,
      run: async () => undefined,
      onTimeout: () => undefined,
    });

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMER_TIMEOUT_MS);
  });
});
