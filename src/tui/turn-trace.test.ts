import { describe, expect, it } from "vitest";
import {
  buildTuiTraceSegments,
  formatTuiTurnTrace,
  summarizeTuiTraceSegments,
} from "./turn-trace.js";

describe("tui turn trace", () => {
  it("builds segment durations from ordered marks", () => {
    expect(
      buildTuiTraceSegments(
        [
          { stage: "turn.start", elapsedMs: 0 },
          { stage: "session.load.start", elapsedMs: 10 },
          { stage: "session.load.end", elapsedMs: 40 },
        ],
        100,
      ),
    ).toEqual([
      { stage: "turn.start", durationMs: 10 },
      { stage: "session.load.start", durationMs: 30 },
      { stage: "session.load.end", durationMs: 60 },
    ]);
  });

  it("summarizes slowest segment and hot-path budget hit", () => {
    const summary = summarizeTuiTraceSegments([
      { stage: "turn.start", durationMs: 5 },
      { stage: "session.load.start", durationMs: 900 },
      { stage: "agent.dispatch.start", durationMs: 2_000 },
    ]);

    expect(summary.slowestDetail).toBe(
      "slowest agent.dispatch.start 2.00s (provider/model runtime)",
    );
    expect(summary.budgetDetail).toBe(
      "budget session.load.start 900ms > 500ms (session/history I/O)",
    );
  });

  it("does not budget provider runtime as a local hot-path regression", () => {
    expect(
      summarizeTuiTraceSegments([{ stage: "agent.dispatch.start", durationMs: 20_000 }]),
    ).toEqual({
      slowestDetail: "slowest agent.dispatch.start 20.00s (provider/model runtime)",
    });
  });

  it("classifies slow tool spans by tool name", () => {
    expect(
      summarizeTuiTraceSegments([{ stage: "tool.web_search.start", durationMs: 12_000 }]),
    ).toEqual({
      slowestDetail: "slowest tool.web_search.start 12.00s (tool runtime: web_search)",
      budgetDetail: "budget tool.web_search.start 12.00s > 10.00s (tool runtime)",
    });
  });

  it("formats trace payloads defensively", () => {
    expect(formatTuiTurnTrace({ stage: "summary", elapsedMs: 1250, detail: "final" })).toBe(
      "trace summary +1.25s | final",
    );
  });
});
