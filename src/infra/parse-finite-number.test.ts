import { describe, expect, it } from "vitest";
import {
  clampTimerTimeoutMs,
  finiteSecondsToTimerSafeMilliseconds,
  MAX_TIMER_TIMEOUT_MS,
  MAX_TIMER_TIMEOUT_SECONDS,
  parseFiniteNumber,
  positiveSecondsToSafeMilliseconds,
  resolveExpiresAtMsFromDurationSeconds,
  resolveExpiresAtMsFromDurationOrEpoch,
  resolveExpiresAtMsFromEpochSeconds,
  resolveTimerTimeoutMs,
  parseStrictInteger,
  parseStrictNonNegativeInteger,
  parseStrictPositiveInteger,
} from "./parse-finite-number.js";

function expectParserCases<T>(
  parse: (value: unknown) => T | undefined,
  cases: Array<{ value: unknown; expected: T | undefined }>,
) {
  for (const { value, expected } of cases) {
    expect(parse(value)).toBe(expected);
  }
}

describe("parseFiniteNumber", () => {
  it("parses finite values and rejects invalid inputs", () => {
    expectParserCases(parseFiniteNumber, [
      { value: 42, expected: 42 },
      { value: "3.14", expected: 3.14 },
      { value: " 3.14ms", expected: undefined },
      { value: "+7", expected: 7 },
      { value: "1e3", expected: 1000 },
      { value: Number.NaN, expected: undefined },
      { value: Number.POSITIVE_INFINITY, expected: undefined },
      { value: "not-a-number", expected: undefined },
      { value: " ", expected: undefined },
      { value: "", expected: undefined },
      { value: null, expected: undefined },
    ]);
  });
});

describe("safe seconds helpers", () => {
  it("caps timer timeout values below Node's overflow boundary", () => {
    expect(MAX_TIMER_TIMEOUT_SECONDS).toBe(Math.floor(MAX_TIMER_TIMEOUT_MS / 1000));
    expect(clampTimerTimeoutMs(Number.MAX_SAFE_INTEGER)).toBe(MAX_TIMER_TIMEOUT_MS);
    expect(clampTimerTimeoutMs(0, 10)).toBe(10);
    expect(resolveTimerTimeoutMs(undefined, 5_000)).toBe(5_000);
    expect(resolveTimerTimeoutMs(Number.MAX_SAFE_INTEGER, 5_000)).toBe(MAX_TIMER_TIMEOUT_MS);
    expect(finiteSecondsToTimerSafeMilliseconds(Number.MAX_SAFE_INTEGER)).toBe(
      MAX_TIMER_TIMEOUT_MS,
    );
  });

  it("converts second values without accepting unsafe or partial numbers", () => {
    expect(positiveSecondsToSafeMilliseconds("9")).toBe(9000);
    expect(positiveSecondsToSafeMilliseconds("9s")).toBeUndefined();
    expect(positiveSecondsToSafeMilliseconds(Number.MAX_SAFE_INTEGER)).toBeUndefined();
  });

  it("resolves duration and epoch expiry values with buffers", () => {
    expect(resolveExpiresAtMsFromDurationSeconds("60", { nowMs: 1_000, bufferMs: 5_000 })).toBe(
      56_000,
    );
    expect(
      resolveExpiresAtMsFromDurationSeconds("1", {
        nowMs: 1_000,
        bufferMs: 5_000,
        minRemainingMs: 30_000,
      }),
    ).toBe(31_000);
    expect(resolveExpiresAtMsFromEpochSeconds("100", { bufferMs: 5_000 })).toBe(95_000);
    expect(resolveExpiresAtMsFromDurationOrEpoch("60", { nowMs: 1_000 })).toBe(61_000);
  });
});

describe("parseStrictInteger", () => {
  it("parses strict integers and rejects non-integers", () => {
    expectParserCases(parseStrictInteger, [
      { value: "42", expected: 42 },
      { value: " -7 ", expected: -7 },
      { value: 12, expected: 12 },
      { value: "+9", expected: 9 },
      { value: "42ms", expected: undefined },
      { value: "0abc", expected: undefined },
      { value: "1.5", expected: undefined },
      { value: "1e3", expected: undefined },
      { value: " ", expected: undefined },
      { value: Number.MAX_SAFE_INTEGER + 1, expected: undefined },
    ]);
  });
});

describe("parseStrictPositiveInteger", () => {
  it("enforces positive integers", () => {
    expectParserCases(parseStrictPositiveInteger, [
      { value: "9", expected: 9 },
      { value: "0", expected: undefined },
      { value: "-1", expected: undefined },
    ]);
  });
});

describe("parseStrictNonNegativeInteger", () => {
  it("allows zero and positive integers only", () => {
    expectParserCases(parseStrictNonNegativeInteger, [
      { value: "0", expected: 0 },
      { value: "9", expected: 9 },
      { value: "-1", expected: undefined },
    ]);
  });
});
