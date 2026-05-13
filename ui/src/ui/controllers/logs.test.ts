import { describe, expect, it } from "vitest";
import { parseLogLine } from "./logs.ts";

describe("parseLogLine", () => {
  it("prefers the human-readable message field when structured data is stored in slot 1", () => {
    const line = JSON.stringify({
      0: '{"subsystem":"control/rpc"}',
      1: {
        cause: "unauthorized",
        authReason: "password_missing",
      },
      2: "preauth socket closed conn=abc code=4008 reason=connect failed",
      _meta: {
        date: "2026-03-13T19:07:12.128Z",
        logLevelName: "WARN",
      },
      time: "2026-03-13T14:07:12.138-05:00",
    });

    expect(parseLogLine(line)).toEqual(
      expect.objectContaining({
        level: "warn",
        subsystem: "control/rpc",
        message: "preauth socket closed conn=abc code=4008 reason=connect failed",
      }),
    );
  });
});
