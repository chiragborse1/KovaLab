import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccountThrottlersForTest, getOrCreateAccountThrottler } from "./account-throttler.js";

describe("telegram account throttler", () => {
  beforeEach(() => {
    clearAccountThrottlersForTest();
  });

  it("reuses throttlers for the same bot token", () => {
    const createThrottler = vi.fn(() => vi.fn());

    const first = getOrCreateAccountThrottler("token-a", createThrottler);
    const second = getOrCreateAccountThrottler("token-a", createThrottler);
    const third = getOrCreateAccountThrottler("token-b", createThrottler);

    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(createThrottler).toHaveBeenCalledTimes(2);
  });
});
