import { describe, expect, it } from "vitest";
import { isSessionRunActive } from "./session-run-state.ts";

describe("isSessionRunActive", () => {
  it("lets terminal status override stale active flags", () => {
    expect(isSessionRunActive({ hasActiveRun: true, status: "done" })).toBe(false);
    expect(isSessionRunActive({ hasActiveRun: true, status: "failed" })).toBe(false);
    expect(isSessionRunActive({ hasActiveRun: true, status: "running" })).toBe(true);
  });

  it("falls back to the active flag when status is absent", () => {
    expect(isSessionRunActive({ hasActiveRun: true })).toBe(true);
    expect(isSessionRunActive({ hasActiveRun: false })).toBe(false);
  });
});
