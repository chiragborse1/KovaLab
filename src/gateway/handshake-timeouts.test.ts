import { describe, expect, test } from "vitest";
import {
  clampConnectChallengeTimeoutMs,
  DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS,
  getConnectChallengeTimeoutMsFromEnv,
  getPreauthHandshakeTimeoutMsFromEnv,
  MAX_CONNECT_CHALLENGE_TIMEOUT_MS,
  MIN_CONNECT_CHALLENGE_TIMEOUT_MS,
  PREAUTH_HANDSHAKE_TIMER_DELAY_GRACE_MS,
  resolveConnectChallengeTimeoutMs,
  resolvePreauthHandshakeTimeoutAction,
} from "./handshake-timeouts.js";

describe("gateway handshake timeouts", () => {
  test("defaults connect challenge timeout to the shared pre-auth handshake timeout", () => {
    expect(resolveConnectChallengeTimeoutMs()).toBe(DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS);
  });

  test("clamps connect challenge timeouts into the supported range", () => {
    expect(clampConnectChallengeTimeoutMs(0)).toBe(MIN_CONNECT_CHALLENGE_TIMEOUT_MS);
    expect(clampConnectChallengeTimeoutMs(2_000)).toBe(2_000);
    expect(clampConnectChallengeTimeoutMs(20_000)).toBe(MAX_CONNECT_CHALLENGE_TIMEOUT_MS);
  });

  test("prefers KOVA_HANDSHAKE_TIMEOUT_MS and falls back on the test-only env", () => {
    expect(
      getPreauthHandshakeTimeoutMsFromEnv({
        KOVA_HANDSHAKE_TIMEOUT_MS: "75",
        KOVA_TEST_HANDSHAKE_TIMEOUT_MS: "20",
      }),
    ).toBe(75);
    expect(
      getPreauthHandshakeTimeoutMsFromEnv({
        KOVA_HANDSHAKE_TIMEOUT_MS: "",
        KOVA_TEST_HANDSHAKE_TIMEOUT_MS: "20",
        VITEST: "1",
      }),
    ).toBe(20);
  });

  test("getConnectChallengeTimeoutMsFromEnv reads KOVA_CONNECT_CHALLENGE_TIMEOUT_MS", () => {
    expect(getConnectChallengeTimeoutMsFromEnv({})).toBeUndefined();
    expect(
      getConnectChallengeTimeoutMsFromEnv({ KOVA_CONNECT_CHALLENGE_TIMEOUT_MS: "15000" }),
    ).toBe(15_000);
    expect(
      getConnectChallengeTimeoutMsFromEnv({ KOVA_CONNECT_CHALLENGE_TIMEOUT_MS: "garbage" }),
    ).toBeUndefined();
  });

  test("resolveConnectChallengeTimeoutMs falls back to env override", () => {
    const original = process.env.KOVA_CONNECT_CHALLENGE_TIMEOUT_MS;
    try {
      process.env.KOVA_CONNECT_CHALLENGE_TIMEOUT_MS = "5000";
      expect(resolveConnectChallengeTimeoutMs()).toBe(5_000);
      // Explicit value still takes precedence over env
      expect(resolveConnectChallengeTimeoutMs(3_000)).toBe(3_000);
    } finally {
      if (original === undefined) {
        delete process.env.KOVA_CONNECT_CHALLENGE_TIMEOUT_MS;
      } else {
        process.env.KOVA_CONNECT_CHALLENGE_TIMEOUT_MS = original;
      }
    }
  });

  test("extends pre-auth once when the timeout timer fires late", () => {
    expect(
      resolvePreauthHandshakeTimeoutAction({
        elapsedMs: 19_100,
        timeoutMs: 10_000,
        alreadyExtendedForTimerDelay: false,
      }),
    ).toEqual({
      action: "extend",
      graceMs: PREAUTH_HANDSHAKE_TIMER_DELAY_GRACE_MS,
      timerDelayMs: 9_100,
    });

    expect(
      resolvePreauthHandshakeTimeoutAction({
        elapsedMs: 24_100,
        timeoutMs: 10_000,
        alreadyExtendedForTimerDelay: true,
      }),
    ).toEqual({ action: "close", timerDelayMs: 14_100 });
  });

  test("closes pre-auth normally when the timeout timer is on time", () => {
    expect(
      resolvePreauthHandshakeTimeoutAction({
        elapsedMs: 10_050,
        timeoutMs: 10_000,
        alreadyExtendedForTimerDelay: false,
      }),
    ).toEqual({ action: "close", timerDelayMs: 50 });
  });

  test("caps delayed-timer grace for short test handshakes", () => {
    expect(
      resolvePreauthHandshakeTimeoutAction({
        elapsedMs: 1_300,
        timeoutMs: 200,
        alreadyExtendedForTimerDelay: false,
      }),
    ).toEqual({ action: "extend", graceMs: 1_000, timerDelayMs: 1_100 });
  });
});
